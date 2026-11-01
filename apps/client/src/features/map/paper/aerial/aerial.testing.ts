// What the aerial map's tests share: the tokens of Lagos from the air read from its stylesheet by day and by night,
// colours laid over one another, the contrast between two, and a job run to its end on a clock of its own.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { groundOf } from "../draw";
import { type AerialJob, aerialJob } from "./job";
import type { AerialTuning } from "./layout";

const CSS = readFileSync(join(import.meta.dirname, "aerial.css"), "utf8");

/** The block of tokens under a selector, as name to value. */
function block(selector: string): Map<string, string> {
  const start = CSS.indexOf(selector);
  if (start < 0) throw new Error(`No block for ${selector}`);
  const body = CSS.slice(CSS.indexOf("{", start) + 1, CSS.indexOf("}", start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((match) => [match[1] ?? "", (match[2] ?? "").trim()]));
}

const DAY = block('.paper[data-city="lagos"] {');
const NIGHT = block('[data-paint="night"] .paper[data-city="lagos"]');

/** A token of Lagos from the air by day or by night; the night's falls back on the day's. */
export function token(night: boolean, name: string): string {
  const value = (night ? (NIGHT.get(name) ?? DAY.get(name)) : DAY.get(name)) ?? "";
  if (value === "") throw new Error(`No token ${name}`);
  return value;
}

type Rgba = readonly [number, number, number, number];

/** A colour as red, green, blue and alpha, from a hex or an rgba(). */
export function rgba(colour: string): Rgba {
  const hex = /^#([\da-f]{6})$/i.exec(colour);
  if (hex !== null) {
    const value = parseInt(hex[1] ?? "0", 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 1];
  }
  const parts = /^rgba?\(([^)]+)\)$/.exec(colour)?.[1]?.split(",").map((part) => Number(part.trim()));
  if (parts === undefined || parts.length < 3) throw new Error(`Not a colour: ${colour}`);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0, parts[3] ?? 1];
}

/** A colour laid over an opaque ground. */
export function over(top: string, ground: string): string {
  const [r, g, b, a] = rgba(top);
  const [gr, gg, gb] = rgba(ground);
  const mix = (front: number, back: number): number => Math.round(front * a + back * (1 - a));
  return `#${[mix(r, gr), mix(g, gg), mix(b, gb)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(colour: string): number {
  const [r, g, b] = rgba(colour).map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast between two opaque colours, as WCAG reckons it. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** A job whose slices are queued and run one at a time by `drain`, on a clock that moves only when it is told. */
export function queuedJob(tuning?: AerialTuning, clock: () => number = () => 0): { job: AerialJob; drain: (limit?: number) => number } {
  const queue: ((left: number) => void)[] = [];
  const job = aerialJob(groundOf, {
    later: (run) => {
      queue.push(run);
      return () => {
        const at = queue.indexOf(run);
        if (at >= 0) queue.splice(at, 1);
      };
    },
    now: clock,
    defer: (run) => run(),
    ...(tuning === undefined ? {} : { tuning }),
  });
  return {
    job,
    drain: (limit = Infinity) => {
      let ran = 0;
      while (queue.length > 0 && ran < limit) {
        const run = queue.shift();
        run?.(6);
        ran += 1;
      }
      return ran;
    },
  };
}
