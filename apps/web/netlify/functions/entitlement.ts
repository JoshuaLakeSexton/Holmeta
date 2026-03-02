import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed } from "./_lib/http";
import { requireToken } from "./_lib/token";
import { entitlementForUser, LOCKED_FEATURES } from "./_lib/entitlement";
import { prisma } from "./_lib/prisma";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";

function inactiveResponse(status = "inactive") {
  return {
    ok: true,
    userId: null,
    entitled: false,
    active: false,
    status,
    plan: "2",
    renewsAt: null,
    trialEndsAt: null,
    features: {
      ...LOCKED_FEATURES
    }
  };
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "GET") {
    return methodNotAllowed(["GET"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "APP_JWT_SECRET"]);
  if (missingEnv) {
    await reportServerEvent("error", "entitlement_server_env_missing");
    return missingEnv;
  }

  const claims = requireToken(event, ["dashboard", "extension"]);
  if (!claims) {
    await reportServerEvent("warn", "entitlement_unauthorized");
    return json(401, inactiveResponse("unauthorized"));
  }

  if (claims.scope === "extension") {
    const token = await prisma.extensionToken.findUnique({
      where: { tokenId: claims.tokenId || "" }
    });

    if (!token || token.userId !== claims.sub || token.revokedAt) {
      await reportServerEvent("warn", "entitlement_token_revoked", {
        tokenId: claims.tokenId || null,
        userId: claims.sub
      });
      return json(401, inactiveResponse("token_revoked"));
    }
  }

  const entitlement = await entitlementForUser(claims.sub);
  return json(200, entitlement);
};
