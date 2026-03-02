"use client";

import { useEffect } from "react";

const MAX_EVENTS_PER_PAGE = 6;
const ENABLED = process.env.NEXT_PUBLIC_ENABLE_CLIENT_MONITORING !== "false";
const ENDPOINT = "/.netlify/functions/client-error";

type MonitorPayload = {
  type: string;
  message: string;
  stack?: string;
  source?: string;
};

function sendClientError(payload: MonitorPayload): void {
  const body = JSON.stringify({
    ...payload,
    path: typeof window !== "undefined" ? window.location.pathname : "",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : ""
  });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    } catch {
      // Fallback to fetch below.
    }
  }

  fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  }).catch(() => {
    // Monitoring is best-effort and must never break UX.
  });
}

export function ClientMonitor() {
  useEffect(() => {
    if (!ENABLED) {
      return;
    }

    let sent = 0;
    const seen = new Set<string>();

    const emit = (payload: MonitorPayload) => {
      if (sent >= MAX_EVENTS_PER_PAGE) {
        return;
      }

      const key = `${payload.type}:${payload.message}`;
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      sent += 1;
      sendClientError(payload);
    };

    const onError = (event: ErrorEvent) => {
      emit({
        type: "window.error",
        message: String(event.message || "unknown"),
        stack: event.error?.stack || "",
        source: event.filename || ""
      });
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "Unhandled rejection";

      emit({
        type: "window.unhandledrejection",
        message,
        stack: reason instanceof Error ? reason.stack : ""
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
