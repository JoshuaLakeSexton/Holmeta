#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const result = spawnSync("npm", ["-w", "@holmeta/web", "run", "prisma:dbpush"], {
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log("Neon schema migration (prisma db push) completed.");
