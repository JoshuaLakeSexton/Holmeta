import type { Handler } from "@netlify/functions";
import { json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { requireToken } from "./_lib/token";
import { entitlementForUser } from "./_lib/entitlement";
import { requireEnvVars } from "./_lib/env";

export const handler: Handler = async (event) => {
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST"]);
  }

  const missingEnv = requireEnvVars(["DATABASE_URL", "APP_JWT_SECRET"]);
  if (missingEnv) {
    return missingEnv;
  }

  const claims = requireToken(event, ["dashboard", "extension"]);
  if (!claims) {
    return json(401, { error: "Unauthorized" });
  }

  const entitlement = await entitlementForUser(claims.sub);
  if (!entitlement.active || !entitlement.features.settingsSync) {
    return json(402, {
      error: "Premium required for settings sync"
    });
  }

  if (event.httpMethod === "GET") {
    return json(200, {
      syncedAt: null,
      settings: {}
    });
  }

  const payload = parseJsonBody<Record<string, unknown>>(event);
  return json(200, {
    syncedAt: new Date().toISOString(),
    accepted: payload
  });
};
