import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceZip = path.resolve(__dirname, "../../extension/holmeta-extension.zip");
const downloadsDir = path.resolve(__dirname, "../public/downloads");
const targetZip = path.join(downloadsDir, "holmeta-extension.zip");
const minSizeBytes = 50 * 1024;

async function ensureValidSourceZip() {
  let sourceStats;

  try {
    sourceStats = await stat(sourceZip);
  } catch {
    throw new Error(
      "Missing extension zip at apps/extension/holmeta-extension.zip. Run npm -w @holmeta/extension run build first."
    );
  }

  if (sourceStats.size < minSizeBytes) {
    throw new Error(
      "Extension zip is too small (" + sourceStats.size + " bytes). Expected at least " + minSizeBytes + " bytes."
    );
  }
}

async function run() {
  await ensureValidSourceZip();
  await mkdir(downloadsDir, { recursive: true });
  await copyFile(sourceZip, targetZip);

  const copiedStats = await stat(targetZip);
  if (copiedStats.size < minSizeBytes) {
    throw new Error(
      "Copied zip is too small (" + copiedStats.size + " bytes). Build output is invalid."
    );
  }

  console.log("Prepared extension download: " + targetZip + " (" + copiedStats.size + " bytes)");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
