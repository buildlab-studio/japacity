// The three marks on every share picture (docs/rules/share.md R-SHARE-006, the review): a
// faint watermark of the game's name across the background, a diagonal badge at a top corner with the
// game's name, and the branding with the address at the foot. Drawn under the words, never over them.
import { content, shareChapters, shareKinds, text, type ShareKind } from "@japacity/content";
import { afterEach, describe, expect, test, vi } from "vitest";

import { recordedGame } from "../testing/fixtures";
import { cardFace, type ShareCard } from "./face";
import { fakeCanvas } from "./fakeCanvas";
import { cardSteps, previewSteps, type MarkStep, type Measure, type Size, type Step, type TextStep } from "./layout";
import { renderCard, renderPreview } from "./render";

const tuning = content.tuning.share;
const SIZE = { width: tuning.width, height: tuning.height };
const PREVIEW = { width: tuning.previewWidth, height: tuning.previewHeight };
const measure: Measure = (words, size) => Math.round(words.length * size * 0.55);
const NAME = text["share.sender"]!;

function adaCard(): ShareCard {
  const card = recordedGame("ada-careful").view().card;
  if (card === null) throw new Error("Ada's recorded life has no card.");
  return card;
}

function cardOf(kind: ShareKind, chapter: ShareCard["chapter"] = "chapter.build-the-file"): ShareCard {
  return { ...adaCard(), kind, ...(kind === "chapter" ? { chapter } : {}) };
}

function marks(steps: readonly Step[], role: MarkStep["role"]): MarkStep[] {
  return steps.filter((step): step is MarkStep => step.op === "mark" && step.role === role);
}

function words(steps: readonly Step[]): TextStep[] {
  return steps.filter((step): step is TextStep => step.op === "text");
}

type Point = [number, number];

/** The box a line of words takes: from its baseline up by its size, across by its measured width. */
function boxOf(step: TextStep): Point[] {
  const width = measure(step.text, step.size, step.family, step.weight);
  const left = step.align === "left" ? step.x : step.x - width;
  const top = step.y - step.size;
  return [
    [left, top],
    [left + width, top],
    [left + width, step.y],
    [left, step.y],
  ];
}

/** True when two convex shapes overlap: no edge of either separates them. */
function overlaps(first: Point[], second: Point[]): boolean {
  for (const shape of [first, second]) {
    for (let at = 0; at < shape.length; at += 1) {
      const [x1, y1] = shape[at]!;
      const [x2, y2] = shape[(at + 1) % shape.length]!;
      const axis: Point = [y1 - y2, x2 - x1];
      const project = (points: Point[]) => points.map(([x, y]) => x * axis[0] + y * axis[1]);
      const a = project(first);
      const b = project(second);
      if (Math.max(...a) <= Math.min(...b) || Math.max(...b) <= Math.min(...a)) return false;
    }
  }
  return true;
}

/** Every card the game lays out: each kind, and a chapter card for every chapter's art. */
function everyCard(): { label: string; steps: Step[]; size: Size }[] {
  const kinds = shareKinds.map((kind) => ({ label: kind, steps: cardSteps(cardFace(cardOf(kind), "scenario.ada"), SIZE, measure), size: SIZE }));
  const chapters = shareChapters.map((chapter) => ({ label: chapter, steps: cardSteps(cardFace(cardOf("chapter", chapter), "scenario.ada"), SIZE, measure), size: SIZE }));
  const previews = shareKinds.map((kind) => ({ label: `preview ${kind}`, steps: previewSteps(cardFace(cardOf(kind), null), PREVIEW, measure), size: PREVIEW }));
  return [...kinds, ...chapters, ...previews];
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the marks on every share picture", () => {
  test("[R-SHARE-006] given every card and every preview, when laid out, then a faint watermark of the game's name repeats across the background, under every word", () => {
    for (const { label, steps, size } of everyCard()) {
      const watermark = marks(steps, "watermark");
      expect([label, watermark.length >= 6]).toEqual([label, true]);
      for (const mark of watermark) {
        expect(mark.text).toBe(NAME);
        expect(mark.alpha).toBeGreaterThan(0);
        expect(mark.alpha).toBeLessThanOrEqual(12);
        expect(mark.x).toBeGreaterThanOrEqual(0);
        expect(mark.x).toBeLessThanOrEqual(size.width);
        expect(mark.y).toBeGreaterThanOrEqual(0);
        expect(mark.y).toBeLessThanOrEqual(size.height);
      }
      // Spread over the picture, not bunched in one band: it reaches both halves each way.
      expect(watermark.some((mark) => mark.y < size.height / 2) && watermark.some((mark) => mark.y > size.height / 2)).toBe(true);
      expect(watermark.some((mark) => mark.x < size.width / 2) && watermark.some((mark) => mark.x > size.width / 2)).toBe(true);
      const lastMark = Math.max(...watermark.map((mark) => steps.indexOf(mark)));
      const firstWord = steps.findIndex((step) => step.op === "text");
      expect([label, lastMark < firstWord]).toEqual([label, true]);
    }
  });

  test("[R-SHARE-006] given every card and every preview, when laid out, then one diagonal badge with the game's name sits on a top corner and covers no word", () => {
    for (const { label, steps, size } of everyCard()) {
      const badges = marks(steps, "badge");
      expect([label, badges.length]).toEqual([label, 1]);
      const badge = badges[0]!;
      expect(badge.text.toLowerCase()).toBe(NAME.toLowerCase());
      expect(Math.abs(badge.angle)).toBe(45);
      expect(badge.alpha).toBe(100);
      const band = badge.band!.points;
      // A top corner: the band touches the top edge and one side edge.
      expect(band.some(([, y]) => y === 0)).toBe(true);
      expect(band.some(([x]) => x === 0) || band.some(([x]) => x === size.width)).toBe(true);
      expect(badge.y).toBeLessThan(size.height / 4);
      for (const word of words(steps)) expect([label, word.text, overlaps(boxOf(word), band)]).toEqual([label, word.text, false]);
    }
  });

  test("[R-SHARE-006] given every card and every preview, when laid out, then the game's name and its address are at the foot", () => {
    for (const { label, steps, size } of everyCard()) {
      const sender = words(steps).find((step) => step.role === "sender");
      const address = words(steps).find((step) => step.role === "address");
      expect([label, sender?.text, address?.text]).toEqual([label, NAME, text["share.address"]]);
      expect(sender!.y).toBeGreaterThan(size.height * 0.75);
      expect(address!.y).toBeGreaterThan(size.height * 0.75);
    }
  });

  test("[R-SHARE-006] given a card and a preview drawn on the canvas, when encoded, then the watermark and the badge were painted before the file was made", async () => {
    const drawn = fakeCanvas(() => 1000);
    expect((await renderCard(cardFace(adaCard(), "scenario.ada"))).ok).toBe(true);
    const names = drawn.texts.filter((entry) => entry.text.toLowerCase() === NAME.toLowerCase());
    // The watermark's repeats, the badge and the word mark at the foot.
    expect(names.length).toBeGreaterThanOrEqual(8);
    const preview = fakeCanvas(() => 1000);
    expect((await renderPreview(cardFace(adaCard(), null))).ok).toBe(true);
    expect(preview.texts.filter((entry) => entry.text.toLowerCase() === NAME.toLowerCase()).length).toBeGreaterThanOrEqual(8);
  });
});
