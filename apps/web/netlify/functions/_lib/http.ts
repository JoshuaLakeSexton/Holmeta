import type { HandlerEvent, HandlerResponse } from "@netlify/functions";

export const EXTENSION_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

export function json(statusCode: number, body: unknown, headers: Record<string, string> = {}): HandlerResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...EXTENSION_CORS_HEADERS,
      ...headers
    },
    body: JSON.stringify(body)
  };
}

export function methodNotAllowed(allowed: string[]): HandlerResponse {
  return json(405, {
    error: `Method not allowed. Use: ${allowed.join(", ")}`
  });
}

export function corsPreflight(event: HandlerEvent): HandlerResponse | null {
  if (event.httpMethod !== "OPTIONS") {
    return null;
  }

  return {
    statusCode: 204,
    headers: {
      ...EXTENSION_CORS_HEADERS,
      "Cache-Control": "no-store"
    },
    body: ""
  };
}

export function parseJsonBody<T = Record<string, unknown>>(event: HandlerEvent): T {
  if (!event.body) {
    return {} as T;
  }

  try {
    return JSON.parse(event.body) as T;
  } catch {
    return {} as T;
  }
}

export function getOrigin(event: HandlerEvent): string {
  return (
    event.headers.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.URL ||
    "http://localhost:3000"
  );
}

export function requestId(event: HandlerEvent): string {
  const fromHeader = String(
    event.headers["x-nf-request-id"]
      || event.headers["x-request-id"]
      || event.headers["x-amzn-trace-id"]
      || ""
  ).trim();

  if (fromHeader) {
    return fromHeader.slice(0, 120);
  }

  return `hm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
