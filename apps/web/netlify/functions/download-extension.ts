import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { readFile } from "node:fs/promises";
import path from "node:path";

import Stripe from "stripe";

import { requireEnvVars } from "./_lib/env";
import { corsPreflight, json, methodNotAllowed, parseJsonBody, requestId } from "./_lib/http";
import { hashLicenseKey, licenseLooksValidShape, normalizeSubscriptionStatus } from "./_lib/license";
import { reportServerEvent } from "./_lib/monitor";
import { prisma } from "./_lib/prisma";

type DownloadBody = {
  session_id?: string | null;
  sessionId?: string | null;
  license?: string | null;
  license_key?: string | null;
};

type DownloadSignal = {
  sessionId: string;
  licenseKey: string;
};

type RateEntry = {
  hits: number[];
};

const MAX_HITS_PER_MINUTE = 20;
const WINDOW_MS = 60 * 1000;
const ZIP_FILENAME = "holmeta-extension.zip";

const rateLimitState = globalThis as typeof globalThis & {
  holmetaDownloadRateLimit?: Map<string, RateEntry>;
};

if (!rateLimitState.holmetaDownloadRateLimit) {
  rateLimitState.holmetaDownloadRateLimit = new Map<string, RateEntry>();
}

function masked(value: string): string {
  const safe = String(value || "").trim();
  if (!safe) {
    return "";
  }
  if (safe.length <= 10) {
    return `${safe.slice(0, 2)}…`;
  }
  return `${safe.slice(0, 6)}…${safe.slice(-4)}`;
}

function extractSignal(event: HandlerEvent): DownloadSignal {
  const body = parseJsonBody<DownloadBody>(event);
  const query = new URLSearchParams(event.rawUrl.split("?")[1] || "");

  const sessionId = String(
    body.session_id
      || body.sessionId
      || query.get("session_id")
      || query.get("sessionId")
      || ""
  ).trim();

  const licenseKey = String(
    body.license
      || body.license_key
      || query.get("license")
      || query.get("license_key")
      || ""
  ).trim().toUpperCase();

  return { sessionId, licenseKey };
}

function looksLikeCheckoutSessionId(value: string): boolean {
  const safe = String(value || "").trim();
  return /^cs_(test|live|)_?[A-Za-z0-9_]+$/i.test(safe);
}

function firstIp(event: HandlerEvent): string {
  const forwarded = String(event.headers["x-forwarded-for"] || "").trim();
  if (!forwarded) {
    return "unknown";
  }
  return forwarded.split(",")[0]?.trim() || "unknown";
}

function checkRateLimit(event: HandlerEvent): { allowed: boolean; retryAfterSec?: number } {
  const ip = firstIp(event);
  const now = Date.now();
  const state = rateLimitState.holmetaDownloadRateLimit as Map<string, RateEntry>;
  const entry = state.get(ip) || { hits: [] };
  entry.hits = entry.hits.filter((ts) => now - ts < WINDOW_MS);

  if (entry.hits.length >= MAX_HITS_PER_MINUTE) {
    state.set(ip, entry);
    const oldest = entry.hits[0] || now;
    const retryAfterMs = Math.max(1000, WINDOW_MS - (now - oldest));
    return {
      allowed: false,
      retryAfterSec: Math.ceil(retryAfterMs / 1000)
    };
  }

  entry.hits.push(now);
  state.set(ip, entry);
  return { allowed: true };
}

async function resolveZipBuffer(): Promise<Buffer> {
  const candidates = [
    path.resolve(__dirname, "assets", ZIP_FILENAME),
    path.resolve(__dirname, "..", "assets", ZIP_FILENAME),
    path.resolve(process.cwd(), "netlify/functions/assets", ZIP_FILENAME),
    path.resolve(process.cwd(), "apps/web/netlify/functions/assets", ZIP_FILENAME)
  ];

  let lastError: Error | null = null;
  for (const filePath of candidates) {
    try {
      const data = await readFile(filePath);
      if (data.length > 1024) {
        return data;
      }
      lastError = new Error(`Zip found but invalid size at ${filePath}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error("Extension zip not found");
}

function subscriptionStatusAllowed(status: string | null | undefined): boolean {
  const normalized = normalizeSubscriptionStatus(status);
  return normalized === "active" || normalized === "trialing";
}

function checkoutComplete(session: Stripe.Checkout.Session): boolean {
  const status = String(session.status || "").toLowerCase();
  const paymentStatus = String(session.payment_status || "").toLowerCase();
  return status === "complete" || paymentStatus === "paid";
}

async function entitledBySession(sessionId: string): Promise<boolean> {
  const missing = requireEnvVars(["STRIPE_SECRET_KEY"]);
  if (missing) {
    throw new Error("STRIPE_SECRET_KEY missing");
  }

  const stripe = new Stripe(String(process.env.STRIPE_SECRET_KEY || "").trim(), {
    apiVersion: "2025-02-24.acacia"
  });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"]
    });
  } catch (error) {
    if (error instanceof Stripe.errors.StripeInvalidRequestError) {
      return false;
    }
    throw error;
  }

  if (!checkoutComplete(session)) {
    return false;
  }

  const subscriptionId = typeof session.subscription === "string"
    ? session.subscription
    : session.subscription?.id || "";
  if (!subscriptionId) {
    return false;
  }

  if (typeof session.subscription !== "string" && session.subscription) {
    return subscriptionStatusAllowed(session.subscription.status);
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  return subscriptionStatusAllowed(subscription.status);
}

async function entitledByLicense(licenseKey: string): Promise<boolean> {
  const missing = requireEnvVars(["DATABASE_URL", "LICENSE_SALT"]);
  if (missing) {
    throw new Error("DATABASE_URL/LICENSE_SALT missing for license validation");
  }

  if (!licenseLooksValidShape(licenseKey)) {
    return false;
  }

  const licenseHash = hashLicenseKey(licenseKey);
  const record = await prisma.license.findUnique({
    where: {
      licenseHash
    },
    select: {
      status: true,
      trialEnd: true
    }
  });

  if (!record) {
    return false;
  }

  const status = normalizeSubscriptionStatus(record.status);
  if (status === "active") {
    return true;
  }

  if (status !== "trialing") {
    return false;
  }

  if (!record.trialEnd) {
    return true;
  }

  return record.trialEnd.getTime() > Date.now();
}

function zipResponse(buffer: Buffer): HandlerResponse {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename=\"${ZIP_FILENAME}\"`,
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
    },
    isBase64Encoded: true,
    body: buffer.toString("base64")
  };
}

export const handler: Handler = async (event) => {
  const rid = requestId(event);
  const respond = (statusCode: number, body: unknown, headers: Record<string, string> = {}) =>
    json(statusCode, body, {
      "X-Holmeta-Request-Id": rid,
      ...headers
    });

  const preflight = corsPreflight(event);
  if (preflight) {
    return preflight;
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return methodNotAllowed(["GET", "POST", "OPTIONS"]);
  }

  const limited = checkRateLimit(event);
  if (!limited.allowed) {
    return respond(429, {
      ok: false,
      error: "Too many download attempts",
      code: "RATE_LIMITED"
    }, {
      "Retry-After": String(limited.retryAfterSec || 60)
    });
  }

  const { sessionId, licenseKey } = extractSignal(event);
  if (!sessionId && !licenseKey) {
    return respond(401, {
      ok: false,
      error: "Download requires active subscription verification",
      code: "ENTITLEMENT_REQUIRED"
    });
  }

  if (sessionId && !looksLikeCheckoutSessionId(sessionId)) {
    return respond(400, {
      ok: false,
      error: "Invalid session_id format",
      code: "INVALID_SESSION_ID"
    });
  }

  try {
    let entitled = false;
    if (sessionId) {
      entitled = await entitledBySession(sessionId);
    } else if (licenseKey) {
      entitled = await entitledByLicense(licenseKey);
    }

    if (!entitled) {
      await reportServerEvent("warn", "download_not_entitled", {
        requestId: rid,
        session: masked(sessionId),
        licensePresent: Boolean(licenseKey)
      });

      return respond(403, {
        ok: false,
        error: "Not entitled to download",
        code: "NOT_ENTITLED"
      });
    }

    const zipBuffer = await resolveZipBuffer();
    await reportServerEvent("info", "download_served", {
      requestId: rid,
      session: masked(sessionId),
      via: sessionId ? "session" : "license"
    });
    return zipResponse(zipBuffer);
  } catch (error) {
    await reportServerEvent("error", "download_extension_failed", {
      requestId: rid,
      session: masked(sessionId),
      via: sessionId ? "session" : "license",
      error: error instanceof Error ? error.message : "unknown"
    });

    return respond(500, {
      ok: false,
      error: "Unable to prepare extension download",
      code: "DOWNLOAD_FAILED"
    });
  }
};
