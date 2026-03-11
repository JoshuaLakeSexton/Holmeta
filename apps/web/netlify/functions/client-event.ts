import type { Handler } from "@netlify/functions";

import { corsPreflight, json, methodNotAllowed, parseJsonBody } from "./_lib/http";
import { reportServerEvent } from "./_lib/monitor";

type ClientEventBody = {
  name?: string;
  props?: Record<string, unknown>;
  path?: string;
  locale?: string;
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

  const body = parseJsonBody<ClientEventBody>(event);
  const name = clipped(body.name, 120);
  if (!name) {
    return json(400, { ok: false, error: "name is required" });
  }

  await reportServerEvent("info", "client_event", {
    name,
    path: clipped(body.path, 200),
    locale: clipped(body.locale, 24),
    userAgent: clipped(body.userAgent, 240),
    props: body.props || {}
  });

  return json(200, { ok: true });
};
