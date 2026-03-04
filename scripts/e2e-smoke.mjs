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

async function requestBinary(url, init = {}) {
  const response = await fetch(url, init);
  const arrayBuffer = await response.arrayBuffer();
  return {
    ok: response.ok,
    status: response.status,
    contentType: response.headers.get("content-type") || "",
    contentLength: Number(response.headers.get("content-length") || 0),
    bytes: arrayBuffer.byteLength
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

  console.log(`[1/5] Checking env flags at ${fn("env-check")}`);
  const envCheck = await requestJson(fn("env-check"));
  assert(envCheck.ok, `env-check failed: HTTP ${envCheck.status}`);
  assert(envCheck.data && typeof envCheck.data === "object", "env-check returned invalid JSON");
  assert(Boolean(envCheck.data.ok), `Missing required env vars: ${((envCheck.data && envCheck.data.missing) || []).join(", ")}`);
  console.log("env-check: ok");

  console.log("[2/5] Creating checkout session");
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
    console.log("[3/5] Skipping get-license (no --session-id provided)");
    console.log("Complete checkout in Stripe, then rerun with --session-id=<CHECKOUT_SESSION_ID>.");
  } else {
    console.log("[3/5] Fetching one-time license from success session");
    const getLicense = await requestJson(`${fn("get-license")}?session_id=${encodeURIComponent(sessionId)}`);
    const alreadyRevealed = getLicense.status === 409 && getLicense.data?.error === "already_revealed";
    assert(getLicense.ok || alreadyRevealed, `get-license failed: HTTP ${getLicense.status}`);
    if (alreadyRevealed) {
      console.log("get-license: already revealed (acceptable for reused session)");
    } else {
      assert(getLicense.data?.licenseKey, "get-license returned no licenseKey");
      console.log("get-license: ok");
    }
  }

  if (!licenseKey || dryRun) {
  console.log("[4/5] Skipping validate-license (no --license provided or --dry-run)");
  } else {
    console.log("[4/5] Validating license");
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

  if (dryRun || (!sessionId && !licenseKey)) {
    console.log("[5/5] Skipping gated download check (missing --session-id/--license or --dry-run)");
  } else {
    const query = sessionId
      ? `session_id=${encodeURIComponent(sessionId)}`
      : `license=${encodeURIComponent(licenseKey)}`;

    console.log("[5/5] Verifying gated extension download endpoint");
    const download = await requestBinary(`${fn("download-extension")}?${query}`, {
      method: "GET"
    });

    assert(download.ok, `download-extension failed: HTTP ${download.status}`);
    assert(download.bytes > 50 * 1024, `download-extension returned small payload: ${download.bytes} bytes`);
    assert(
      String(download.contentType || "").toLowerCase().includes("zip"),
      `download-extension content-type not zip: ${download.contentType || "(none)"}`
    );
    console.log(`download-extension: ok (${download.bytes} bytes)`);
  }

  console.log("E2E smoke completed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
