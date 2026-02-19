import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed } from "./_lib/http";
import { requireToken } from "./_lib/token";
import { prisma } from "./_lib/prisma";
import { generatePairingCode } from "./_lib/codes";

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const claims = requireToken(event, ["dashboard"]);
  if (!claims) {
    return json(401, { error: "Unauthorized" });
  }

  let code = "";
  for (let i = 0; i < 5; i += 1) {
    const candidate = generatePairingCode();
    const existing = await prisma.pairingCode.findUnique({ where: { code: candidate } });
    if (!existing) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    return json(500, { error: "Unable to generate pairing code" });
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.pairingCode.create({
    data: {
      code,
      userId: claims.sub,
      expiresAt
    }
  });

  await prisma.pairingCode.deleteMany({
    where: {
      userId: claims.sub,
      expiresAt: {
        lt: new Date(Date.now() - 60 * 60 * 1000)
      }
    }
  });

  return json(200, {
    ok: true,
    code,
    expiresAt: expiresAt.toISOString()
  });
};
