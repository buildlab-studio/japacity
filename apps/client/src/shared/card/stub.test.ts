// The send-off's ticket stub (docs/rules/share.md R-SHARE-001, R-SHARE-004 to R-SHARE-006, R-SHARE-009;
// decision 0018): a landscape card in the game's drawn hand with FROM, TO, MONTHS and JAPACITY, the type
// badge and the first name, and nothing a real ticket carries: no airline, no barcode, no airport code.
import { content, japaTypes, shareKinds, text, type JapaType } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { afterEach, describe, expect, test, vi } from "vitest";

import { recordedGame } from "../testing/fixtures";
import { japaTypeOf } from "../words/japaType";
import { ART_IDS, artShapes } from "./art";
import { QUALITIES } from "./encode";
import { playedWords } from "./face";
import { fakeCanvas } from "./fakeCanvas";
import type { MarkStep, Measure, Step, TextStep } from "./layout";
import { renderStub } from "./render";
import { stubFace, stubSize, stubSteps } from "./stub";

const tuning = content.tuning.share;
const SIZE = stubSize(tuning);
const measure: Measure = (words, size) => Math.round(words.length * size * 0.55);

type Card = NonNullable<PlayerView["card"]>;

function adaSendOff(): PlayerView {
  const view = recordedGame("ada-careful").view();
  if (view.card?.kind !== "send-off") throw new Error("Ada's recorded life does not end at the send-off.");
  return view;
}

function texts(steps: readonly Step[]): TextStep[] {
  return steps.filter((step): step is TextStep => step.op === "text");
}

function role(steps: readonly Step[], wanted: TextStep["role"]): string[] {
  return texts(steps)
    .filter((step) => step.role === wanted)
    .map((step) => step.text);
}

/** Everything the stub draws as words: its own and the marks'. */
function drawnWords(steps: readonly Step[]): string[] {
  return steps.flatMap((step) => (step.op === "text" || step.op === "mark" ? [step.text] : []));
}

/** Ada's stub with each type in turn, and with her card sent to each country a way out goes to. */
function everyStub(): { label: string; steps: Step[] }[] {
  const card = adaSendOff().card!;
  const ways = Object.values(content.route).filter((route) => route.country !== null);
  const byType = japaTypes.map((type) => ({ label: type, steps: stubSteps(stubFace(card, "scenario.ada", type)!, SIZE, measure) }));
  const byWay = ways.map((route) => ({ label: route.id, steps: stubSteps(stubFace({ ...card, route: route.id }, "scenario.ada", "long-way-round")!, SIZE, measure) }));
  return [...byType, ...byWay];
}

const MONEY = /[₦£$€]|\bnaira\b|\bpounds?\b|\bdollars?\b|\bkobo\b/i;
const TICKET = /airline|airways|air\b|barcode|boarding|\bseat\b|\bgate\b|flight|booking|\bref\b|reference|pnr|e-ticket|terminal|passport|class\b|economy|business|\bcrest\b/i;
/** Three capitals alone read as an airport's code: LOS, LHR, YYZ, DXB. */
const CODE = /\b[A-Z]{3}\b/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the ticket stub's face", () => {
  test("[R-SHARE-004] given Ada's send-off, when her stub is laid out, then it shows FROM Lagos, TO the country, MONTHS as the cards say them, JAPACITY, her type and her first name", () => {
    const view = adaSendOff();
    const card = view.card!;
    const type = japaTypeOf(view)!;
    const steps = stubSteps(stubFace(card, "scenario.ada", type)!, SIZE, measure);
    expect(role(steps, "stub-label")).toEqual(["FROM", "TO", "MONTHS", "JAPACITY"]);
    const country = content.route[card.route!]!.country!;
    // A value too wide for its column wraps onto a second line; read in order, the lines are the four values.
    expect(role(steps, "stub-value").join(" ")).toBe(["Lagos", text[`${country}.name`], playedWords(card.months), String(card.percent)].join(" "));
    expect(role(steps, "percent-sign")).toEqual(["%"]);
    expect(role(steps, "type-label")).toEqual([text["share.stub.badge"]!.toUpperCase()]);
    expect(role(steps, "type-name").join(" ")).toBe(text[`share.type.${type}.name`]);
    expect(role(steps, "type-line").join(" ")).toBe(text[`share.type.${type}.line`]);
    // R-SHARE-004 as amended 16 Oct 2026: the name the band says, the first word of the life's own name.
    expect(role(steps, "name")).toEqual([(text["scenario.ada.name"] ?? "").split(/\s+/)[0]]);
    expect(role(steps, "sender")).toEqual(["Japacity"]);
    expect(role(steps, "official")).toEqual(["Official accounts: japacity.app/official"]);
    const disclaimer = texts(steps).find((step) => step.role === "disclaimer")!;
    const address = texts(steps).find((step) => step.role === "address")!;
    expect(disclaimer.text).toBe("Japacity is a game.");
    expect(address.text).toBe("japacity.app");
    expect(disclaimer.size).toBeGreaterThanOrEqual(address.size);
  });

  test("[R-SHARE-004] given a send-off with no type read yet, when laid out, then the stub keeps its fields and draws no badge", () => {
    const steps = stubSteps(stubFace(adaSendOff().card!, "scenario.ada", null)!, SIZE, measure);
    expect(role(steps, "stub-label")).toHaveLength(4);
    expect(role(steps, "type-name")).toEqual([]);
    expect(role(steps, "type-line")).toEqual([]);
  });

  test("[R-SHARE-001] given every kind but the send-off, or a send-off with no country to name, then there is no stub", () => {
    const card = adaSendOff().card!;
    for (const kind of shareKinds.filter((each) => each !== "send-off")) expect(stubFace({ ...card, kind }, "scenario.ada", "careful-saver")).toBeNull();
    expect(stubFace({ ...card, route: "route.road" }, "scenario.ada", "careful-saver")).toBeNull();
    expect(stubFace({ ...card, route: null }, "scenario.ada", "careful-saver")).toBeNull();
    expect(stubFace(card, "scenario.ada", "careful-saver")).not.toBeNull();
  });

  test("[R-SHARE-006] given every type and every country, when the stub is laid out, then no word drawn names an airline, a barcode, a seat, a booking or an airport's code, and the art is palette shapes alone", () => {
    for (const { label, steps } of everyStub()) {
      for (const words of drawnWords(steps)) {
        expect([label, words, TICKET.test(words)]).toEqual([label, words, false]);
        expect([label, words, CODE.test(words)]).toEqual([label, words, false]);
      }
      expect(steps.every((step) => ["rect", "poly", "circle", "line", "text", "mark", "seal", "clip", "unclip"].includes(step.op))).toBe(true);
    }
    expect(ART_IDS).toContain(text["share.send-off.art"]);
    expect(artShapes(text["share.send-off.art"]!, { x: 0, y: 0, w: SIZE.width, h: SIZE.height })?.length).toBeGreaterThan(4);
  });

  test("[R-SHARE-005] given every type and figures at their edges, when the stub is laid out, then no sum of money is drawn and the only numbers are the figure and the time played", () => {
    const card = adaSendOff().card!;
    for (const type of [...japaTypes, null] as (JapaType | null)[]) {
      for (const [percent, months] of [
        [0, 0],
        [100, 1],
        [57, 600],
      ] as const) {
        const steps = stubSteps(stubFace({ ...card, percent, months }, "scenario.ada", type)!, SIZE, measure);
        const allowed = new Set([String(percent), String(Math.floor(months / 12)), String(months % 12)]);
        for (const words of drawnWords(steps)) {
          expect(words).not.toMatch(MONEY);
          for (const number of words.match(/\d+/g) ?? []) expect(allowed.has(number)).toBe(true);
        }
      }
    }
  });

  test("[R-SHARE-006] given every stub, when laid out, then it carries the watermark under its words, the corner badge clear of them, and the branding with the address at the foot", () => {
    for (const { label, steps } of everyStub()) {
      const marks = steps.filter((step): step is MarkStep => step.op === "mark");
      const watermark = marks.filter((mark) => mark.role === "watermark");
      const badge = marks.filter((mark) => mark.role === "badge");
      expect([label, watermark.length >= 6, badge.length]).toEqual([label, true, 1]);
      const firstWord = steps.findIndex((step) => step.op === "text");
      expect(Math.max(...watermark.map((mark) => steps.indexOf(mark)))).toBeLessThan(firstWord);
      // The badge's band across the top right corner: every word sits further from the corner than its far edge.
      const far = Math.max(...badge[0]!.band!.points.map(([x, y]) => SIZE.width - x + y));
      for (const word of texts(steps)) {
        const right = word.align === "left" ? word.x + measure(word.text, word.size, word.family, word.weight) : word.x;
        expect([label, word.text, SIZE.width - right + (word.y - word.size) > far]).toEqual([label, word.text, true]);
      }
      const foot = texts(steps).filter((step) => step.role === "sender" || step.role === "address");
      expect(foot.map((step) => step.text)).toEqual(["Japacity", "japacity.app"]);
      for (const step of foot) expect(step.y).toBeGreaterThan(SIZE.height * 0.8);
    }
  });
});

describe("the ticket stub's size", () => {
  test("[R-SHARE-009] given the tuning's card size, then the stub is the same card turned on its side: landscape, a ticket's shape", () => {
    expect(SIZE).toEqual({ width: tuning.height, height: tuning.width });
    expect(SIZE.width).toBeGreaterThan(SIZE.height);
  });

  test("[R-SHARE-009] given every stub, when laid out, then every word sits inside the picture and the fields end above the foot", () => {
    for (const { label, steps } of everyStub()) {
      const foot = Math.min(...texts(steps).filter((step) => ["sender", "disclaimer", "address", "official"].includes(step.role)).map((step) => step.y - step.size));
      for (const step of texts(steps)) {
        const width = measure(step.text, step.size, step.family, step.weight);
        const left = step.align === "left" ? step.x : step.x - width;
        const inFoot = ["sender", "disclaimer", "address", "official"].includes(step.role);
        expect([label, step.text, left >= 0 && left + width <= SIZE.width && step.y <= SIZE.height]).toEqual([label, step.text, true]);
        expect([label, step.text, inFoot || step.y < foot]).toEqual([label, step.text, true]);
      }
    }
  });

  test("[R-SHARE-009] given a canvas, when the stub is drawn, then it is a landscape JPEG under the limit, and refused when no quality fits", async () => {
    const card: Card = adaSendOff().card!;
    const face = stubFace(card, "scenario.ada", "careful-saver")!;
    const drawn = fakeCanvas((quality) => (quality > QUALITIES[1] ? tuning.maxBytes : tuning.maxBytes - 1));
    const made = await renderStub(face);
    expect(made.ok && made.quality).toBe(QUALITIES[1]);
    expect(made.ok && made.blob.size).toBeLessThan(tuning.maxBytes);
    expect(drawn.sizes).toEqual([SIZE]);
    expect(drawn.texts.map((entry) => entry.text)).toEqual(expect.arrayContaining(["Japacity is a game.", "FROM", "TO", "Lagos"]));
    expect(drawn.texts.map((entry) => entry.text).join(" ")).toContain("The Careful Saver");
    fakeCanvas(() => tuning.maxBytes);
    expect((await renderStub(face)).ok).toBe(false);
  });
});
