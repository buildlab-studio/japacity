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
  | "disclaimer"
  // The ticket stub's own (stub.ts): a field's name and its value, the type badge's heading, name and line.
  | "stub-label"
  | "stub-value"
  | "type-label"
  | "type-name"
  | "type-line";

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

/**
 * A mark of the game's own on the picture (R-SHARE-006): the faint watermark's repeats and the corner
 * badge. Turned about its centre by `angle` degrees, clockwise; `alpha` is its opacity in hundredths.
 * Not a word of the card: the layout keeps it under the words or clear of them.
 */
export interface MarkStep {
  op: "mark";
  role: "watermark" | "badge";
  text: string;
  x: number;
  y: number;
  size: number;
  angle: number;
  color: PaletteName;
  alpha: number;
  /** The badge's band, filled before its name; null for the watermark. */
  band: { points: [number, number][]; color: PaletteName } | null;
}

/**
 * The game's seal (public/brand) drawn small in a corner of the footer: the J in its rings with the two
 * bulbs on the wire, in the small drawing's plain shapes. `x` and `y` are its top left, `size` its width; the `ground`
 * is the file's own: light is the navy disc for a light card, dark the yellow disc for a black one.
 */
export interface SealStep {
  op: "seal";
  x: number;
  y: number;
  size: number;
  ground: "light" | "dark";
}

/** The seal's ground for a card of this tone: the yellow disc on black, the navy one on white and on the send-off's yellow. */
export function sealGround(tone: Tone): SealStep["ground"] {
  return tone.background === "black" ? "dark" : "light";
}

export type Step = Shape | TextStep | MarkStep | SealStep | { op: "clip"; box: Box; radius: number } | { op: "unclip" };

/** The width of `text` drawn at `size` in `family` and `weight`. */
export type Measure = (text: string, size: number, family: Family, weight: number) => number;

export interface Size {
  width: number;
  height: number;
}

export interface Tone {
  background: PaletteName;
  ink: PaletteName;
  soft: PaletteName;
}

export const TONES: Record<ShareKind, Tone> = {
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

export function scaler(width: number, design: number): (value: number) => number {
  return (value) => Math.round((value * width) / design);
}

/** The bus stripes along the top edge: the game's own mark, no logo. */
export function stripes(x: number, y: number, width: number, height: number, band: number, tone: Tone): Shape[] {
  const shapes: Shape[] = [{ op: "rect", x, y, w: width, h: height, color: tone.ink }];
  for (let left = x + band; left < x + width; left += band * 2) shapes.push({ op: "rect", x: left, y, w: Math.min(band, x + width - left), h: height, color: "danfoYellow" });
  return shapes;
}

/** The watermark's opacity, in hundredths: faint enough that the words over it read, plain enough to show in a crop. */
const WATERMARK_ALPHA = 7;

/**
 * The game's name repeated across the whole picture at a slant (R-SHARE-006), each repeat anchored inside
 * it, rows offset so no column lines up. `unit` scales the card's design sizes to this picture.
 */
export function watermark(name: string, size: Size, unit: (value: number) => number, color: PaletteName): MarkStep[] {
  const steps: MarkStep[] = [];
  const across = unit(440);
  const down = unit(230);
  for (let row = 0, y = unit(110); y <= size.height; row += 1, y += down) {
    for (let x = row % 2 === 0 ? unit(120) : unit(340); x <= size.width; x += across) {
      steps.push({ op: "mark", role: "watermark", text: name, x, y, size: unit(60), angle: -20, color, alpha: WATERMARK_ALPHA, band: null });
    }
  }
  return steps;
}

/**
 * The diagonal badge across a top corner (R-SHARE-006): a band cut across the corner between `near` and
 * `far` along each edge, with the game's name along it in capitals.
 */
export function cornerBadge(name: string, size: Size, unit: (value: number) => number, corner: "left" | "right", tone: { band: PaletteName; ink: PaletteName }): MarkStep {
  const near = unit(150);
  const far = unit(250);
  const middle = Math.round((near + far) / 2);
  const right = corner === "right";
  const edge = right ? size.width : 0;
  const inward = (distance: number) => (right ? size.width - distance : distance);
  return {
    op: "mark",
    role: "badge",
    text: name.toUpperCase(),
    x: inward(Math.round(middle / 2)),
    y: Math.round(middle / 2),
    size: unit(38),
    angle: right ? 45 : -45,
    color: tone.ink,
    alpha: 100,
    band: {
      points: [
        [inward(far), 0],
        [inward(near), 0],
        [edge, near],
        [edge, far],
      ],
      color: tone.band,
    },
  };
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
  // The title in the plain face, as the word mark: in the display caps "A CHAPTER CLOSES" reads hard.
  const title = unit(84);
  for (const line of wrapped(face.title, title, "sans", 700)) put("title", line, (y += unit(96)), title, 700, "sans", tone.ink);
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
  // The seal stands before it, centred on the word's height.
  const seal = unit(104);
  footer.push({ op: "seal", x: pad, y: rule + unit(96) - Math.round(unit(64) * 0.36) - Math.round(seal / 2), size: seal, ground: sealGround(tone) });
  foot("sender", face.sender, rule + unit(96), unit(64), 700, "sans");
  const sender = footText[footText.length - 1];
  if (sender !== undefined) sender.x = pad + seal + unit(24);
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
    // The marks before the words (R-SHARE-006): the watermark over the art and the ground, the badge on the corner the art starts under.
    ...watermark(face.sender, size, unit, tone.ink),
    cornerBadge(face.sender, size, unit, "right", { band: tone.ink, ink: tone.background }),
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
    // The marks (R-SHARE-006): the watermark closer set, since the preview is short; the badge on the art's corner, clear of the words.
    ...watermark(face.sender, size, scaler(size.width, 1600), tone.ink),
    cornerBadge(face.sender, size, scaler(size.width, 1080), "left", { band: tone.ink, ink: tone.background }),
  ];
  const put = (role: TextRole, words: string, y: number, sizePx: number, weight: TextStep["weight"], family: Family) =>
    steps.push({ op: "text", role, text: words, x: left, y, size: sizePx, weight, family, color: tone.ink, align: "left" });
  let y = unit(96);
  put("kicker", face.kicker.toUpperCase(), y, unit(26), 700, "sans");
  const title = unit(66);
  for (const line of wrap(face.title, width, (part) => measure(part, title, "sans", 700))) put("title", line, (y += unit(76)), title, 700, "sans");
  const seal = unit(72);
  steps.push({ op: "seal", x: left, y: size.height - unit(150) - Math.round(unit(48) * 0.36) - Math.round(seal / 2), size: seal, ground: sealGround(tone) });
  put("sender", face.sender, size.height - unit(150), unit(48), 700, "sans");
  const sender = steps[steps.length - 1];
  if (sender?.op === "text") sender.x = left + seal + unit(18);
  put("disclaimer", face.disclaimer, size.height - unit(96), unit(34), 700, "sans");
  put("address", face.address, size.height - unit(52), unit(28), 600, "sans");
  return steps;
}
