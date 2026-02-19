import type { User } from "@prisma/client";
import { prisma } from "./prisma";

export function normalizeEmail(raw: string): string {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

export async function getOrCreateUserByEmail(rawEmail: string): Promise<User | null> {
  const email = normalizeEmail(rawEmail);
  if (!email || !email.includes("@")) {
    return null;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: { email }
  });
}
