import crypto from "node:crypto";
import type { HandlerEvent } from "@netlify/functions";

export type TokenScope = "dashboard" | "extension";

export interface TokenClaims {
  sub: string;
  scope: TokenScope;
  email?: string;
  tokenId?: string;
  iat: number;
  exp: number;
}

function secret(): string {
  const configured = process.env.APP_JWT_SECRET || "";
  if (configured) {
    return configured;
  }
  return "holmeta-dev-secret-change-me";
}

function base64url(input: Buffer | string): string {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  return source
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseBase64url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, "base64");
}

function signHmac(data: string): string {
  return base64url(crypto.createHmac("sha256", secret()).update(data).digest());
}

function buildToken(payload: Omit<TokenClaims, "iat" | "exp">, ttlSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(
    JSON.stringify({
      ...payload,
      iat: now,
      exp: now + Math.max(60, ttlSeconds)
    })
  );
  const signature = signHmac(`${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export function signDashboardToken(userId: string, email: string): string {
  return buildToken(
    {
      sub: userId,
      scope: "dashboard",
      email
    },
    7 * 24 * 60 * 60
  );
}

export function signExtensionToken(userId: string, tokenId: string): string {
  return buildToken(
    {
      sub: userId,
      scope: "extension",
      tokenId
    },
    180 * 24 * 60 * 60
  );
}

export function verifyToken(token: string): TokenClaims | null {
  const raw = String(token || "").trim();
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expected = signHmac(`${header}.${body}`);
  if (signature !== expected) {
    return null;
  }

  try {
    const payload = JSON.parse(parseBase64url(body).toString("utf8")) as TokenClaims;
    if (!payload?.sub || !payload?.scope || !payload?.exp) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function bearerToken(event: HandlerEvent): string {
  const header = event.headers.authorization || event.headers.Authorization || "";
  const [scheme, token] = String(header).split(" ");
  if (!/^bearer$/i.test(scheme || "")) {
    return "";
  }
  return token || "";
}

export function requireToken(event: HandlerEvent, scopes?: TokenScope[]): TokenClaims | null {
  const token = bearerToken(event);
  const claims = verifyToken(token);
  if (!claims) {
    return null;
  }
  if (Array.isArray(scopes) && scopes.length && !scopes.includes(claims.scope)) {
    return null;
  }
  return claims;
}
