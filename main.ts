// news-image-20261119, entry 3 — "The World Tonight", a dark navy + gold night
// poster of Thursday 19 November 2026: 43 stories across 7 regions, 3 hero
// scenes (GTA VI launch, the APEC trilateral in Shenzhen, Anthropic's record
// IPO), a dotted world map with 10 numbered pins, and 40 numbered briefs.
//
// The poster is drawn ahead of time by work/gen3.py and shipped as entry.png;
// this program only copies it to the output directory. It runs with no
// network and writes the same bytes on every run.
//
// Run locally:  MAKEFUN_OUTPUT_DIR=out node main.ts
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "entry.png");
const dst = join(outDir, "entry.png");

if (!existsSync(src)) {
  throw new Error("entry.png not found next to main.ts");
}
// The shipped file must be a whole PNG: check its 8-byte signature first.
const head = readFileSync(src).subarray(0, 8);
const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
if (!head.equals(pngSig)) {
  throw new Error("entry.png is not a PNG file");
}
mkdirSync(outDir, { recursive: true });
copyFileSync(src, dst);
console.log(`wrote ${dst} (${statSync(dst).size} bytes)`);
