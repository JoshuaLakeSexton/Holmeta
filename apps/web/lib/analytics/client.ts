const ENDPOINT = "/.netlify/functions/client-event";
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== "false";

export type EventProps = Record<string, string | number | boolean | null | undefined>;

export async function trackEvent(name: string, props: EventProps = {}): Promise<void> {
  if (!ENABLED || typeof window === "undefined") {
    return;
  }

  const payload = {
    name,
    props,
    path: window.location.pathname,
    locale: window.location.pathname.split("/").filter(Boolean)[0] || "en",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : ""
  };

  try {
    await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      keepalive: true
    });
  } catch {
    // Analytics is best-effort; avoid user-facing failures.
  }
}
