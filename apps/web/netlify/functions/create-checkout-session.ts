import type { Handler } from "@netlify/functions";
import Stripe from "stripe";

import { corsPreflight, json, methodNotAllowed, parseJsonBody, requestId } from "./_lib/http";
import { reportServerEvent } from "./_lib/monitor";
import { requireEnvVars } from "./_lib/env";
import {
  currencyForMarket,
  normalizedPlan,
  resolveMarketFromSignals,
  resolvePriceIdForPlan,
  type PlanKey,
  type MarketKey,
  requiredPriceEnvForPlan
} from "./_lib/plans";

interface CheckoutBody {
  planKey?: string | null;
  installId?: string | null;
  locale?: string | null;
  country?: string | null;
  currency?: string | null;
}

function trialDaysFromEnv(): number {
  const raw = Number(process.env.TRIAL_DAYS ?? "3");
  if (!Number.isFinite(raw)) {
    return 3;
  }

  return Math.max(0, Math.min(30, Math.round(raw)));
}

function requiredEnv(name: string): string | null {
  const value = String(process.env[name] || "").trim();
  return value ? value : null;
}

function normalizeBaseUrl(raw: string): string {
  return raw.replace(/\/$/, "");
}

function normalizeSiteLocale(input?: string | null): "en" | "ja" | "ko" | "zh-cn" | "zh-tw" {
  const value = String(input || "").trim().toLowerCase();
  if (value.startsWith("ja")) return "ja";
  if (value.startsWith("ko")) return "ko";
  if (value.startsWith("zh-cn") || value.startsWith("zh-hans")) return "zh-cn";
  if (value.startsWith("zh-tw") || value.startsWith("zh-hant")) return "zh-tw";
  return "en";
}

function stripeCheckoutLocale(siteLocale: string): Stripe.Checkout.SessionCreateParams.Locale {
  if (siteLocale === "ja") return "ja";
  if (siteLocale === "ko") return "ko";
  if (siteLocale === "zh-cn" || siteLocale === "zh-tw") return "zh";
  return "en";
}

function resolveRequestedPlan(body: CheckoutBody): PlanKey | null {
  return normalizedPlan(body.planKey || "") || null;
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

  if (event.httpMethod === "GET") {
    return respond(200, {
      ok: true,
      hint: "Use POST",
      supportedPlans: ["monthly_a", "yearly"]
    });
  }

  if (event.httpMethod !== "POST") {
    return methodNotAllowed(["POST", "OPTIONS"]);
  }

  const missingEnv = requireEnvVars(["STRIPE_SECRET_KEY", "PUBLIC_BASE_URL"]);
  if (missingEnv) {
    await reportServerEvent("error", "checkout_server_env_missing", {
      requestId: rid
    });
    return missingEnv;
  }

  const stripeKey = requiredEnv("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    await reportServerEvent("error", "checkout_missing_stripe_key", {
      requestId: rid
    });
    return respond(500, {
      error: "Server missing STRIPE_SECRET_KEY.",
      code: "CHECKOUT_ENV_MISSING"
    });
  }

  const body = parseJsonBody<CheckoutBody>(event);
  const planKey = resolveRequestedPlan(body);
  if (!planKey) {
    return respond(400, {
      ok: false,
      error: "Invalid planKey. Use planKey: monthly_a or yearly.",
      code: "PLAN_KEY_INVALID"
    });
  }
  const siteLocale = normalizeSiteLocale(body.locale);
  const marketKey: MarketKey = resolveMarketFromSignals({
    locale: body.locale,
    country: body.country,
    currency: body.currency
  });
  const targetCurrency = String(body.currency || "").trim().toLowerCase() || currencyForMarket(marketKey);
  const resolvedPriceId = resolvePriceIdForPlan(planKey, marketKey);
  if (!resolvedPriceId) {
    const requiredName = requiredPriceEnvForPlan(planKey, marketKey);
    await reportServerEvent("error", "checkout_missing_price_mapping", {
      planKey,
      marketKey,
      requiredName,
      requestId: rid
    });

    return respond(500, {
      error: `Server missing price mapping for ${planKey}. Configure ${requiredName}.`,
      code: "PRICE_MAPPING_MISSING"
    });
  }

  const publicBaseUrl = requiredEnv("PUBLIC_BASE_URL");
  if (!publicBaseUrl) {
    await reportServerEvent("error", "checkout_missing_public_base_url", {
      requestId: rid
    });
    return respond(500, {
      error: "Server missing PUBLIC_BASE_URL.",
      code: "CHECKOUT_ENV_MISSING"
    });
  }

  const baseUrl = normalizeBaseUrl(publicBaseUrl);
  const trialDays = trialDaysFromEnv();
  const installId = String(body.installId || "").trim();
  const localizedBase = `${baseUrl}/${siteLocale}`;
  const checkoutLocale = stripeCheckoutLocale(siteLocale);

  const stripe = new Stripe(stripeKey, {
    apiVersion: "2025-02-24.acacia"
  });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      locale: checkoutLocale,
      payment_method_collection: "always",
      allow_promotion_codes: true,
      line_items: [
        {
          price: resolvedPriceId,
          quantity: 1
        }
      ],
      subscription_data: {
        trial_period_days: trialDays,
        metadata: {
          plan_key: planKey,
          install_id: installId,
          locale: siteLocale,
          market_key: marketKey,
          requested_currency: targetCurrency
        }
      },
      metadata: {
        plan_key: planKey,
        install_id: installId,
        locale: siteLocale,
        market_key: marketKey,
        requested_currency: targetCurrency
      },
      success_url: `${localizedBase}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${localizedBase}/billing/cancel`
    });

    if (!session.url) {
      await reportServerEvent("error", "checkout_session_missing_url", {
        planKey,
        requestId: rid
      });
      return respond(500, {
        error: "Stripe Checkout session returned no URL.",
        code: "CHECKOUT_URL_MISSING"
      });
    }

    await reportServerEvent("info", "checkout_session_created", {
      planKey,
      marketKey,
      locale: siteLocale,
      checkoutLocale,
      requestedCurrency: targetCurrency,
      trialDays,
      requestId: rid
    });

    return respond(200, {
      ok: true,
      url: session.url,
      planKey
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create checkout session";
    await reportServerEvent("error", "checkout_session_create_failed", {
      planKey,
      error: message,
      requestId: rid
    });

    const lower = message.toLowerCase();
    if (lower.includes("inactive")) {
      return respond(409, {
        ok: false,
        error: `Configured Stripe price is inactive for ${planKey}.`,
        code: "PRICE_INACTIVE"
      });
    }

    if (lower.includes("recurring price")) {
      return respond(409, {
        ok: false,
        error: `Configured Stripe price must be recurring for ${planKey}.`,
        code: "PRICE_NOT_RECURRING"
      });
    }

    return respond(502, {
      ok: false,
      error: "Unable to create checkout session",
      code: "CHECKOUT_CREATE_FAILED"
    });
  }
};
