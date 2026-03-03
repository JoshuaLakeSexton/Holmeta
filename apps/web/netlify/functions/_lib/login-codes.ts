import crypto from "node:crypto";

function readSecret(): string {
  const configured = String(process.env.APP_JWT_SECRET || "").trim();
  if (configured) {
    return configured;
  }
  return "holmeta-dev-secret-change-me";
}

function hmac(input: string): Buffer {
  return crypto.createHmac("sha256", readSecret()).update(input).digest();
}

export function hashLoginCode(email: string, code: string): string {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCode = String(code || "").trim();
  const payload = `${normalizedEmail}:${normalizedCode}`;
  return hmac(payload).toString("hex");
}

export function compareLoginCodeHash(email: string, code: string, expectedHash: string): boolean {
  const expected = String(expectedHash || "").trim();
  if (!expected) {
    return false;
  }

  const incoming = hashLoginCode(email, code);
  const expectedBuffer = Buffer.from(expected, "hex");
  const incomingBuffer = Buffer.from(incoming, "hex");
  if (expectedBuffer.length !== incomingBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuffer, incomingBuffer);
}
