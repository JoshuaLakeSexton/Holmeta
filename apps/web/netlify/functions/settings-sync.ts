import type { Handler } from "@netlify/functions";

function toBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export const handler: Handler = async (event) => {
  const premium = toBoolean(process.env.HOLMETA_DEV_BYPASS_PREMIUM);

  if (!premium) {
    return {
      statusCode: 402,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        error: "Premium required for sync endpoint"
      })
    };
  }

  if (event.httpMethod === "GET") {
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        syncedAt: null,
        settings: {}
      })
    };
  }

  if (event.httpMethod === "POST") {
    const payload = event.body ? JSON.parse(event.body) : {};
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        syncedAt: new Date().toISOString(),
        accepted: payload
      })
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: "Method not allowed" })
  };
};
