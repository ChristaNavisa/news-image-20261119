import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Entry 2 for news-image-20261119: the front page is drawn ahead of time and
// shipped as entry.png; this program copies it to the output directory.
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "out";
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "entry.png");
const dst = join(outDir, "entry.png");

if (!existsSync(src)) {
  throw new Error("entry.png not found next to main.ts");
}
// Sanity check: the shipped file must be a PNG (first 8 signature bytes).
const head = readFileSync(src).subarray(0, 8);
const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!head.equals(pngSig)) {
  throw new Error("entry.png is not a PNG file");
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, dst);
console.log(`wrote ${dst} (${statSync(dst).size} bytes)`);
