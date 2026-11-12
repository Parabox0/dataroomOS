import type { TextLine, Box } from "./db/schema";

/** Measures text width in any unit; only the ratio between two strings is used. */
export type Measure = (s: string) => number;

const even: Measure = (s) => s.length;

/**
 * Where a piece of text sits inside a line. With a real font measure, the box follows the actual
 * letter widths; without one it assumes even widths. Padded generously, because hiding a little
 * too much is better than leaving the edge of a phone number readable.
 */
export function boxFor(line: TextLine, start: number, length: number, measure: Measure = even): Box {
  const full = Math.max(1e-6, measure(line.str));
  const scale = line.w / full;
  const x0 = measure(line.str.slice(0, start)) * scale;
  const x1 = measure(line.str.slice(0, start + length)) * scale;
  const pad = Math.max(4, (line.w / Math.max(1, line.str.length)) * 0.9);
  return {
    x: Math.max(0, Math.round(line.x + x0 - pad)),
    y: Math.round(line.y - line.h * 0.1),
    w: Math.round(x1 - x0 + pad * 2),
    h: Math.round(line.h * 1.1),
  };
}
