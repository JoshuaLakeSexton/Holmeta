import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { generateLoginCode } from "./_lib/codes";
import { getOrCreateUserByEmail } from "./_lib/users";
import { prisma } from "./_lib/prisma";
import { allowInlineLoginCode, loginCodeRateLimitPerHour } from "./_lib/auth";
import { hasEmailDeliveryConfig, sendLoginCodeEmail } from "./_lib/email";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";

interface RequestBody {
  email?: string;
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
  const user = await getOrCreateUserByEmail(body.email || "");

  if (!user) {
    await reportServerEvent("warn", "auth_request_invalid_email");
    return json(400, { error: "Valid email is required" });
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
      error: "Too many code requests. Please wait and try again."
    });
  }

  const code = generateLoginCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.loginCode.create({
    data: {
      userId: user.id,
      code,
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
          "Email delivery is not configured. Set RESEND_API_KEY and HOLMETA_EMAIL_FROM, or enable HOLMETA_EXPOSE_LOGIN_CODE for local development."
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
        error: "Could not deliver login code email. Please retry."
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
