// Reads a PDF on the server: one PNG image per page, the page text, and where each line of text sits.
// The viewer shows the images, so hidden info and watermarks can be burned into the pixels.
import "server-only";
import path from "node:path";
import type { TextLine, Box } from "./db/schema";
export { boxFor } from "./boxes";

export const PAGE_WIDTH = 1400;

export type ProcessedPage = { number: number; text: string; lines: TextLine[]; width: number; height: number; png: Buffer };

type TextItem = { str: string; transform: number[]; width: number; height: number; hasEOL?: boolean };

export async function processPdf(data: Uint8Array, maxPages = 300): Promise<ProcessedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const base = path.join(process.cwd(), "node_modules", "pdfjs-dist");
  const doc = await pdfjs.getDocument({
    data,
    standardFontDataUrl: path.join(base, "standard_fonts") + "/",
    cMapUrl: path.join(base, "cmaps") + "/",
    cMapPacked: true,
    disableFontFace: true,
    useSystemFonts: false,
  }).promise;
  const out: ProcessedPage[] = [];
  try {
    const count = Math.min(doc.numPages, maxPages);
    for (let n = 1; n <= count; n++) {
      const page = await doc.getPage(n);
      const unit = page.getViewport({ scale: 1 });
      const scale = PAGE_WIDTH / unit.width;
      const vp = page.getViewport({ scale });
      const width = Math.round(vp.width);
      const height = Math.round(vp.height);
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      // pdf.js expects a DOM-like canvas context; @napi-rs/canvas provides a compatible one.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await page.render({ canvasContext: ctx as any, viewport: vp, canvas: canvas as any }).promise;
      const content = await page.getTextContent();
      const lines: TextLine[] = [];
      let text = "";
      let lastY: number | null = null;
      for (const raw of content.items as unknown[]) {
        const item = raw as TextItem;
        if (typeof item.str !== "string") continue;
        // A new line on the page starts a new line of text, even when pdf.js does not mark it.
        const y = item.transform?.[5];
        if (item.str.trim() && lastY !== null && typeof y === "number" && Math.abs(y - lastY) > (Math.hypot(item.transform[2], item.transform[3]) || 10) * 0.5 && !text.endsWith("\n")) text += "\n";
        if (item.str.trim() && typeof y === "number") lastY = y;
        if (item.str.trim()) {
          const [, , c, d, e, f] = item.transform;
          const fontSize = Math.hypot(c, d) || item.height || 10;
          const [x, baseline] = vp.convertToViewportPoint(e, f);
          lines.push({
            str: item.str,
            x: Math.round(x),
            y: Math.round(baseline - fontSize * scale * 0.9),
            w: Math.round(item.width * scale),
            h: Math.round(fontSize * scale * 1.15),
          });
        }
        text += item.str + (item.hasEOL ? "\n" : item.str.endsWith(" ") ? "" : " ");
      }
      out.push({ number: n, text: tidy(text), lines, width, height, png: canvas.toBuffer("image/png") });
      page.cleanup();
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

function tidy(text: string) {
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Burns hidden-info boxes and a watermark into a page image.
 * Both are part of the pixels, so they cannot be removed in the browser.
 */
export async function stampPage(png: Buffer, opts: { boxes: Box[]; watermark?: string | null }): Promise<Buffer> {
  if (!opts.boxes.length && !opts.watermark) return png;
  const { createCanvas, loadImage, GlobalFonts } = await import("@napi-rs/canvas");
  ensureFont(GlobalFonts);
  const img = await loadImage(png);
  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0);
  ctx.fillStyle = "#1d1d1f";
  for (const b of opts.boxes) {
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.w, b.h, 3);
    ctx.fill();
  }
  if (opts.watermark) {
    const size = Math.round(img.width / 46);
    ctx.font = `500 ${size}px Inter`;
    // Dark slides need a light watermark, or it disappears.
    ctx.fillStyle = isDark(img, createCanvas) ? "rgba(255, 255, 255, 0.13)" : "rgba(29, 29, 31, 0.10)";
    ctx.save();
    ctx.translate(img.width / 2, img.height / 2);
    ctx.rotate(-Math.PI / 7);
    const step = size * 13;
    const wm = opts.watermark;
    const tw = ctx.measureText(wm).width + size * 7;
    for (let y = -img.height; y < img.height; y += step) {
      for (let x = -img.width * 1.2; x < img.width * 1.2; x += tw) ctx.fillText(wm, x + ((y / step) % 2) * (tw / 2), y);
    }
    ctx.restore();
  }
  return canvas.toBuffer("image/png");
}

/** True when most of the page is dark, judged from a small copy of it. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isDark(img: any, createCanvas: typeof import("@napi-rs/canvas").createCanvas): boolean {
  const c = createCanvas(32, 32);
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return sum / (d.length / 4) < 110;
}

let fontReady = false;
function ensureFont(GlobalFonts: { registerFromPath: (p: string, name?: string) => unknown }) {
  if (fontReady) return;
  try {
    GlobalFonts.registerFromPath(path.join(process.cwd(), "public", "fonts", "Inter-Medium-subset.ttf"), "Inter");
  } catch {
    // Falls back to the system sans-serif.
  }
  fontReady = true;
}

/** A text measure using Inter, close to most document fonts, for placing hidden-info boxes. */
export async function fontMeasure(): Promise<(s: string) => number> {
  const { createCanvas, GlobalFonts } = await import("@napi-rs/canvas");
  ensureFont(GlobalFonts);
  const ctx = createCanvas(10, 10).getContext("2d");
  ctx.font = "400 40px Inter";
  return (s: string) => ctx.measureText(s).width;
}
