import type { Handler } from "@netlify/functions";
import crypto from "node:crypto";
import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { prisma } from "./_lib/prisma";
import { normalizePairingCode } from "./_lib/codes";
import { signExtensionToken } from "./_lib/token";

interface ExchangeBody {
  code?: string;
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }
  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST"]);
  }

  const body = parseJsonBody<ExchangeBody>(event);
  const code = normalizePairingCode(body.code || "");

  if (!code) {
    return json(400, { error: "Pairing code is required" });
  }

  const pairingCode = await prisma.pairingCode.findUnique({
    where: { code }
  });

  if (!pairingCode || pairingCode.usedAt || pairingCode.expiresAt.getTime() <= Date.now()) {
    return json(401, { error: "Invalid or expired pairing code" });
  }

  const tokenId = crypto.randomUUID();

  await prisma.$transaction(async (tx) => {
    await tx.pairingCode.update({
      where: { id: pairingCode.id },
      data: { usedAt: new Date() }
    });

    await tx.extensionToken.create({
      data: {
        tokenId,
        userId: pairingCode.userId
      }
    });
  });

  const token = signExtensionToken(pairingCode.userId, tokenId);

  return json(200, {
    ok: true,
    token,
    tokenId,
    userId: pairingCode.userId,
    issuedAt: new Date().toISOString()
  });
};
