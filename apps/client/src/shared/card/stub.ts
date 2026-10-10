// The send-off's ticket stub (docs/rules/share.md R-SHARE-001, R-SHARE-004 to R-SHARE-006, R-SHARE-009;
// decision 0018): a drawn paper stub over the departure art, with FROM, TO, MONTHS and JAPACITY, the
// type badge and the first name. Place names and words only: no airline, no barcode, no seat, no
// booking, no airport code and no crest, so it never reads as a real ticket. Landscape: the card's own
// size turned on its side.
import { content, type JapaType } from "@japacity/content";
import type { Content, Id } from "@japacity/sim";

import { typeWords } from "../words/japaType";
import { nameOf, say } from "../words/text";
import { artShapes, type Box, type Shape } from "./art";
import { cardFace, playedWords, type ShareCard } from "./face";
import { cornerBadge, scaler, stripes, TONES, watermark, wrap, type Family, type Measure, type Size, type Step, type TextRole, type TextStep } from "./layout";

export interface StubFace {
  kicker: string;
  /** The character's first name, as on the send-off card (R-SHARE-008). */
  name: string | null;
  /** The japacity figure is its digits; the layout adds the sign. */
  fields: { from: string; to: string; months: string; japacity: string | null };
  labels: { from: string; to: string; months: string; japacity: string };
  /** The type read at the send-off, or null before it is read. */
  type: { label: string; name: string; line: string } | null;
  art: string;
  sender: string;
  address: string;
  officialLine: string;
  disclaimer: string;
}

/** The stub's picture: the card's size turned on its side (R-SHARE-009). */
export function stubSize(tuning: Content["tuning"]["share"] = content.tuning.share): Size {
  return { width: tuning.height, height: tuning.width };
}

/** The country a send-off flies to, by its route. Null for a way with no country, the road. */
function countryOf(route: Id<"route"> | null): Id<"country"> | null {
  if (route === null) return null;
  return content.route[route]?.country ?? null;
}

/** The stub for a send-off card, or null for any other card or a send-off with no country to name. */
export function stubFace(card: ShareCard, scenario: Id<"scenario"> | null, type: JapaType | null): StubFace | null {
  if (card.kind !== "send-off") return null;
  const country = countryOf(card.route);
  if (country === null) return null;
  const face = cardFace(card, scenario);
  return {
    kicker: say("share.stub.kicker"),
    name: face.name,
    fields: { from: say("share.stub.home"), to: nameOf(country), months: playedWords(card.months), japacity: card.percent === null ? null : String(card.percent) },
    labels: { from: say("share.stub.from"), to: say("share.stub.to"), months: say("share.stub.months"), japacity: say("share.stub.japacity") },
    type: type === null ? null : { label: say("share.stub.badge"), ...typeWords(type) },
    art: say("share.send-off.art"),
    sender: face.sender,
    address: face.address,
    officialLine: face.officialLine,
    disclaimer: face.disclaimer,
  };
}

/** A paper shape with its corners cut, the stub's drawn edge. */
function cutCorners(x0: number, y0: number, x1: number, y1: number, cut: number): [number, number][] {
  return [
    [x0 + cut, y0],
    [x1 - cut, y0],
    [x1, y0 + cut],
    [x1, y1 - cut],
    [x1 - cut, y1],
    [x0 + cut, y1],
    [x0, y1 - cut],
    [x0, y0 + cut],
  ];
}

/** The drawing steps of the stub at `size`. Sizes are written for the 1920 by 1080 picture and scaled. */
export function stubSteps(face: StubFace, size: Size, measure: Measure): Step[] {
  const unit = scaler(size.width, 1920);
  const tone = TONES["send-off"];
  const ink = "black";
  const soft = "charcoal";
  const text: TextStep[] = [];
  const put = (role: TextRole, words: string, x: number, y: number, sizePx: number, weight: TextStep["weight"], family: Family, align: TextStep["align"] = "left") =>
    text.push({ op: "text", role, text: words, x, y, size: sizePx, weight, family, color: role === "stub-label" || role === "type-label" || role === "kicker" ? soft : ink, align });

  /** Puts `words` at the largest size from `largest` down to `smallest` that fits `width`; under that, wraps at the smallest. */
  const fitted = (role: TextRole, words: string, x: number, y: number, width: number, largest: number, smallest: number, family: Family): number => {
    // The display face has one weight; the plain face is drawn bold.
    const weight = family === "display" ? 400 : 700;
    let sizePx = largest;
    while (sizePx > smallest && measure(words, sizePx, family, weight) > width) sizePx -= unit(2);
    const lines = wrap(words, width, (line) => measure(line, sizePx, family, weight));
    lines.forEach((line, at) => put(role, line, x, y + at * Math.round(sizePx * 1.1), sizePx, weight, family));
    return y + (lines.length - 1) * Math.round(sizePx * 1.1);
  };

  // The departure art in a panel on the right, the stub laid over its left edge.
  const art: Box = { x: unit(1180), y: unit(60), w: unit(680), h: unit(760) };

  // The paper: the main part, the perforation and the tear-off with the type badge.
  const paper = { x0: unit(70), y0: unit(100), x1: unit(1400), y1: unit(800) };
  const tear = unit(960);
  const shapes: Shape[] = [
    { op: "poly", points: cutCorners(paper.x0 + unit(14), paper.y0 + unit(14), paper.x1 + unit(14), paper.y1 + unit(14), unit(34)), color: soft },
    { op: "poly", points: cutCorners(paper.x0, paper.y0, paper.x1, paper.y1, unit(34)), color: "cream" },
  ];
  for (let y = paper.y0 + unit(30); y < paper.y1 - unit(20); y += unit(34)) shapes.push({ op: "circle", x: tear, y, r: unit(8), color: "wallCreamWorn" });

  // The main part: who, then the four fields in two rows. Places in the plain face so they read at a glance.
  const left = unit(140);
  const second = unit(520);
  const columnEnd = tear - unit(40);
  // In its own case: three capitals alone would read as an airport's code.
  put("kicker", face.kicker, left, unit(175), unit(34), 700, "sans");
  if (face.name !== null) fitted("name", face.name, left, unit(262), columnEnd - left, unit(76), unit(48), "sans");
  put("stub-label", face.labels.from.toUpperCase(), left, unit(370), unit(30), 700, "sans");
  put("stub-label", face.labels.to.toUpperCase(), second, unit(370), unit(30), 700, "sans");
  const fromEnd = fitted("stub-value", face.fields.from, left, unit(452), unit(220), unit(64), unit(40), "sans");
  // The arrow from one place to the other: a drawn mark, not a sign from any airport.
  shapes.push({ op: "rect", x: unit(380), y: unit(422), w: unit(70), h: unit(14), color: ink });
  shapes.push({ op: "poly", points: [[unit(446), unit(404)], [unit(486), unit(429)], [unit(446), unit(454)]], color: ink });
  const toEnd = fitted("stub-value", face.fields.to, second, unit(452), columnEnd - second, unit(64), unit(44), "sans");
  const row = Math.max(unit(580), Math.max(fromEnd, toEnd) + unit(110));
  put("stub-label", face.labels.months.toUpperCase(), left, row, unit(30), 700, "sans");
  put("stub-label", face.labels.japacity.toUpperCase(), second, row, unit(30), 700, "sans");
  fitted("stub-value", face.fields.months, left, row + unit(82), second - left - unit(40), unit(56), unit(34), "sans");
  if (face.fields.japacity !== null) {
    // The figure in the display face and its sign in the plain one, as on the card: the face's own sign reads as a colon.
    const figure = unit(110);
    const digits = face.fields.japacity;
    put("stub-value", digits, second, row + unit(122), figure, 400, "display");
    put("percent-sign", "%", second + Math.round(measure(digits, figure, "display", 400)) + unit(8), row + unit(122), unit(52), 700, "sans");
  }

  // The tear-off: the type badge, a sticker with the type's name, and its line under it.
  if (face.type !== null) {
    const badge = { x0: tear + unit(45), x1: paper.x1 - unit(45), y0: unit(215), y1: unit(500) };
    shapes.push({ op: "poly", points: cutCorners(badge.x0, badge.y0, badge.x1, badge.y1, unit(22)), color: "danfoYellow" });
    put("type-label", face.type.label.toUpperCase(), badge.x0, unit(175), unit(28), 700, "sans");
    const nameSize = unit(50);
    const nameLines = wrap(face.type.name, badge.x1 - badge.x0 - unit(56), (line) => measure(line, nameSize, "sans", 700));
    const nameTop = Math.round((badge.y0 + badge.y1) / 2 - ((nameLines.length - 1) * unit(58)) / 2 + nameSize / 3);
    nameLines.forEach((line, at) => put("type-name", line, badge.x0 + unit(28), nameTop + at * unit(58), nameSize, 700, "sans"));
    const lineSize = unit(28);
    wrap(face.type.line, badge.x1 - badge.x0, (line) => measure(line, lineSize, "sans", 400)).forEach((line, at) => text.push({ op: "text", role: "type-line", text: line, x: badge.x0, y: unit(560) + at * unit(38), size: lineSize, weight: 400, family: "sans", color: ink, align: "left" }));
  }

  // The foot: the game's name, the address, the disclaimer no smaller than the address, the official page (R-SHARE-004, R-SHARE-014).
  const footTop = unit(870);
  const foot: Step[] = [{ op: "rect", x: 0, y: footTop, w: size.width, h: size.height - footTop, color: tone.background }, ...stripes(0, footTop, size.width, unit(22), unit(36), tone)];
  const right = size.width - unit(110);
  put("sender", face.sender, unit(110), unit(965), unit(60), 700, "sans");
  put("address", face.address, unit(110), unit(1035), unit(36), 600, "sans");
  put("disclaimer", face.disclaimer, right, unit(960), unit(44), 700, "sans", "right");
  put("official", face.officialLine, right, unit(1030), unit(30), 400, "sans", "right");

  // Sized from the picture's height, so the marks match the portrait card's.
  const marks = scaler(size.height, 1080);
  return [
    { op: "rect", x: 0, y: 0, w: size.width, h: size.height, color: tone.background },
    { op: "clip", box: art, radius: unit(36) },
    ...(artShapes(face.art, art) ?? [{ op: "rect", x: art.x, y: art.y, w: art.w, h: art.h, color: soft } satisfies Shape]),
    { op: "unclip" },
    ...shapes,
    ...foot,
    // The marks before the words (R-SHARE-006): the watermark over the art and the paper, the badge on the art's corner.
    ...watermark(face.sender, size, marks, ink),
    cornerBadge(face.sender, size, marks, "right", { band: ink, ink: tone.background }),
    ...text,
  ];
}
