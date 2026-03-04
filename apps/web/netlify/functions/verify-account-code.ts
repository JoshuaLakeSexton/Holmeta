import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed } from "./_lib/http";

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  return json(410, {
    ok: false,
    error: "Email code login was removed for launch. Use checkout + license key unlock.",
    code: "LOGIN_REMOVED"
  });
};
