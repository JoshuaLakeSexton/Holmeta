import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { generateLoginCode } from "./_lib/codes";
import { getOrCreateUserByEmail } from "./_lib/users";
import { prisma } from "./_lib/prisma";
import { allowInlineLoginCode, loginCodeRateLimitPerHour } from "./_lib/auth";
import { hasEmailDeliveryConfig, sendLoginCodeEmail } from "./_lib/email";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import { hashLoginCode } from "./_lib/login-codes";

interface RequestBody {
  email?: string;
}

const ipRequestLog = new Map<string, number[]>();

function clientIp(eventHeaders: Record<string, string | undefined>): string {
  const forwarded = String(eventHeaders["x-forwarded-for"] || "").trim();
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return String(eventHeaders["client-ip"] || "unknown").trim() || "unknown";
}

function enforceIpRateLimit(ip: string, maxPerHour = 25): boolean {
  const now = Date.now();
  const oldest = now - 60 * 60 * 1000;
  const history = (ipRequestLog.get(ip) || []).filter((ts) => ts > oldest);
  if (history.length >= maxPerHour) {
    ipRequestLog.set(ip, history);
    return false;
  }
  history.push(now);
  ipRequestLog.set(ip, history);
  return true;
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "APP_JWT_SECRET"]);
  if (missingEnv) {
    await reportServerEvent("error", "auth_request_server_env_missing");
    return missingEnv;
  }

  const body = parseJsonBody<RequestBody>(event);
  const ip = clientIp(event.headers);
  if (!enforceIpRateLimit(ip)) {
    await reportServerEvent("warn", "auth_request_ip_rate_limited", {
      ip
    });
    return json(429, {
      error: "Too many requests from this network. Please wait and try again.",
      code: "RATE_LIMITED_IP"
    });
  }

  const user = await getOrCreateUserByEmail(body.email || "");

  if (!user) {
    await reportServerEvent("warn", "auth_request_invalid_email");
    return json(400, { error: "Valid email is required", code: "INVALID_EMAIL" });
  }

  const hourlyLimit = loginCodeRateLimitPerHour();
  const createdThisHour = await prisma.loginCode.count({
    where: {
      userId: user.id,
      createdAt: {
        gt: new Date(Date.now() - 60 * 60 * 1000)
      }
    }
  });

  if (createdThisHour >= hourlyLimit) {
    await reportServerEvent("warn", "auth_request_rate_limited", {
      userId: user.id,
      email: user.email,
      createdThisHour,
      hourlyLimit
    });
    return json(429, {
      error: "Too many code requests. Please wait and try again.",
      code: "RATE_LIMITED_EMAIL"
    });
  }

  const code = generateLoginCode();
  const codeHash = hashLoginCode(user.email, code);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.loginCode.create({
    data: {
      userId: user.id,
      code: codeHash,
      expiresAt
    }
  });

  await prisma.loginCode.deleteMany({
    where: {
      userId: user.id,
      expiresAt: {
        lt: new Date(Date.now() - 60 * 60 * 1000)
      }
    }
  });

  const exposeInline = allowInlineLoginCode();

  if (!exposeInline) {
    if (!hasEmailDeliveryConfig()) {
      await reportServerEvent("error", "auth_delivery_missing_config", {
        userId: user.id,
        email: user.email
      });
      return json(503, {
        error:
          "Email delivery is not configured. Set RESEND_API_KEY and HOLMETA_EMAIL_FROM, or enable HOLMETA_EXPOSE_LOGIN_CODE for local development.",
        code: "EMAIL_NOT_CONFIGURED"
      });
    }

    const delivery = await sendLoginCodeEmail({
      to: user.email,
      code,
      expiresAt
    });

    if (!delivery.ok) {
      await reportServerEvent("error", "auth_delivery_failed", {
        userId: user.id,
        email: user.email,
        provider: delivery.provider,
        error: delivery.error || "unknown"
      });
      return json(502, {
        error: "Could not deliver login code email. Please retry.",
        code: "EMAIL_DELIVERY_FAILED"
      });
    }
  }

  await reportServerEvent("info", "auth_code_issued", {
    userId: user.id,
    email: user.email,
    inline: exposeInline
  });

  return json(200, {
    ok: true,
    message: "Account code generated",
    expiresAt: expiresAt.toISOString(),
    delivery: exposeInline ? "inline" : "email",
    code: exposeInline ? code : null
  });
};
