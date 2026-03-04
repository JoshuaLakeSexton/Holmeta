import archiver from "archiver";
import { spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const extensionBuildDir = path.resolve(repoRoot, "apps/extension/dist/extension");
const extensionZipPath = path.resolve(repoRoot, "apps/extension/holmeta-extension.zip");
const functionAssetsDir = path.resolve(repoRoot, "apps/web/netlify/functions/assets");
const functionZipPath = path.join(functionAssetsDir, "holmeta-extension.zip");
const legacyPublicZipPath = path.resolve(repoRoot, "apps/web/public/downloads/holmeta-extension.zip");

const minBytes = 20 * 1024;

function run(cmd, args, cwd = repoRoot) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32"
  });

  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed with exit code ${result.status ?? 1}`);
  }
}

async function ensureBuildDir() {
  try {
    await access(extensionBuildDir);
  } catch {
    throw new Error("Missing apps/extension/dist/extension after build.");
  }
}

async function createZip() {
  await rm(extensionZipPath, { force: true });

  await new Promise((resolve, reject) => {
    const out = createWriteStream(extensionZipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    out.on("close", resolve);
    out.on("error", reject);
    archive.on("error", reject);

    archive.pipe(out);
    archive.directory(extensionBuildDir, false);
    archive.finalize();
  });
}

async function verifyZip(zipPath) {
  const fileStats = await stat(zipPath);
  if (fileStats.size < minBytes) {
    throw new Error(`Zip too small (${fileStats.size} bytes): ${zipPath}`);
  }
  return fileStats.size;
}

async function main() {
  run("npm", ["--prefix", "apps/extension", "run", "build"]);
  await ensureBuildDir();
  await createZip();
  const builtBytes = await verifyZip(extensionZipPath);

  await mkdir(functionAssetsDir, { recursive: true });
  await copyFile(extensionZipPath, functionZipPath);
  const copiedBytes = await verifyZip(functionZipPath);

  // Ensure public direct download is removed; download must go through gated function.
  await rm(legacyPublicZipPath, { force: true });

  console.log(`Extension zip rebuilt: ${path.relative(repoRoot, extensionZipPath)} (${builtBytes} bytes)`);
  console.log(`Function asset synced: ${path.relative(repoRoot, functionZipPath)} (${copiedBytes} bytes)`);
  console.log(`Public zip removed: ${path.relative(repoRoot, legacyPublicZipPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
