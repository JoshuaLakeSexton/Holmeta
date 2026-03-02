import type { Handler } from "@netlify/functions";
import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { reportServerEvent } from "./_lib/monitor";

type ClientErrorBody = {
  type?: string;
  message?: string;
  stack?: string;
  source?: string;
  path?: string;
  userAgent?: string;
};

function clipped(value: string | undefined, max: number): string {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export const handler: Handler = async (event) => {
  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const body = parseJsonBody<ClientErrorBody>(event);

  await reportServerEvent("warn", "client_error", {
    type: clipped(body.type, 80),
    message: clipped(body.message, 600),
    stack: clipped(body.stack, 1200),
    source: clipped(body.source, 120),
    path: clipped(body.path, 200),
    userAgent: clipped(body.userAgent, 240)
  });

  return json(200, { ok: true });
};
