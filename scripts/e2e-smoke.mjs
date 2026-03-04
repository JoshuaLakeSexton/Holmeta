#!/usr/bin/env node
/* eslint-disable no-console */

function argValue(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return String(process.argv[index + 1] || fallback);
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function normalizeBaseUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) {
    return "";
  }
  return value.replace(/\/$/, "");
}

async function requestJson(url, init = {}) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const baseUrl = normalizeBaseUrl(argValue("--base") || process.env.PUBLIC_BASE_URL || process.env.HOLMETA_BASE_URL);
  const planKey = String(argValue("--plan") || "monthly_a").trim().toLowerCase();
  const runAllPlans = hasFlag("--all-plans");
  const installId = String(argValue("--install-id") || "smoke-install").trim();
  const sessionId = String(argValue("--session-id") || process.env.HOLMETA_CHECKOUT_SESSION_ID || "").trim();
  const licenseKey = String(argValue("--license") || process.env.HOLMETA_LICENSE_KEY || "").trim();
  const dryRun = hasFlag("--dry-run");

  assert(baseUrl, "Missing base URL. Use --base https://holmeta.com");
  const fn = (name) => `${baseUrl}/.netlify/functions/${name}`;
  const plans = runAllPlans ? ["monthly_a", "yearly"] : [planKey];

  console.log(`[1/4] Checking env flags at ${fn("env-check")}`);
  const envCheck = await requestJson(fn("env-check"));
  assert(envCheck.ok, `env-check failed: HTTP ${envCheck.status}`);
  assert(envCheck.data && typeof envCheck.data === "object", "env-check returned invalid JSON");
  assert(Boolean(envCheck.data.ok), `Missing required env vars: ${((envCheck.data && envCheck.data.missing) || []).join(", ")}`);
  console.log("env-check: ok");

  console.log("[2/4] Creating checkout session");
  for (const selectedPlan of plans) {
    const checkout = await requestJson(fn("create-checkout-session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ planKey: selectedPlan, installId })
    });
    assert(checkout.ok, `create-checkout-session failed for ${selectedPlan}: HTTP ${checkout.status}`);
    assert(checkout.data?.url, `create-checkout-session returned no url for ${selectedPlan}`);
    console.log(`${selectedPlan}: ok (${String(checkout.data.url).slice(0, 100)}...)`);
  }

  if (!sessionId) {
    console.log("[3/4] Skipping get-license (no --session-id provided)");
    console.log("Complete checkout in Stripe, then rerun with --session-id=<CHECKOUT_SESSION_ID>.");
  } else {
    console.log("[3/4] Fetching one-time license from success session");
    const getLicense = await requestJson(`${fn("get-license")}?session_id=${encodeURIComponent(sessionId)}`);
    assert(getLicense.ok, `get-license failed: HTTP ${getLicense.status}`);
    assert(getLicense.data?.licenseKey, "get-license returned no licenseKey");
    console.log("get-license: ok");
  }

  if (!licenseKey || dryRun) {
    console.log("[4/4] Skipping validate-license (no --license provided or --dry-run)");
  } else {
    console.log("[4/4] Validating license");
    const validation = await requestJson(fn("validate-license"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ licenseKey, installId })
    });

    assert(validation.ok, `validate-license failed: HTTP ${validation.status}`);
    assert(validation.data && typeof validation.data === "object", "validate-license returned invalid JSON");
    assert(Boolean(validation.data.valid), `validate-license returned invalid: ${JSON.stringify(validation.data)}`);
    console.log(
      `validate-license: ok (status=${String(validation.data.status || "unknown")}, plan=${String(validation.data.plan || "none")})`
    );
  }

  console.log("E2E smoke completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
