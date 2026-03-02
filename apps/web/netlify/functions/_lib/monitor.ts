export type MonitorLevel = "info" | "warn" | "error";

type MonitorEvent = {
  event: string;
  level: MonitorLevel;
  timestamp: string;
  details?: Record<string, unknown>;
};

function webhookUrl(): string {
  return String(process.env.HOLMETA_MONITOR_WEBHOOK_URL || "").trim();
}

function compact(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (typeof value === "string") {
    return value.length > 1200 ? `${value.slice(0, 1200)}…` : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => compact(item));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[key] = compact(val);
    }
    return out;
  }

  return value;
}

export async function reportServerEvent(
  level: MonitorLevel,
  event: string,
  details?: Record<string, unknown>
): Promise<void> {
  const payload: MonitorEvent = {
    event,
    level,
    timestamp: new Date().toISOString(),
    details: details ? (compact(details) as Record<string, unknown>) : undefined
  };

  const line = `[monitor:${level}] ${event}`;
  if (level === "error") {
    console.error(line, payload.details || {});
  } else if (level === "warn") {
    console.warn(line, payload.details || {});
  } else {
    console.log(line, payload.details || {});
  }

  const url = webhookUrl();
  if (!url) {
    return;
  }

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    console.error("[monitor:error] monitor_webhook_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
