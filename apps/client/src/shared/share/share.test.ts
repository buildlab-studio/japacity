import { content, shareChapters, shareKinds, text, type ShareKind } from "@japacity/content";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ART_IDS, artShapes } from "./art";
import { encodeUnder, QUALITIES, underLimit } from "./encode";
import { cardFace, cardLink, playedWords, standingWords, type ShareCard } from "./face";
import { fakeCanvas } from "./canvas.testing";
import { cardSteps, previewSteps, wrap, type Step, type TextStep } from "./layout";
import { renderCard, renderPreview } from "./render";
import { adaCard, measure, texts } from "./share.testing";
import { canShareFiles, sendCard, shareData, type Device } from "./travel";

const tuning = content.tuning.share;
const SIZE = { width: tuning.width, height: tuning.height };
const PREVIEW = { width: tuning.previewWidth, height: tuning.previewHeight };

/** Ada's name as the band says it (R-SHARE-004): "Adaeze", never a shorter name the band does not use. */
const BAND_NAME = (text["scenario.ada.name"] ?? "").split(/\s+/)[0];

/** Ada's card as each kind would carry it, with the chapter a chapter card closes. */
function cardOf(kind: ShareKind): ShareCard {
  return { ...adaCard(), kind, ...(kind === "chapter" ? { chapter: "chapter.build-the-file" as const } : {}) };
}

function role(steps: readonly Step[], wanted: TextStep["role"]): TextStep[] {
  return texts(steps).filter((step) => step.role === wanted);
}

const MONEY = /[₦£$€]|\bnaira\b|\bpounds?\b|\bdollars?\b|\bkobo\b/i;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("what is on a card", () => {
  test("[R-SHARE-004] given every kind, when its card is laid out, then it has the kind's title, the game as the sender with its address, and says Japacity is a game no smaller than the address", () => {
    for (const kind of shareKinds) {
      const steps = cardSteps(cardFace(cardOf(kind), "scenario.ada"), SIZE, measure);
      expect(role(steps, "title").map((step) => step.text).join(" ")).toBe(text[`share.${kind}.title`]);
      expect(role(steps, "sender")[0]?.text).toBe("Japacity");
      const address = role(steps, "address")[0];
      const disclaimer = role(steps, "disclaimer")[0];
      expect(disclaimer?.text).toBe("Japacity is a game.");
      expect(address?.text).toBe("japacity.app");
      expect(disclaimer!.size).toBeGreaterThanOrEqual(address!.size);
      expect(steps.some((step) => step.op === "clip")).toBe(true);
    }
  });

  test("[R-SHARE-004] [R-TEXT-005] given Ada's send-off, when laid out, then her first name, the route, the japacity figure, the time played in years and months, the standing as its band and what she did most are drawn", () => {
    const card = adaCard();
    const steps = cardSteps(cardFace(card, "scenario.ada"), SIZE, measure);
    // R-SHARE-004: the name the band says, the first word of the life's own name.
    expect(role(steps, "name")[0]?.text).toBe(BAND_NAME);
    expect(role(steps, "route")[0]?.text).toBe(text[`${card.route!}.name`]);
    expect(role(steps, "percent")[0]?.text).toBe(String(card.percent));
    const [months, ...standing] = role(steps, "value").map((step) => step.text);
    expect(months).toBe(playedWords(card.months));
    expect(standing.join(" ")).toBe(standingWords(card.standing));
    expect(standingWords(card.standing)).not.toBe("");
    expect(role(steps, "most")).toHaveLength(Math.min(3, card.topActivities.length));
  });

  test("[R-SHARE-004] given a chapter card, when laid out, then it names the chapter it closes and draws that chapter's art", () => {
    const face = cardFace(cardOf("chapter"), "scenario.ada");
    expect(face.chapter).toBe(text["chapter.build-the-file.name"]);
    expect(face.art).toBe(text["share.chapter.build-the-file.art"]);
  });

  test("[R-SHARE-005] given every kind and figures at their edges, when the card is laid out, then no sum of money is drawn and the only numbers are the figure and the time played's years and months", () => {
    for (const kind of shareKinds) {
      for (const [percent, months, standing] of [
        [0, 0, 0],
        [100, 1, 100],
        [57, 600, 3],
      ] as const) {
        const card = { ...cardOf(kind), percent, months, standing };
        const steps = cardSteps(cardFace(card, "scenario.ada"), SIZE, measure);
        // The lost card's body still counts its months on the road.
        const allowed = new Set([String(percent), String(months), String(Math.floor(months / 12)), String(months % 12)]);
        for (const step of texts(steps)) {
          expect(step.text).not.toMatch(MONEY);
          for (const number of step.text.match(/\d+/g) ?? []) expect(allowed.has(number)).toBe(true);
        }
      }
    }
  });

  test("[R-SHARE-005] given a draw win, when the card is laid out, then it says the draw was won and carries no figure of the win", () => {
    const steps = cardSteps(cardFace(cardOf("draw-win"), "scenario.ada"), SIZE, measure);
    expect(role(steps, "title").map((step) => step.text).join(" ")).toBe("Won the Friday draw");
    expect(texts(steps).some((step) => MONEY.test(step.text))).toBe(false);
  });

  test("[R-SHARE-006] given every kind, when the card is laid out, then nothing reads as a bank alert, a receipt or an official letter, and the art draws no lettering", () => {
    const banned = /alert|credit|debit|transaction|receipt|\bref\b|balance|transfer|embassy|home office|ministry|approved|\bvisa no/i;
    for (const kind of shareKinds) {
      const steps = cardSteps(cardFace(cardOf(kind), "scenario.ada"), SIZE, measure);
      for (const step of texts(steps)) expect(step.text).not.toMatch(banned);
    }
    for (const id of ART_IDS) expect(artShapes(id, { x: 0, y: 0, w: 900, h: 760 })?.every((shape) => ["rect", "poly", "circle", "line"].includes(shape.op))).toBe(true);
  });

  test("[R-SHARE-006] given the real-story card, when it is made, then the screen lists the credits for the journalism and the image that travels names no outlet", () => {
    const face = cardFace(cardOf("real-story"), "scenario.ada");
    const credits = Object.keys(text).filter((key) => key.startsWith("road.real-story.credit.")).map((key) => text[key]);
    expect(credits.length).toBeGreaterThan(0);
    expect(face.credits).toEqual(credits);
    const drawn = texts(cardSteps(face, SIZE, measure)).map((step) => step.text).join(" ");
    for (const credit of credits) expect(drawn).not.toContain(credit!.split(",")[0]);
  });

  test("[R-SHARE-007] given every kind and every chapter, when its art is looked up, then there is a composition for it drawn in palette shapes alone", () => {
    const ids = [...shareKinds.map((kind) => text[`share.${kind}.art`]), ...shareChapters.map((id) => text[`share.${id}.art`])];
    for (const id of ids) {
      const shapes = artShapes(id ?? "", { x: 0, y: 0, w: 936, h: 760 });
      expect(shapes).not.toBeNull();
      expect(shapes!.length).toBeGreaterThan(4);
    }
    expect(artShapes("art.not-there", { x: 0, y: 0, w: 10, h: 10 })).toBeNull();
  });

  test("[R-SHARE-008] given a card with the player's own name, then that name is drawn and no other; given none, then the character's first name; given no character, then no name", () => {
    expect(cardFace({ ...adaCard(), name: "Kemi" }, "scenario.ada").name).toBe("Kemi");
    expect(cardFace({ ...adaCard(), name: null }, "scenario.ada").name).toBe(BAND_NAME);
    expect(cardFace(adaCard(), null).name).toBeNull();
    const steps = cardSteps(cardFace({ ...adaCard(), name: "Kemi" }, "scenario.ada"), SIZE, measure);
    expect(texts(steps).filter((step) => step.text.includes("Ada"))).toEqual([]);
  });

  test("[R-SHARE-002] given the ending and the real story, when their cards are laid out, then they show no score, and the ending is not offered to share", () => {
    for (const kind of ["lost", "real-story"] as const) {
      const face = cardFace(cardOf(kind), "scenario.ada");
      expect(face.percent).toBeNull();
      expect(face.stats).toBeNull();
      expect(face.most).toEqual([]);
      expect(face.name).toBeNull();
    }
    expect(cardFace(cardOf("lost"), "scenario.ada").shareable).toBe(false);
    for (const kind of shareKinds.filter((each) => each !== "lost")) expect(cardFace(cardOf(kind), "scenario.ada").shareable).toBe(true);
  });

  test("[R-SHARE-014] given every kind, when the card is laid out, then it points to the official accounts page", () => {
    for (const kind of shareKinds) {
      expect(role(cardSteps(cardFace(cardOf(kind), "scenario.ada"), SIZE, measure), "official")[0]?.text).toBe("Official accounts: japacity.app/official");
    }
  });
});

describe("the card's size", () => {
  test("[R-SHARE-009] given every kind, when laid out at the tuning's size, then every word sits inside the card and the words end above the footer", () => {
    for (const kind of shareKinds) {
      const steps = cardSteps(cardFace(cardOf(kind), "scenario.ada"), SIZE, measure);
      const footerTop = SIZE.height - Math.round((300 * SIZE.width) / 1080);
      for (const step of texts(steps)) {
        expect(step.x).toBeGreaterThanOrEqual(0);
        expect(step.x).toBeLessThanOrEqual(SIZE.width);
        expect(step.y).toBeLessThanOrEqual(SIZE.height);
      }
      const words = texts(steps).filter((step) => !["sender", "disclaimer", "address", "official"].includes(step.role));
      expect(Math.max(...words.map((step) => step.y))).toBeLessThan(footerTop);
    }
  });

  test("[R-SHARE-009] given a line wider than the card, when it is wrapped, then no line is wider and no word is lost", () => {
    const words = "People really take this road and the road is long and the sea is wide";
    const lines = wrap(words, 300, (line) => line.length * 20);
    expect(lines.join(" ")).toBe(words);
    for (const line of lines) expect(line.length * 20 <= 300 || !line.includes(" ")).toBe(true);
  });

  test("[R-SHARE-009] given files at the limit's edges, when checked, then one byte under passes and the limit itself is refused", () => {
    expect(underLimit(tuning.maxBytes - 1, tuning.maxBytes)).toBe(true);
    expect(underLimit(tuning.maxBytes, tuning.maxBytes)).toBe(false);
    expect(underLimit(tuning.maxBytes + 1, tuning.maxBytes)).toBe(false);
  });

  test("[R-SHARE-009] given an encoder whose files are over the limit at every quality, when the card is encoded, then the encoder refuses it after the lowest quality", async () => {
    const tried: number[] = [];
    const result = await encodeUnder((quality) => {
      tried.push(quality);
      return Promise.resolve(new Blob([new Uint8Array(tuning.maxBytes)]));
    }, tuning.maxBytes);
    expect(result).toEqual({ ok: false, reason: "too-big", bytes: tuning.maxBytes });
    expect(tried).toEqual([...QUALITIES]);
  });

  test("[R-SHARE-009] given a canvas whose card is over the limit, when the renderer draws it, then its own check refuses it", async () => {
    const drawn = fakeCanvas(() => tuning.maxBytes + 1);
    const result = await renderCard(cardFace(adaCard(), "scenario.ada"));
    expect(result.ok).toBe(false);
    expect(drawn.sizes).toEqual([SIZE]);
    expect(drawn.qualities).toEqual([...QUALITIES]);
  });

  test("[R-SHARE-009] given a canvas whose card fits at a lower quality, when the renderer draws it, then it is a JPEG under the limit at the first quality that fits", async () => {
    const drawn = fakeCanvas((quality) => (quality > QUALITIES[2] ? tuning.maxBytes : tuning.maxBytes - 1));
    const result = await renderCard(cardFace(adaCard(), "scenario.ada"));
    expect(result.ok && result.quality).toBe(QUALITIES[2]);
    expect(result.ok && result.blob.type).toBe("image/jpeg");
    expect(result.ok && result.blob.size).toBe(tuning.maxBytes - 1);
    expect(drawn.texts.map((entry) => entry.text)).toContain("Japacity is a game.");
  });

  test("[R-SHARE-009] given no canvas in this browser, when the card is drawn, then it is refused, not sent half made", async () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    expect(await renderCard(cardFace(adaCard(), "scenario.ada"))).toEqual({ ok: false, reason: "no-image", bytes: 0 });
  });

  test("[R-SHARE-010] given each kind, when its link preview is laid out and drawn, then it is the preview size, under the preview limit, and carries no player's name or figures", async () => {
    for (const kind of shareKinds) {
      const face = cardFace({ ...adaCard(), kind, name: "Kemi" }, "scenario.ada");
      const steps = previewSteps(face, PREVIEW, measure);
      for (const step of texts(steps)) {
        expect(step.text).not.toMatch(/\d|Kemi|Ada/);
        expect(step.x).toBeLessThan(PREVIEW.width);
        expect(step.y).toBeLessThanOrEqual(PREVIEW.height);
      }
    }
    const drawn = fakeCanvas(() => tuning.previewMaxBytes - 1);
    const result = await renderPreview(cardFace(adaCard(), null));
    expect(result.ok).toBe(true);
    expect(drawn.sizes).toEqual([PREVIEW]);
    const over = fakeCanvas(() => tuning.previewMaxBytes);
    expect((await renderPreview(cardFace(adaCard(), null))).ok).toBe(false);
    expect(over.qualities).toEqual([...QUALITIES]);
  });
});

describe("how a card travels", () => {
  function device(canShare: boolean, share: () => Promise<void> = () => Promise.resolve()): Device & { saved: File[]; shared: ShareData[] } {
    const saved: File[] = [];
    const shared: ShareData[] = [];
    return {
      saved,
      shared,
      canShare: () => canShare,
      share: async (data) => {
        shared.push(data);
        await share();
      },
      save: (file) => saved.push(file),
    };
  }

  const blob = new Blob([new Uint8Array(1000)], { type: "image/jpeg" });

  test("[R-SHARE-009] given a share sheet that takes files, when the card is sent, then the JPEG goes to it and nothing is saved", async () => {
    const phone = device(true);
    expect(canShareFiles(phone)).toBe(true);
    expect(await sendCard(blob, "send-off", phone)).toBe("shared");
    const file = phone.shared[0]?.files?.[0];
    expect(file?.type).toBe("image/jpeg");
    expect(file?.name).toBe("japacity-send-off.jpg");
    expect(phone.saved).toEqual([]);
  });

  test("[R-SHARE-009] given no share sheet, or one that refuses files, when the card is sent, then it is saved as a download", async () => {
    const desktop: Device & { saved: File[] } = { saved: [], canShare: undefined, share: undefined, save: (file) => desktop.saved.push(file) };
    expect(canShareFiles(desktop)).toBe(false);
    expect(await sendCard(blob, "december", desktop)).toBe("saved");
    expect(desktop.saved[0]?.name).toBe("japacity-december.jpg");
    const refusing = device(false);
    expect(await sendCard(blob, "december", refusing)).toBe("saved");
    expect(refusing.shared).toEqual([]);
  });

  test("[R-SHARE-009] given the player closes the share sheet, then nothing is saved; given the sheet fails, then the card is saved instead", async () => {
    const closed = device(true, () => Promise.reject(new DOMException("closed", "AbortError")));
    expect(await sendCard(blob, "granted", closed)).toBe("cancelled");
    expect(closed.saved).toEqual([]);
    const failing = device(true, () => Promise.reject(new DOMException("no", "NotAllowedError")));
    expect(await sendCard(blob, "granted", failing)).toBe("saved");
  });

  test("[R-SHARE-011] given any kind, when its share data is made, then the link carries the kind and nothing about the player, and nothing is fetched", async () => {
    const fetched = vi.spyOn(globalThis, "fetch");
    fakeCanvas(() => 1000);
    for (const kind of shareKinds) {
      const made = await renderCard(cardFace({ ...cardOf(kind), name: "Kemi" }, "scenario.ada"));
      expect(made.ok).toBe(true);
      const data = shareData(new File([blob], "card.jpg"), kind);
      const url = new URL(data.url ?? "");
      expect(url.origin).toBe("https://japacity.app");
      expect([...url.searchParams.entries()]).toEqual([["card", kind]]);
      expect(data.url).toBe(cardLink(kind));
      expect(data.text).not.toMatch(/Kemi|Ada|\d/);
    }
    expect(fetched).not.toHaveBeenCalled();
  });
});

/** The pixel size in a JPEG's frame header, or null when there is none. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let at = 2;
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return null;
    const marker = bytes[at + 1]!;
    const length = (bytes[at + 2]! << 8) + bytes[at + 3]!;
    if (marker >= 0xc0 && marker <= 0xc2) return { height: (bytes[at + 5]! << 8) + bytes[at + 6]!, width: (bytes[at + 7]! << 8) + bytes[at + 8]! };
    at += 2 + length;
  }
  return null;
}

const previews: Record<string, string> = import.meta.glob("../../../public/share/*.jpg", { query: "?inline", import: "default", eager: true });

describe("the link previews", () => {
  test("[R-SHARE-010] given the fixed previews, then there is one for every kind, each a JPEG at the preview size and under the preview limit", () => {
    const byKind = new Map(Object.entries(previews).map(([path, url]) => [path.split("/").pop()!.replace(".jpg", ""), url]));
    expect([...byKind.keys()].sort()).toEqual([...shareKinds].sort());
    for (const [, url] of byKind) {
      const bytes = Uint8Array.from(atob(url.split(",")[1] ?? ""), (character) => character.charCodeAt(0));
      expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
      expect(jpegSize(bytes)).toEqual(PREVIEW);
      expect(underLimit(bytes.length, tuning.previewMaxBytes)).toBe(true);
    }
  });
});
