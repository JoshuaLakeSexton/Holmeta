import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomFromAlphabet(length: number): string {
  const bytes = crypto.randomBytes(length);
  let output = "";
  for (let i = 0; i < length; i += 1) {
    output += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return output;
}

export function generatePairingCode(): string {
  return `HM-${randomFromAlphabet(6)}`;
}

export function normalizePairingCode(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase();
}

export function generateLoginCode(): string {
  const min = 100000;
  const max = 999999;
  const num = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(num);
}
