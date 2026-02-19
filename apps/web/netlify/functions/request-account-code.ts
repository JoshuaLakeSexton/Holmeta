import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { generateLoginCode } from "./_lib/codes";
import { getOrCreateUserByEmail } from "./_lib/users";
import { prisma } from "./_lib/prisma";

interface RequestBody {
  email?: string;
}

function shouldExposeCode(): boolean {
  const flag = String(process.env.HOLMETA_EXPOSE_LOGIN_CODE || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(flag)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(flag)) {
    return false;
  }
  return process.env.NODE_ENV !== "production";
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const body = parseJsonBody<RequestBody>(event);
  const user = await getOrCreateUserByEmail(body.email || "");

  if (!user) {
    return json(400, { error: "Valid email is required" });
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

  return json(200, {
    ok: true,
    message: "Account code generated",
    expiresAt: expiresAt.toISOString(),
    delivery: shouldExposeCode() ? "inline" : "email-pending",
    code: shouldExposeCode() ? code : null
  });
};
