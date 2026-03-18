const PRISMA_STORE_UNAVAILABLE_CODES = new Set([
  "P1000", // auth failed
  "P1001", // can't reach DB
  "P1002", // timeout
  "P1017", // server closed connection
  "P2021", // table missing
  "P2022" // column missing
]);

export function prismaErrorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "";
  }
  return String((error as { code?: string }).code || "").trim();
}

export function isPrismaStoreUnavailable(error: unknown): boolean {
  const code = prismaErrorCode(error);
  return PRISMA_STORE_UNAVAILABLE_CODES.has(code);
}
