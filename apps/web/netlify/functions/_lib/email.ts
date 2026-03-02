type LoginEmailInput = {
  to: string;
  code: string;
  expiresAt: Date;
};

type SendResult = {
  ok: boolean;
  provider: "resend";
  error?: string;
};

function configured(name: string): string {
  return String(process.env[name] || "").trim();
}

function minutesUntil(date: Date): number {
  return Math.max(1, Math.ceil((date.getTime() - Date.now()) / (60 * 1000)));
}

export function hasEmailDeliveryConfig(): boolean {
  return Boolean(configured("RESEND_API_KEY") && configured("HOLMETA_EMAIL_FROM"));
}

export async function sendLoginCodeEmail(input: LoginEmailInput): Promise<SendResult> {
  const apiKey = configured("RESEND_API_KEY");
  const from = configured("HOLMETA_EMAIL_FROM");

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "resend",
      error: "Missing RESEND_API_KEY or HOLMETA_EMAIL_FROM"
    };
  }

  const ttl = minutesUntil(input.expiresAt);
  const subject = `holmeta sign-in code: ${input.code}`;
  const text = [
    "Your holmeta account code",
    "",
    `Code: ${input.code}`,
    `Expires in: ${ttl} minute${ttl === 1 ? "" : "s"}`,
    "",
    "If you did not request this, ignore this message."
  ].join("\n");

  const html = [
    "<div style=\"font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; color: #14110F;\">",
    "<p>Your holmeta account code</p>",
    `<p style=\"font-size: 22px; font-weight: 700; letter-spacing: 0.08em; margin: 12px 0;\">${input.code}</p>`,
    `<p>Expires in ${ttl} minute${ttl === 1 ? "" : "s"}.</p>`,
    "<p>If you did not request this, ignore this message.</p>",
    "</div>"
  ].join("");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject,
        text,
        html
      })
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        provider: "resend",
        error: detail || `HTTP ${response.status}`
      };
    }

    return {
      ok: true,
      provider: "resend"
    };
  } catch (error) {
    return {
      ok: false,
      provider: "resend",
      error: error instanceof Error ? error.message : "unknown"
    };
  }
}
