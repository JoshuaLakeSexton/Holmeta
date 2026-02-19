import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { getOrCreateUserByEmail } from "./_lib/users";
import { prisma } from "./_lib/prisma";
import { signDashboardToken } from "./_lib/token";
import { entitlementForUser } from "./_lib/entitlement";

interface VerifyBody {
  email?: string;
  code?: string;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const body = parseJsonBody<VerifyBody>(event);
  const code = String(body.code || "").trim();

  if (!code) {
    return json(400, { error: "Code is required" });
  }

  const user = await getOrCreateUserByEmail(body.email || "");
  if (!user) {
    return json(400, { error: "Valid email is required" });
  }

  const loginCode = await prisma.loginCode.findFirst({
    where: {
      userId: user.id,
      code,
      usedAt: null,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });

  if (!loginCode) {
    return json(401, { error: "Invalid or expired code" });
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
