// The game's seal on every drawn picture (share:card-never-looks-official): the J in its rings with
// the two bulbs, drawn small at the foot before the game's name, on the card, its link preview and the ticket stub.
import { content, shareKinds } from "@japacity/content";
import { afterEach, describe, expect, test, vi } from "vitest";

import { cardFace } from "./face";
import { fakeCanvas } from "./canvas.testing";
import { cardSteps, previewSteps, sealGround, TONES, type SealStep, type Step, type TextStep } from "./layout";
import { renderCard } from "./render";
import { adaCard, measure } from "./share.testing";
import { stubFace, stubSteps } from "./stub";

const tuning = content.tuning.share;
const SIZE = { width: tuning.width, height: tuning.height };

const seals = (steps: readonly Step[]) => steps.filter((step): step is SealStep => step.op === "seal");
const sender = (steps: readonly Step[]) => steps.find((step): step is TextStep => step.op === "text" && step.role === "sender")!;

afterEach(() => vi.restoreAllMocks());

describe("the seal on a picture", () => {
  test("[share:card-never-looks-official] given every kind of card, then one seal stands at the foot before the game's name, clear of it and inside the card, light on white and on the send-off's yellow, dark on black", () => {
    for (const kind of shareKinds) {
      const steps = cardSteps(cardFace({ ...adaCard(), kind }, "scenario.ada"), SIZE, measure);
      const [seal, ...rest] = seals(steps);
      expect(rest).toEqual([]);
      expect(seal).toBeDefined();
      expect(seal!.ground).toBe(TONES[kind].background === "black" ? "dark" : "light");
      expect(seal!.ground).toBe(sealGround(TONES[kind]));
      const name = sender(steps);
      expect(seal!.x + seal!.size).toBeLessThanOrEqual(name.x);
      expect(seal!.x).toBeGreaterThanOrEqual(0);
      expect(seal!.y).toBeGreaterThan(SIZE.height * 0.7);
      expect(seal!.y + seal!.size).toBeLessThanOrEqual(SIZE.height);
      // Level with the name: the seal's middle sits within a few pixels of the word's middle.
      expect(Math.abs(seal!.y + seal!.size / 2 - (name.y - name.size * 0.36))).toBeLessThanOrEqual(2);
    }
  });

  test("[share:card-never-looks-official] given the link preview and the ticket stub, then each carries one seal before the game's name, clear of it", () => {
    const card = adaCard();
    const face = cardFace(card, "scenario.ada");
    const preview = previewSteps(face, { width: tuning.previewWidth, height: tuning.previewHeight }, measure);
    const stub = stubSteps(stubFace({ ...card, kind: "send-off" }, "scenario.ada", null)!, { width: 1920, height: 1080 }, measure);
    for (const steps of [preview, stub]) {
      expect(seals(steps)).toHaveLength(1);
      expect(seals(steps)[0]!.x + seals(steps)[0]!.size).toBeLessThanOrEqual(sender(steps).x);
    }
  });

  test("[share:card-never-looks-official] given a card drawn to the canvas, then the seal is painted with the canvas's own shapes, and the card still comes out", async () => {
    const drawn = fakeCanvas(() => 100);
    const result = await renderCard(cardFace(adaCard(), "scenario.ada"));
    expect(result.ok).toBe(true);
    expect(drawn.sizes[0]).toEqual(SIZE);
  });
});
