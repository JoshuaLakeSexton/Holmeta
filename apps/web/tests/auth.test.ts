import { describe, expect, it } from "vitest";
import { allowInlineLoginCode, loginCodeRateLimitPerHour } from "../netlify/functions/_lib/auth";

describe("auth configuration", () => {
  it("defaults to inline code only outside production", () => {
    expect(allowInlineLoginCode({ NODE_ENV: "development" })).toBe(true);
    expect(allowInlineLoginCode({ NODE_ENV: "production" })).toBe(false);
  });

  it("respects explicit flag controls", () => {
    expect(allowInlineLoginCode({ NODE_ENV: "development", HOLMETA_EXPOSE_LOGIN_CODE: "false" })).toBe(false);
    expect(allowInlineLoginCode({ NODE_ENV: "production", HOLMETA_EXPOSE_LOGIN_CODE: "true" })).toBe(false);
    expect(
      allowInlineLoginCode({
        NODE_ENV: "production",
        HOLMETA_EXPOSE_LOGIN_CODE: "true",
        HOLMETA_ALLOW_INLINE_LOGIN_CODE_IN_PROD: "true"
      })
    ).toBe(true);
  });

  it("normalizes login code rate limit to safe bounds", () => {
    expect(loginCodeRateLimitPerHour({ HOLMETA_LOGIN_CODE_MAX_PER_HOUR: "6" })).toBe(6);
    expect(loginCodeRateLimitPerHour({ HOLMETA_LOGIN_CODE_MAX_PER_HOUR: "0" })).toBe(1);
    expect(loginCodeRateLimitPerHour({ HOLMETA_LOGIN_CODE_MAX_PER_HOUR: "99" })).toBe(20);
    expect(loginCodeRateLimitPerHour({ HOLMETA_LOGIN_CODE_MAX_PER_HOUR: "abc" })).toBe(6);
  });
});
