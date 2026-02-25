import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const ROOTS = ["apps", "packages"];
const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", "dist"]);

const BAD_PATTERNS = [
  /"content_scripts"\s*:/,
  /"matches"\s*:\s*\[/,
  /"js"\s*:\s*\[/,
  /"permissions"\s*:\s*\[/
];

const JSON_KEY_LINE = /^\s*"[^"]+"\s*:\s*/;

async function walk(dir, out) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await walk(full, out);
      continue;
    }

    if (entry.isFile() && full.endsWith(".css")) {
      out.push(full);
    }
  }
}

async function main() {
  const cssFiles = [];
  for (const root of ROOTS) {
    await walk(path.join(repoRoot, root), cssFiles);
  }

  const errors = [];

  for (const file of cssFiles) {
    const raw = await readFile(file, "utf8");
    const lines = raw.split(/\r?\n/);

    lines.forEach((line, index) => {
      const n = index + 1;
      if (JSON_KEY_LINE.test(line.trimStart()) && BAD_PATTERNS.some((rx) => rx.test(line))) {
        errors.push(`${path.relative(repoRoot, file)}:${n} appears to contain manifest JSON in CSS`);
      }
      if (BAD_PATTERNS.some((rx) => rx.test(line))) {
        errors.push(`${path.relative(repoRoot, file)}:${n} contains forbidden token: ${line.trim()}`);
      }
    });
  }

  if (errors.length) {
    console.error("CSS integrity check failed:\n" + errors.join("\n"));
    process.exit(1);
  }

  console.log(`CSS integrity check passed for ${cssFiles.length} file(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
