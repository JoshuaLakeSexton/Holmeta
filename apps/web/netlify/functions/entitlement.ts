import type { Handler } from "@netlify/functions";

function toBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const handler: Handler = async () => {
  const devBypass = toBoolean(process.env.HOLMETA_DEV_BYPASS_PREMIUM);

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      active: devBypass,
      plan: devBypass ? "dev-bypass" : null,
      renewsAt: null
    })
  };
};
