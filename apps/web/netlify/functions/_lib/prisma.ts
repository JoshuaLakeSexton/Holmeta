import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var holmetaPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.holmetaPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.holmetaPrisma = prisma;
}
