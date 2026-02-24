import archiver from "archiver";
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionBuildDir = path.resolve(__dirname, "../apps/extension/dist/extension");
const extensionZipPath = path.resolve(__dirname, "../apps/extension/holmeta-extension.zip");
const webDownloadsDir = path.resolve(__dirname, "../apps/web/public/downloads");
const webZipPath = path.join(webDownloadsDir, "holmeta-extension.zip");
const minBytes = 50 * 1024;

async function ensureBuildDir() {
  try {
    await access(extensionBuildDir);
  } catch {
    throw new Error(
      "Missing apps/extension/dist/extension. Run `npm --prefix apps/extension run build` first."
    );
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
    archive.directory(extensionBuildDir, "extension");
    archive.finalize();
  });
}

async function verifyAndCopy() {
  const zipStats = await stat(extensionZipPath);
  if (zipStats.size < minBytes) {
    throw new Error(
      "Generated extension zip is unexpectedly small (" + zipStats.size + " bytes)."
    );
  }

  await mkdir(webDownloadsDir, { recursive: true });
  await copyFile(extensionZipPath, webZipPath);

  const copiedStats = await stat(webZipPath);
  if (copiedStats.size < minBytes) {
    throw new Error(
      "Copied web download zip is unexpectedly small (" + copiedStats.size + " bytes)."
    );
  }

  console.log("Extension zip ready: " + extensionZipPath + " (" + zipStats.size + " bytes)");
  console.log("Web download zip synced: " + webZipPath + " (" + copiedStats.size + " bytes)");
}

async function run() {
  await ensureBuildDir();
  await createZip();
  await verifyAndCopy();
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
