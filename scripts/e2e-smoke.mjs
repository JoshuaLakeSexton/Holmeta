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
  const baseUrl = normalizeBaseUrl(
    argValue("--base") || process.env.PUBLIC_BASE_URL || process.env.HOLMETA_BASE_URL
  );
  const token = String(argValue("--token") || process.env.HOLMETA_DASHBOARD_TOKEN || "").trim();
  const email = String(argValue("--email") || process.env.HOLMETA_TEST_EMAIL || "").trim();
  const plan = String(argValue("--plan") || "monthly_a").trim().toLowerCase();
  const dryRun = hasFlag("--dry-run");

  assert(baseUrl, "Missing base URL. Use --base https://holmeta.com");
  const fn = (name) => `${baseUrl}/.netlify/functions/${name}`;

  console.log(`[1/4] Checking env flags at ${fn("env-check")}`);
  const envCheck = await requestJson(fn("env-check"));
  assert(envCheck.ok, `env-check failed: HTTP ${envCheck.status}`);
  assert(envCheck.data && typeof envCheck.data === "object", "env-check returned invalid JSON");
  assert(
    Boolean(envCheck.data.ok),
    `Missing required env vars: ${((envCheck.data && envCheck.data.missing) || []).join(", ") || JSON.stringify(envCheck.data)}`
  );
  console.log("env-check: ok");

  if (email) {
    console.log("[2/4] Requesting login code (email delivery test)");
    const loginRequest = await requestJson(fn("request-login-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    assert(loginRequest.ok, `request-login-code failed: HTTP ${loginRequest.status}`);
    console.log("request-login-code: ok");
  } else {
    console.log("[2/4] Skipping login-code request (no --email provided)");
  }

  if (token && !dryRun) {
    console.log("[3/4] Creating Stripe checkout session");
    const checkout = await requestJson(fn("create-checkout-session"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });
    assert(checkout.ok, `create-checkout-session failed: HTTP ${checkout.status}`);
    assert(checkout.data?.url, "create-checkout-session returned no url");
    console.log(`create-checkout-session: ok (${String(checkout.data.url).slice(0, 80)}...)`);
  } else {
    console.log("[3/4] Skipping checkout session (missing --token or --dry-run enabled)");
  }

  if (token) {
    console.log("[4/4] Fetching entitlement");
    const entitlement = await requestJson(fn("entitlement"), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    assert(entitlement.ok, `entitlement failed: HTTP ${entitlement.status}`);
    console.log(
      `entitlement: ok (status=${entitlement.data?.status || "unknown"}, entitled=${Boolean(
        entitlement.data?.entitled
      )})`
    );
  } else {
    console.log("[4/4] Skipping entitlement check (no --token provided)");
  }

  console.log("E2E smoke completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
