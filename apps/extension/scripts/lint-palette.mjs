#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const allowedHex = new Set([
  "#14110F",
  "#34312D",
  "#C42021",
  "#D9C5B2",
  "#FFB300",
  "#F3F3F4"
]);

const cssDir = path.resolve(process.cwd(), "src");
const files = (await readdir(cssDir))
  .filter((name) => name.endsWith(".css"))
  .map((name) => path.join(cssDir, name));

const hexRegex = /#[0-9a-fA-F]{3,8}\b/g;
const issues = [];

function normalizeHex(raw) {
  const value = raw.toUpperCase();

  if (value.length === 4) {
    const r = value[1];
    const g = value[2];
    const b = value[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (value.length === 7) {
    return value;
  }

  return value;
}

for (const file of files) {
  const text = await readFile(file, "utf8");
  let match;

  while ((match = hexRegex.exec(text))) {
    const raw = match[0];
    const normalized = normalizeHex(raw);
    const index = match.index;
    const line = text.slice(0, index).split("\n").length;

    if (normalized.length !== 7 || !allowedHex.has(normalized)) {
      issues.push({
        file,
        line,
        color: raw
      });
    }
  }
}

if (issues.length > 0) {
  console.error("Palette lint failed. Only the approved six hex colors are allowed in src/*.css:");
  for (const item of issues) {
    console.error(`- ${item.file}:${item.line} uses ${item.color}`);
  }
  process.exit(1);
}

console.log(`Palette lint passed for ${files.length} CSS file(s).`);
