import { describe, expect, it } from "vitest";
import { browserFamilyForType, detectBrowserFromUserAgent } from "../lib/browser";

describe("browser detection", () => {
  it("detects major browser user agents", () => {
    expect(
      detectBrowserFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      )
    ).toBe("chrome");

    expect(
      detectBrowserFromUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edg/123.0.0.0 Safari/537.36"
      )
    ).toBe("edge");

    expect(
      detectBrowserFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13.0; rv:122.0) Gecko/20100101 Firefox/122.0"
      )
    ).toBe("firefox");

    expect(
      detectBrowserFromUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
      )
    ).toBe("safari");
  });

  it("maps browser types to expected families", () => {
    expect(browserFamilyForType("chrome")).toBe("chromium");
    expect(browserFamilyForType("edge")).toBe("chromium");
    expect(browserFamilyForType("firefox")).toBe("firefox");
    expect(browserFamilyForType("safari")).toBe("safari");
    expect(browserFamilyForType("unknown")).toBe("unknown");
  });
});
