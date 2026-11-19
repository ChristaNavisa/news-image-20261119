// main.ts — "The world in one picture: Thursday 19 November 2026"
//
// Draws a dark-gold night poster with a neon Vice City hero scene and six
// story panels, then writes it as a deterministic PNG to /output/entry.png.
//
// Node 22 standard library only: no network, no dependencies, no clock,
// no randomness. Two runs produce byte-identical output.
//
// Stories (all happened or first reported on Thursday 19 November 2026):
//   HERO  Grand Theft Auto VI launches worldwide — back to Vice City
//   1     Trump, Xi and Putin hold trilateral talks in Shenzhen (APEC)
//   2     US and Iran trade fire across the Gulf (Kuwait, Bahrain hit)
//   3     Hakeem Jeffries nominated — first Black Speaker of the US House
//   4     Cyclone Akvan slams India's east coast (90-110 km/h winds)
//   5     Voyager 1 reaches one light-day from Earth (NASA confirms today)
//   6     Pew: Islam set to become the world's largest faith by 2035

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const W = 1024;
const H = 1024;

type RGB = [number, number, number];

function hex(s: string): RGB {
  return [
    parseInt(s.slice(1, 3), 16),
    parseInt(s.slice(3, 5), 16),
    parseInt(s.slice(5, 7), 16),
  ];
}

function lerp(a: RGB, b: RGB, t: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Deterministic PRNG (mulberry32) with a fixed seed — same output every run.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- canvas

class Canvas {
  data = new Uint8Array(W * H * 3);

  set(x: number, y: number, c: RGB): void {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || xi >= W || yi < 0 || yi >= H) return;
    const i = (yi * W + xi) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }

  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = c[0];
      this.data[i * 3 + 1] = c[1];
      this.data[i * 3 + 2] = c[2];
    }
  }

  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(W, Math.round(x + w));
    const y1 = Math.min(H, Math.round(y + h));
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * W + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.data[i] = c[0];
        this.data[i + 1] = c[1];
        this.data[i + 2] = c[2];
        i += 3;
      }
    }
  }

  // Vertical gradient between stops [0..1, colour].
  vgrad(y0: number, y1: number, stops: Array<[number, RGB]>): void {
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      const t = (y - y0) / (y1 - y0);
      let c = stops[stops.length - 1][1];
      for (let s = 0; s < stops.length - 1; s++) {
        const [t0, c0] = stops[s];
        const [t1, c1] = stops[s + 1];
        if (t >= t0 && t <= t1) {
          c = lerp(c0, c1, (t - t0) / (t1 - t0));
          break;
        }
      }
      this.fillRect(0, y, W, 1, c);
    }
  }

  gradColorAt(y: number, y0: number, y1: number, stops: Array<[number, RGB]>): RGB {
    const t = Math.min(1, Math.max(0, (y - y0) / (y1 - y0)));
    for (let s = 0; s < stops.length - 1; s++) {
      const [t0, c0] = stops[s];
      const [t1, c1] = stops[s + 1];
      if (t >= t0 && t <= t1) return lerp(c0, c1, (t - t0) / (t1 - t0));
    }
    return stops[stops.length - 1][1];
  }

  circle(cx: number, cy: number, r: number, c: RGB): void {
    const r2 = r * r;
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(W - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(H - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) this.set(x, y, c);
      }
    }
  }

  // Thick line: stamp discs along the segment.
  line(x0: number, y0: number, x1: number, y1: number, w: number, c: RGB): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(len));
    const r = Math.max(0.5, w / 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + dx * t, y0 + dy * t, r, c);
    }
  }

  polyline(pts: Array<[number, number]>, w: number, c: RGB): void {
    for (let i = 0; i < pts.length - 1; i++) {
      this.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w, c);
    }
  }

  // Filled polygon (scanline).
  poly(pts: Array<[number, number]>, c: RGB): void {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        this.fillRect(xs[k], y, xs[k + 1] - xs[k], 1, c);
      }
    }
  }

  // Arc polyline, angles in radians.
  arc(cx: number, cy: number, r: number, a0: number, a1: number, w: number, c: RGB): void {
    const pts: Array<[number, number]> = [];
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) * r / 4));
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    this.polyline(pts, w, c);
  }

  // Quadratic bezier sampled as a polyline.
  quad(p0: [number, number], p1: [number, number], p2: [number, number], w: number, c: RGB): void {
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const u = 1 - t;
      pts.push([
        u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
        u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
      ]);
    }
    this.polyline(pts, w, c);
  }

  rectOutline(x: number, y: number, w: number, h: number, c: RGB): void {
    this.fillRect(x, y, w, 1, c);
    this.fillRect(x, y + h - 1, w, 1, c);
    this.fillRect(x, y, 1, h, c);
    this.fillRect(x + w - 1, y, 1, h, c);
  }
}

// ------------------------------------------------------------- PNG encode

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const rowBytes = W * 3;
  const raw = Buffer.alloc(H * (rowBytes + 1));
  const prev = Buffer.alloc(rowBytes);
  const cur = Buffer.from(cv.data.buffer, cv.data.byteOffset, cv.data.byteLength);
  for (let y = 0; y < H; y++) {
    const row = cur.subarray(y * rowBytes, (y + 1) * rowBytes);
    // Try filters 0..4, keep the one with the smallest sum of |signed byte|.
    let bestType = 0;
    let bestScore = Infinity;
    let bestRow: Buffer | null = null;
    for (let f = 0; f <= 4; f++) {
      const filtered = Buffer.alloc(rowBytes);
      let score = 0;
      for (let x = 0; x < rowBytes; x++) {
        const left = x >= 3 ? row[x - 3] : 0;
        const up = prev[x];
        const upLeft = x >= 3 ? prev[x - 3] : 0;
        let pred = 0;
        if (f === 1) pred = left;
        else if (f === 2) pred = up;
        else if (f === 3) pred = (left + up) >> 1;
        else if (f === 4) {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        }
        const v = (row[x] - pred) & 0xff;
        filtered[x] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) {
        bestScore = score;
        bestType = f;
        bestRow = filtered;
      }
    }
    raw[y * (rowBytes + 1)] = bestType;
    (bestRow as Buffer).copy(raw, y * (rowBytes + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------ stroke font
//
// Single-stroke capitals on a 5-wide x 7-tall grid (x 0..4, y 0..6,
// descender to y 7). Each glyph is strokes separated by "|", points by
// spaces, coordinates by commas. Written for this poster; cap height is
// 6/7 of the requested size, advance is 6/7 of the size.

const FONT: Record<string, string> = {
  A: "0,6 2,0 4,6|1,4 3,4",
  B: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|3,3 4,4 4,5 3,6 0,6",
  C: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5",
  D: "0,6 0,0 3,0 4,1 4,5 3,6 0,6",
  E: "4,0 0,0 0,6 4,6|0,3 3,3",
  F: "0,6 0,0 4,0|0,3 3,3",
  G: "4,1 3,0 1,0 0,1 0,5 1,6 3,6 4,5 4,3 2,3",
  H: "0,0 0,6|4,0 4,6|0,3 4,3",
  I: "2,0 2,6|1,0 3,0|1,6 3,6",
  J: "4,0 4,5 3,6 1,6 0,5",
  K: "0,0 0,6|4,0 0,3 4,6",
  L: "0,0 0,6 4,6",
  M: "0,6 0,0 2,3 4,0 4,6",
  N: "0,6 0,0 4,6 4,0",
  O: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0",
  P: "0,6 0,0 3,0 4,1 4,2 3,3 0,3",
  Q: "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|3,4 4,6",
  R: "0,6 0,0 3,0 4,1 4,2 3,3 0,3|2,3 4,6",
  S: "4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5",
  T: "0,0 4,0|2,0 2,6",
  U: "0,0 0,5 1,6 3,6 4,5 4,0",
  V: "0,0 2,6 4,0",
  W: "0,0 0,6 2,3 4,6 4,0",
  X: "0,0 4,6|4,0 0,6",
  Y: "0,0 2,3 4,0|2,3 2,6",
  Z: "0,0 4,0 0,6 4,6",
  "0": "1,0 3,0 4,1 4,5 3,6 1,6 0,5 0,1 1,0|3,1 1,5",
  "1": "1,1 2,0 2,6|0,6 3,6",
  "2": "0,1 1,0 3,0 4,1 4,2 0,6 4,6",
  "3": "0,1 1,0 3,0 4,1 4,2 3,3 2,3|3,3 4,4 4,5 3,6 1,6 0,5",
  "4": "0,0 0,3 4,3|3,0 3,6",
  "5": "4,0 0,0 0,3 3,3 4,4 4,5 3,6 1,6 0,5",
  "6": "3,0 1,0 0,2 0,5 1,6 3,6 4,5 4,3 3,2 1,2 0,3",
  "7": "0,0 4,0 2,6",
  "8": "1,0 3,0 4,1 4,2 3,3 1,3 0,2 0,1 1,0|1,3 3,3 4,4 4,5 3,6 1,6 0,5 0,4 1,3",
  "9": "0,5 1,6 3,6 4,5 4,1 3,0 1,0 0,1 0,3 1,4 3,4 4,3",
  ".": "2,5 2,6",
  ",": "2,5 2,6 1,7",
  ";": "2,1 2,2|2,5 2,6 1,7",
  ":": "2,1 2,2|2,5 2,6",
  "'": "2,0 2,2",
  "!": "2,0 2,4|2,5 2,6",
  "?": "1,1 1,0 3,0 4,1 4,2 3,3 2,3 2,4|2,5 2,6",
  "-": "0,3 4,3",
  "(": "3,0 2,1 2,5 3,6",
  ")": "1,0 2,1 2,5 1,6",
  "/": "4,6 0,0",
  "%": "4,6 0,0|1,1 1,2|3,4 3,5",
  "+": "2,1 2,5|0,3 4,3",
  "=": "0,2 4,2|0,4 4,4",
  $: "2,0 2,6|4,1 3,0 1,0 0,1 0,2 1,3 3,3 4,4 4,5 3,6 1,6 0,5",
  '"': "1,0 1,2|3,0 3,2",
  " ": "",
};

const GLYPHS: Record<string, Array<Array<[number, number]>>> = {};
for (const ch of Object.keys(FONT)) {
  const spec = FONT[ch];
  GLYPHS[ch] = spec === ""
    ? []
    : spec.split("|").map((stroke) =>
        stroke.split(" ").map((pt) => {
          const [x, y] = pt.split(",").map(Number);
          return [x, y] as [number, number];
        }),
      );
}

function textWidth(text: string, size: number, spacing = 0): number {
  const unit = size / 7;
  let w = 0;
  for (const ch of text) {
    w += 6 * unit + spacing;
  }
  return w - spacing;
}

// Draw one line of text. x is the left edge (or centre when align="center").
function drawText(
  cv: Canvas,
  text: string,
  x: number,
  y: number,
  size: number,
  c: RGB,
  align: "left" | "center" = "left",
  spacing = 0,
): void {
  const unit = size / 7;
  const w = Math.max(1, Math.round(size / 11));
  let cx = align === "center" ? x - textWidth(text, size, spacing) / 2 : x;
  for (const ch of text) {
    const strokes = GLYPHS[ch.toUpperCase()] ?? GLYPHS["?"];
    for (const stroke of strokes) {
      const pts = stroke.map(
        ([gx, gy]) => [cx + gx * unit, y + gy * unit] as [number, number],
      );
      cv.polyline(pts, w, c);
    }
    cx += 6 * unit + spacing;
  }
}

// Greedy word wrap; returns lines that fit maxWidth.
function wrapText(text: string, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const trial = cur === "" ? word : cur + " " + word;
    if (textWidth(trial, size) <= maxWidth || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ------------------------------------------------------------ hero scene

const GOLD = hex("#e8b64c");
const CREAM = hex("#f5ead2");
const INK = hex("#221603");
const PINK = hex("#ff2e88");
const CYAN = hex("#37e0ff");
const SUN = hex("#ffd166");

const SKY_STOPS: Array<[number, RGB]> = [
  [0, hex("#160b33")],
  [0.45, hex("#4a1a5e")],
  [0.75, hex("#a8325a")],
  [1, hex("#ff7a2f")],
];

function drawHero(cv: Canvas): void {
  // Sunset sky, y 160..560.
  cv.vgrad(160, 560, SKY_STOPS);

  // Stars in the upper sky.
  const rng = mulberry32(20261119);
  for (let i = 0; i < 46; i++) {
    const sx = 34 + rng() * 956;
    const sy = 168 + rng() * 180;
    if (sx > 600 && sx < 830 && sy > 340) continue; // keep the sun clear
    const r = rng() < 0.25 ? 2 : 1;
    cv.circle(sx, sy, r, rng() < 0.3 ? GOLD : CREAM);
  }

  // Retro sun with horizontal slats, half behind the skyline.
  const sunX = 712;
  const sunY = 452;
  const sunR = 86;
  cv.circle(sunX, sunY, sunR, SUN);
  for (let i = 0; i < 6; i++) {
    const y = sunY + 8 + i * 13;
    const half = Math.sqrt(Math.max(0, sunR * sunR - (y - sunY) * (y - sunY)));
    const c = cv.gradColorAt(y, 160, 560, SKY_STOPS);
    cv.fillRect(sunX - half, y, half * 2, 2 + i, c);
  }

  // Birds.
  const bird = hex("#1a0b2e");
  cv.polyline([[292, 224], [302, 217], [312, 224]], 3, bird);
  cv.polyline([[342, 244], [350, 238], [358, 244]], 2, bird);
  cv.polyline([[540, 210], [549, 204], [558, 210]], 2, bird);

  // Skyline silhouettes with lit windows.
  const buildings: Array<[number, number, number]> = [
    // x, width, top
    [28, 64, 430], [92, 52, 380], [144, 70, 450], [214, 48, 400],
    [262, 80, 470], [342, 56, 360], [398, 66, 440], [464, 44, 410],
    [508, 72, 460], [580, 58, 390], [638, 76, 450], [714, 50, 370],
    [764, 68, 440], [832, 54, 400], [886, 70, 455], [956, 40, 420],
  ];
  const silhouette = hex("#14092b");
  for (const [bx, bw, top] of buildings) {
    cv.fillRect(bx, top, bw, 560 - top, silhouette);
  }
  // Antenna on the tallest tower.
  cv.line(370, 360, 370, 318, 3, silhouette);
  cv.circle(370, 316, 3, PINK);
  // Lit windows.
  const wrng = mulberry32(1911);
  for (const [bx, bw, top] of buildings) {
    const cols = Math.floor(bw / 11);
    const rows = Math.floor((560 - top) / 15);
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        if (wrng() < 0.26) {
          cv.fillRect(bx + 4 + col * 11, top + 7 + r * 15, 4, 6, wrng() < 0.75 ? GOLD : CYAN);
        }
      }
    }
  }

  // Neon "VICE CITY" sign, top-left of the sky.
  drawText(cv, "VICE CITY", 62, 208, 46, hex("#7a1046"), "left");
  drawText(cv, "VICE CITY", 58, 204, 46, hex("#7a1046"), "left");
  drawText(cv, "VICE CITY", 60, 206, 46, PINK, "left");
  drawText(cv, "GTA VI - OUT NOW", 62, 266, 20, CYAN, "left");

  // Foreground: dark reflective strip.
  cv.fillRect(28, 512, 968, 48, hex("#0a0616"));
  const frng = mulberry32(777);
  for (let i = 0; i < 26; i++) {
    const y = 518 + frng() * 36;
    const x = 40 + frng() * 900;
    const len = 20 + frng() * 90;
    cv.fillRect(x, y, len, 2, frng() < 0.5 ? PINK : CYAN);
  }

  // Sports car silhouette, centre of the strip — hot pink so it reads
  // against the dark road.
  const car = PINK;
  const carDark = hex("#0d0618");
  cv.poly([
    [392, 548], [404, 532], [470, 528], [540, 530], [560, 548],
  ], car);
  cv.poly([
    [424, 530], [442, 516], [498, 516], [520, 530],
  ], carDark);
  cv.fillRect(448, 520, 44, 9, carDark);
  cv.circle(418, 548, 10, carDark);
  cv.circle(522, 548, 10, carDark);
  cv.arc(418, 548, 10, 0, Math.PI * 2, 2, GOLD);
  cv.arc(522, 548, 10, 0, Math.PI * 2, 2, GOLD);
  cv.circle(556, 540, 4, SUN);
  cv.fillRect(560, 538, 60, 3, SUN);

  // Palm trees framing the scene.
  drawPalm(cv, 92, 560, -1);
  drawPalm(cv, 948, 560, 1);
}

function drawPalm(cv: Canvas, baseX: number, baseY: number, lean: number): void {
  const trunk = hex("#0d0618");
  const crownX = baseX + lean * 18;
  const crownY = baseY - 84;
  cv.quad([baseX, baseY], [baseX + lean * 8, baseY - 44], [crownX, crownY], 8, trunk);
  // Drooping fronds: all arc down from the crown, none stick straight up.
  const fronds: Array<[[number, number], [number, number]]> = [
    [[crownX - 30, crownY - 12], [crownX - 58, crownY + 22]],
    [[crownX - 16, crownY - 22], [crownX - 30, crownY - 44]],
    [[crownX + 2, crownY - 26], [crownX + 4, crownY - 52]],
    [[crownX + 18, crownY - 22], [crownX + 34, crownY - 42]],
    [[crownX + 30, crownY - 10], [crownX + 58, crownY + 14]],
    [[crownX - 32, crownY + 2], [crownX - 56, crownY + 30]],
    [[crownX + 32, crownY + 4], [crownX + 56, crownY + 32]],
  ];
  for (const [ctrl, end] of fronds) {
    cv.quad([crownX, crownY], ctrl, end, 4, trunk);
  }
  // Coconuts.
  cv.circle(crownX - 4, crownY + 4, 4, trunk);
  cv.circle(crownX + 5, crownY + 5, 4, trunk);
}

// ------------------------------------------------------------ story panels

interface Panel {
  kicker: string;
  headline: string;
  detail: string;
  icon: string;
}

const PANELS: Panel[] = [
  {
    kicker: "APEC - SHENZHEN",
    headline: "TRUMP, XI, PUTIN MEET",
    detail: "First three-way talks on the APEC sidelines",
    icon: "flags",
  },
  {
    kicker: "GULF",
    headline: "US-IRAN FIRE SPREADS",
    detail: "Kuwait, Bahrain hit; three US carriers sent",
    icon: "missile",
  },
  {
    kicker: "WASHINGTON",
    headline: "JEFFRIES FIRST BLACK SPEAKER",
    detail: "Democrats nominate him; gavel on 3 January",
    icon: "capitol",
  },
  {
    kicker: "INDIA",
    headline: "CYCLONE AKVAN HITS COAST",
    detail: "Winds 90-110 km/h; Andhra, Odisha on alert",
    icon: "cyclone",
  },
  {
    kicker: "SPACE",
    headline: "VOYAGER 1: ONE LIGHT-DAY",
    detail: "NASA confirms the milestone today",
    icon: "voyager",
  },
  {
    kicker: "FAITH",
    headline: "ISLAM TO TOP WORLD FAITH",
    detail: "Pew: largest religion by 2035",
    icon: "pew",
  },
];

function drawIcon(cv: Canvas, kind: string, ix: number, iy: number): void {
  // Icons live in an 84x84 box at (ix, iy).
  const panelBg = hex("#141828");
  if (kind === "flags") {
    // Three small flags: US, China, Russia.
    const poles = [ix + 10, ix + 36, ix + 62];
    for (const px of poles) cv.line(px, iy + 12, px, iy + 72, 2, CREAM);
    // US: stripes + blue canton.
    for (let s = 0; s < 4; s++) cv.fillRect(ix + 12, iy + 12 + s * 4, 20, 2, hex("#c0392b"));
    cv.fillRect(ix + 12, iy + 12, 9, 7, hex("#1f3a93"));
    // China: red field, gold stars.
    cv.fillRect(ix + 38, iy + 12, 20, 16, hex("#c0392b"));
    cv.circle(ix + 43, iy + 17, 2, GOLD);
    cv.circle(ix + 50, iy + 15, 1, GOLD);
    cv.circle(ix + 52, iy + 20, 1, GOLD);
    // Russia: white, blue, red bands.
    cv.fillRect(ix + 64, iy + 12, 20, 5, CREAM);
    cv.fillRect(ix + 64, iy + 17, 20, 6, hex("#1f6fd6"));
    cv.fillRect(ix + 64, iy + 23, 20, 5, hex("#c0392b"));
  } else if (kind === "missile") {
    // Rocket climbing diagonally: silver body, red nose, tail fins,
    // orange flame and a burst at the nose.
    cv.line(ix + 18, iy + 66, ix + 58, iy + 24, 9, hex("#d8d2c4"));
    cv.poly([[58 + ix, 24 + iy], [70 + ix, 12 + iy], [66 + ix, 30 + iy]], hex("#c0392b"));
    cv.poly([[18 + ix, 66 + iy], [6 + ix, 64 + iy], [16 + ix, 76 + iy]], hex("#c0392b"));
    cv.poly([[18 + ix, 66 + iy], [20 + ix, 54 + iy], [28 + ix, 64 + iy]], hex("#c0392b"));
    cv.circle(ix + 44, iy + 38, 3, CYAN);
    cv.poly([[14 + ix, 70 + iy], [4 + ix, 80 + iy], [22 + ix, 78 + iy]], hex("#ff7a2f"));
    cv.poly([[12 + ix, 72 + iy], [6 + ix, 82 + iy], [18 + ix, 80 + iy]], hex("#ffd166"));
    for (const [bx, by] of [[72, 14], [78, 22], [66, 8]] as Array<[number, number]>) {
      cv.line(ix + bx - 5, iy + by, ix + bx + 5, iy + by, 2, GOLD);
      cv.line(ix + bx, iy + by - 5, ix + bx, iy + by + 5, 2, GOLD);
    }
  } else if (kind === "capitol") {
    // US Capitol dome with a flag on top.
    cv.line(ix + 42, iy + 8, ix + 42, iy + 22, 2, CREAM);
    cv.fillRect(ix + 44, iy + 8, 12, 7, hex("#c0392b"));
    cv.arc(ix + 42, iy + 52, 26, Math.PI, Math.PI * 2, 3, CREAM);
    cv.fillRect(ix + 16, iy + 52, 52, 20, CREAM);
    for (let c = 0; c < 4; c++) cv.fillRect(ix + 22 + c * 12, iy + 56, 4, 16, hex("#141828"));
    cv.fillRect(ix + 12, iy + 72, 60, 4, GOLD);
  } else if (kind === "cyclone") {
    // Spiral swirl over a coastline, with rain slashes.
    cv.arc(ix + 42, iy + 38, 32, Math.PI * 0.15, Math.PI * 1.7, 3, CYAN);
    cv.arc(ix + 42, iy + 38, 22, Math.PI * 0.7, Math.PI * 2.1, 3, CYAN);
    cv.arc(ix + 42, iy + 38, 12, Math.PI * 1.2, Math.PI * 2.6, 3, GOLD);
    cv.poly([[ix + 8, iy + 78], [ix + 30, iy + 66], [ix + 56, iy + 76], [ix + 78, iy + 68], [ix + 78, iy + 84], [ix + 8, iy + 84]], hex("#1f3a5e"));
    for (const [rx, ry] of [[16, 58], [66, 52], [72, 62]] as Array<[number, number]>) {
      cv.line(ix + rx, iy + ry, ix + rx - 5, iy + ry + 10, 2, hex("#7fb8d8"));
    }
  } else if (kind === "voyager") {
    // Probe: dish, body, boom, plus stars.
    cv.arc(ix + 30, iy + 30, 16, 0, Math.PI * 2, 3, GOLD);
    cv.line(ix + 30, iy + 30, ix + 44, iy + 44, 2, CREAM);
    cv.fillRect(ix + 40, iy + 40, 26, 14, CREAM);
    cv.line(ix + 66, iy + 47, ix + 80, iy + 60, 2, GOLD);
    cv.circle(ix + 80, iy + 60, 4, CYAN);
    for (const [sx, sy] of [[14, 62], [70, 16], [78, 74], [20, 76]] as Array<[number, number]>) {
      cv.circle(ix + sx, iy + sy, 2, CREAM);
    }
  } else if (kind === "pew") {
    // Crescent moon over a rising bar chart.
    cv.circle(ix + 32, iy + 36, 20, GOLD);
    cv.circle(ix + 40, iy + 30, 17, panelBg);
    cv.fillRect(ix + 56, iy + 56, 8, 20, hex("#7fb8d8"));
    cv.fillRect(ix + 66, iy + 44, 8, 32, CREAM);
    cv.fillRect(ix + 76, iy + 30, 8, 46, GOLD);
  }
}

function drawPanel(cv: Canvas, p: Panel, x: number, y: number): void {
  const w = 312;
  const h = 155;
  const card = hex("#141828");
  cv.fillRect(x, y, w, h, card);
  cv.rectOutline(x, y, w, h, hex("#2c3352"));
  cv.fillRect(x, y, w, 3, GOLD);
  drawIcon(cv, p.icon, x + 12, y + 40);
  const tx = x + 112;
  const tw = w - 112 - 12;
  drawText(cv, p.kicker, tx, y + 16, 12, GOLD);
  const headLines = wrapText(p.headline, 18, tw);
  let cy = y + 34;
  for (const line of headLines) {
    drawText(cv, line, tx, cy, 18, CREAM);
    cy += 21;
  }
  const detailLines = wrapText(p.detail, 14, tw);
  cy += 2;
  for (const line of detailLines) {
    drawText(cv, line, tx, cy, 14, hex("#b9b3a4"));
    cy += 16;
  }
}

// ------------------------------------------------------------- assemble

function buildPoster(): Canvas {
  const cv = new Canvas();
  cv.fill(hex("#0a0c16"));

  // Masthead.
  drawText(cv, "THURSDAY - THE WORLD IN ONE PICTURE", 512, 30, 19, GOLD, "center", 3);
  drawText(cv, "19 NOVEMBER 2026", 512, 56, 62, CREAM, "center");
  cv.fillRect(28, 138, 968, 3, GOLD);

  // Hero scene + caption band.
  drawHero(cv);
  cv.fillRect(28, 560, 968, 72, GOLD);
  drawText(cv, "GTA VI LAUNCHES WORLDWIDE", 512, 568, 30, INK, "center");
  drawText(cv, "AFTER 13 YEARS, GAMERS RETURN TO VICE CITY", 512, 604, 18, INK, "center");

  // Story grid: 2 rows x 3 columns.
  const xs = [28, 356, 684];
  const ys = [648, 819];
  for (let i = 0; i < PANELS.length; i++) {
    drawPanel(cv, PANELS[i], xs[i % 3], ys[Math.floor(i / 3)]);
  }

  // Footer ticker.
  drawText(
    cv,
    "ALSO: EU PLANS EUR 45BN UKRAINE LOAN - NVIDIA STOPS H-CHIPS TO CHINA",
    512, 984, 14, hex("#8d8896"), "center",
  );

  return cv;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG(buildPoster());
  writeFileSync(join(outDir, "entry.png"), png);
}

main();
