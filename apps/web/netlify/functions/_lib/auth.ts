function normalizeBooleanFlag(raw: string | null | undefined): boolean | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) {
    return null;
  }

  if (["1", "true", "yes", "on"].includes(value)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(value)) {
    return false;
  }

  return null;
}

export function allowInlineLoginCode(env: Record<string, string | undefined> = process.env): boolean {
  const forced = normalizeBooleanFlag(env.HOLMETA_EXPOSE_LOGIN_CODE);
  const production = String(env.NODE_ENV || "").toLowerCase() === "production";

  if (forced === true) {
    if (!production) {
      return true;
    }

    const prodAllow = normalizeBooleanFlag(env.HOLMETA_ALLOW_INLINE_LOGIN_CODE_IN_PROD);
    return prodAllow === true;
  }

  if (forced === false) {
    return false;
  }

  return !production;
}

export function loginCodeRateLimitPerHour(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.HOLMETA_LOGIN_CODE_MAX_PER_HOUR || "6");
  if (!Number.isFinite(raw)) {
    return 6;
  }

  return Math.min(20, Math.max(1, Math.round(raw)));
}
