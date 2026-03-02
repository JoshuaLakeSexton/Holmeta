import { json } from "./http";

export function requiredEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

export function requireEnvVars(names: string[]) {
  const missing = names.filter((name) => !requiredEnv(name));
  if (missing.length === 0) {
    return null;
  }

  return json(503, {
    error: `Server is not configured: missing ${missing.join(", ")}`,
    code: "SERVER_ENV_MISSING"
  });
}
