import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { getOrCreateUserByEmail } from "./_lib/users";
import { prisma } from "./_lib/prisma";
import { signDashboardToken } from "./_lib/token";
import { entitlementForUser } from "./_lib/entitlement";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import { compareLoginCodeHash } from "./_lib/login-codes";

interface VerifyBody {
  email?: string;
  code?: string;
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
    await reportServerEvent("error", "auth_verify_server_env_missing");
    return missingEnv;
  }

  const body = parseJsonBody<VerifyBody>(event);
  const code = String(body.code || "").trim();

  if (!code) {
    await reportServerEvent("warn", "auth_verify_missing_code");
    return json(400, { error: "Code is required", code: "MISSING_CODE" });
  }

  const user = await getOrCreateUserByEmail(body.email || "");
  if (!user) {
    await reportServerEvent("warn", "auth_verify_invalid_email");
    return json(400, { error: "Valid email is required", code: "INVALID_EMAIL" });
  }

  const candidates = await prisma.loginCode.findMany({
    where: {
      userId: user.id,
      usedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 10
  });

  const loginCode = candidates.find((candidate) => {
    if (!candidate.code) return false;
    // Backward compatibility: some old rows may still hold plaintext codes.
    if (candidate.code === code) return true;
    return compareLoginCodeHash(user.email, code, candidate.code);
  });

  if (!loginCode) {
    await reportServerEvent("warn", "auth_verify_invalid_or_expired", {
      userId: user.id,
      email: user.email
    });
    return json(401, { error: "Invalid or expired code", code: "INVALID_OR_EXPIRED_CODE" });
  }

  await prisma.loginCode.update({
    where: {
      id: loginCode.id
    },
    data: {
      usedAt: new Date()
    }
  });

  const token = signDashboardToken(user.id, user.email);
  const entitlement = await entitlementForUser(user.id);

  await reportServerEvent("info", "auth_verify_success", {
    userId: user.id,
    email: user.email
  });

  return json(200, {
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email
    },
    entitlement
  });
};
