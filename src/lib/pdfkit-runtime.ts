import fs from "node:fs";
import path from "node:path";

const PDFKIT_DATA_DIR = path.join(process.cwd(), "node_modules", "pdfkit", "js", "data");
const PDFKIT_SENTINEL = path.join(PDFKIT_DATA_DIR, "Helvetica.afm");

let installed = false;

function remapPdfKitAssetPath(targetPath: string) {
  if (!targetPath.includes("pdfkit") || !targetPath.includes("/data/")) {
    return null;
  }

  const fileName = path.basename(targetPath);
  const fallbackPath = path.join(PDFKIT_DATA_DIR, fileName);
  return fs.existsSync(fallbackPath) ? fallbackPath : null;
}

export function ensurePdfKitAssetFallbackInstalled() {
  if (installed || !fs.existsSync(PDFKIT_SENTINEL)) {
    return;
  }

  const originalReadFileSync = fs.readFileSync.bind(fs);

  fs.readFileSync = ((targetPath: fs.PathOrFileDescriptor, ...args: unknown[]) => {
    if (typeof targetPath === "string") {
      const fallbackPath = remapPdfKitAssetPath(targetPath);
      if (fallbackPath) {
        return originalReadFileSync(fallbackPath, ...(args as []));
      }
    }

    return originalReadFileSync(targetPath, ...(args as []));
  }) as typeof fs.readFileSync;

  installed = true;
}
