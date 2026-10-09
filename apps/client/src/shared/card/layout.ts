// Where everything on a drawn card goes (docs/rules/share.md R-SHARE-004,
// R-SHARE-009, R-SHARE-010): a list of plain drawing steps, worked out from the
// card's words and a way to measure text, so the layout can be tested without
// a canvas. Sizes are written for the 1080 pixel wide card and scaled.
import type { ShareKind } from "@japacity/content";

import type { PaletteName } from "../../../../../packages/assets/src/palette";
import { artShapes, type Box, type Shape } from "./art";
import type { CardFace } from "./face";

export type TextRole =
  | "kicker"
  | "title"
  | "chapter"
  | "name"
  | "route"
  | "percent"
  | "percent-sign"
  | "label"
  | "value"
  | "most"
  | "body"
  | "sender"
  | "address"
  | "official"
  | "disclaimer";

export type Family = "display" | "sans";

export interface TextStep {
  op: "text";
  role: TextRole;
  text: string;
  x: number;
  y: number;
  size: number;
  weight: 400 | 600 | 700;
  family: Family;
  color: PaletteName;
  align: "left" | "right";
}

export type Step = Shape | TextStep | { op: "clip"; box: Box; radius: number } | { op: "unclip" };

/** The width of `text` drawn at `size` in `family` and `weight`. */
export type Measure = (text: string, size: number, family: Family, weight: number) => number;

export interface Size {
  width: number;
  height: number;
}

interface Tone {
  background: PaletteName;
  ink: PaletteName;
  soft: PaletteName;
}

const TONES: Record<ShareKind, Tone> = {
  "send-off": { background: "danfoYellow", ink: "black", soft: "charcoal" },
  "real-story": { background: "black", ink: "white", soft: "zinc" },
  lost: { background: "black", ink: "white", soft: "zinc" },
  chapter: { background: "white", ink: "black", soft: "charcoal" },
  granted: { background: "white", ink: "black", soft: "charcoal" },
  "first-pay-abroad": { background: "white", ink: "black", soft: "charcoal" },
  secured: { background: "white", ink: "black", soft: "charcoal" },
  december: { background: "white", ink: "black", soft: "charcoal" },
  "draw-win": { background: "white", ink: "black", soft: "charcoal" },
};

/** Breaks `text` into lines no wider than `width`. A word wider than the line keeps a line of its own. */
export function wrap(text: string, width: number, measure: (line: string) => number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter((part) => part !== "")) {
    const tried = line === "" ? word : `${line} ${word}`;
    if (line !== "" && measure(tried) > width) {
      lines.push(line);
      line = word;
    } else {
      line = tried;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function scaler(width: number, design: number): (value: number) => number {
  return (value) => Math.round((value * width) / design);
}

/** The bus stripes along the top edge: the game's own mark, no logo. */
function stripes(x: number, y: number, width: number, height: number, band: number, tone: Tone): Shape[] {
  const shapes: Shape[] = [{ op: "rect", x, y, w: width, h: height, color: tone.ink }];
  for (let left = x + band; left < x + width; left += band * 2) shapes.push({ op: "rect", x: left, y, w: Math.min(band, x + width - left), h: height, color: "danfoYellow" });
  return shapes;
}

/** The drawing steps of a whole card at `size` (R-SHARE-004, R-SHARE-009). */
export function cardSteps(face: CardFace, size: Size, measure: Measure): Step[] {
  const unit = scaler(size.width, 1080);
  const tone = TONES[face.kind];
  const pad = unit(72);
  const inner = size.width - pad * 2;
  const text: TextStep[] = [];
  const put = (role: TextRole, words: string, y: number, sizePx: number, weight: TextStep["weight"], family: Family, color: PaletteName, align: TextStep["align"] = "left") =>
    text.push({ op: "text", role, text: words, x: align === "left" ? pad : size.width - pad, y, size: sizePx, weight, family, color, align });
  const wrapped = (words: string, sizePx: number, family: Family, weight: number) => wrap(words, inner, (line) => measure(line, sizePx, family, weight));

  // The words block, laid out from zero and moved below the art once its height is known.
  let y = 0;
  const kicker = unit(34);
  put("kicker", face.kicker.toUpperCase(), (y += kicker), kicker, 700, "sans", tone.soft);
  y += unit(28);
  const title = unit(92);
  for (const line of wrapped(face.title, title, "display", 400)) put("title", line, (y += unit(100)), title, 400, "display", tone.ink);
  if (face.chapter !== null) put("chapter", face.chapter, (y += unit(64)), unit(48), 600, "sans", tone.ink);
  if (face.name !== null) put("name", face.name, (y += unit(64)), unit(46), 700, "sans", tone.ink);
  if (face.route !== null) put("route", face.route, (y += unit(56)), unit(40), 400, "sans", tone.ink);
  if (face.percent !== null) {
    const figure = unit(200);
    const digits = String(face.percent);
    y += unit(24) + figure;
    put("percent", digits, y, figure, 400, "display", tone.ink);
    const after = pad + Math.round(measure(digits, figure, "display", 400)) + unit(8);
    text.push({ op: "text", role: "percent-sign", text: "%", x: after, y, size: unit(90), weight: 700, family: "sans", color: tone.ink, align: "left" });
    put("label", face.percentLabel, (y += unit(52)), unit(32), 400, "sans", tone.soft);
  }
  if (face.stats !== null) {
    // The time played and how home sees the character are words now, each on its own row.
    const value = unit(48);
    put("label", face.monthsLabel, (y += unit(64)), unit(32), 400, "sans", tone.soft);
    put("value", face.stats.months, (y += unit(60)), value, 700, "sans", tone.ink);
    put("label", face.standingLabel, (y += unit(64)), unit(32), 400, "sans", tone.soft);
    for (const line of wrapped(face.stats.standing, value, "sans", 700)) put("value", line, (y += unit(60)), value, 700, "sans", tone.ink);
  }
  if (face.most.length > 0) {
    put("label", face.mostLabel, (y += unit(64)), unit(32), 400, "sans", tone.soft);
    for (const item of face.most) put("most", item, (y += unit(54)), unit(42), 600, "sans", tone.ink);
  }
  if (face.body !== null) {
    y += unit(16);
    const body = unit(42);
    for (const line of wrapped(face.body, body, "sans", 400)) put("body", line, (y += unit(58)), body, 400, "sans", tone.ink);
  }
  const block = y;

  // The footer, fixed at the foot: the sender, the disclaimer no smaller than the address (R-SHARE-004).
  const rule = size.height - unit(300);
  const footer: Step[] = [{ op: "line", x1: pad, y1: rule, x2: size.width - pad, y2: rule, width: unit(3), color: tone.soft }];
  const footText: TextStep[] = [];
  const foot = (role: TextRole, words: string, at: number, sizePx: number, weight: TextStep["weight"], family: Family, align: TextStep["align"] = "left") =>
    footText.push({ op: "text", role, text: words, x: align === "left" ? pad : size.width - pad, y: at, size: sizePx, weight, family, color: tone.ink, align });
  // The word mark in the plain face: in the display caps its Y reads as a 3.
  foot("sender", face.sender, rule + unit(96), unit(64), 700, "sans");
  foot("disclaimer", face.disclaimer, rule + unit(88), unit(44), 700, "sans", "right");
  foot("address", face.address, rule + unit(168), unit(38), 600, "sans");
  foot("official", face.officialLine, rule + unit(226), unit(32), 400, "sans");

  // The art takes what is left between the stripes and the words.
  const top = unit(28) + unit(44);
  const gap = unit(56);
  const artHeight = Math.max(unit(320), Math.min(unit(860), rule - unit(40) - block - gap - top));
  const art: Box = { x: pad, y: top, w: inner, h: artHeight };
  const shift = top + artHeight + gap;

  return [
    { op: "rect", x: 0, y: 0, w: size.width, h: size.height, color: tone.background },
    ...stripes(0, 0, size.width, unit(28), unit(36), tone),
    { op: "clip", box: art, radius: unit(36) },
    ...(artShapes(face.art, art) ?? [{ op: "rect", x: art.x, y: art.y, w: art.w, h: art.h, color: tone.soft } satisfies Shape]),
    { op: "unclip" },
    ...text.map((step) => ({ ...step, y: step.y + shift })),
    ...footer,
    ...footText,
  ];
}

/**
 * The link preview for one kind (R-SHARE-010): the kind's art, title and the
 * game's words, and nothing about any player.
 */
export function previewSteps(face: Pick<CardFace, "kind" | "kicker" | "title" | "art" | "sender" | "address" | "disclaimer">, size: Size, measure: Measure): Step[] {
  const unit = scaler(size.width, 1200);
  const tone = TONES[face.kind];
  const art: Box = { x: 0, y: 0, w: unit(540), h: size.height };
  const left = art.w + unit(56);
  const width = size.width - left - unit(56);
  const steps: Step[] = [
    { op: "rect", x: 0, y: 0, w: size.width, h: size.height, color: tone.background },
    ...(artShapes(face.art, art) ?? []),
    ...stripes(art.w, 0, size.width - art.w, unit(20), unit(28), tone),
  ];
  const put = (role: TextRole, words: string, y: number, sizePx: number, weight: TextStep["weight"], family: Family) =>
    steps.push({ op: "text", role, text: words, x: left, y, size: sizePx, weight, family, color: tone.ink, align: "left" });
  let y = unit(96);
  put("kicker", face.kicker.toUpperCase(), y, unit(26), 700, "sans");
  const title = unit(66);
  for (const line of wrap(face.title, width, (part) => measure(part, title, "display", 400))) put("title", line, (y += unit(76)), title, 400, "display");
  put("sender", face.sender, size.height - unit(150), unit(48), 700, "sans");
  put("disclaimer", face.disclaimer, size.height - unit(96), unit(34), 700, "sans");
  put("address", face.address, size.height - unit(52), unit(28), 600, "sans");
  return steps;
}
