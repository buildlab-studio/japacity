// The life from sixteen read after its handover: which path the prologue built, from
// the life as it stands, on the real content and real draws.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { newGame } from "../testing/fixtures";
import { nextStepOf, RACKS, racksAtHand, sixteenPath } from "./sixteen";

const SETTLED = new Set(["prologue.settlement.outcome.generous", "prologue.settlement.outcome.fair"]);

/** Plays a life from sixteen to its handover, picking by `pick`, and keeps the settlement's outcome if one came. */
function play(seed: string, pick: (allowed: readonly string[], step: string, turn: number) => string) {
  const game = newGame("scenario.prologue", seed);
  let settlement: string | null = null;
  for (let turn = 0; turn < 40 && game.state.prologue.open; turn += 1) {
    const prologue = game.view().prologue!;
    const allowed = prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
    const sent = game.send({ type: "prologue/choose", step: prologue.step, answer: pick(allowed, prologue.step, turn) });
    if (!sent.ok) throw new Error(`${seed}: ${prologue.step} was refused`);
    if (prologue.step === "settlement") settlement = game.state.prologue.lastOutcome;
  }
  return { view: game.view(), settlement };
}

describe("the path the life from sixteen took", () => {
  test("[R-PROLOGUE-008] given many lives from sixteen down every path, when each is read at its handover, then it holds a shop's capital exactly when the master's settlement was generous or fair", () => {
    const seen = new Map<string, number>();
    for (let n = 0; n < 160; n += 1) {
      const { view, settlement } = play(`sixteen-path-${String(n)}`, (allowed, step, turn) =>
        step === "after-school" && n % 3 !== 0 && allowed.includes("apprentice") ? "apprentice" : (allowed[(n + turn) % allowed.length] ?? ""),
      );
      const path = sixteenPath(view);
      seen.set(`${String(path)} ${String(settlement)}`, (seen.get(`${String(path)} ${String(settlement)}`) ?? 0) + 1);
      expect(path === "capital", `sixteen-path-${String(n)} ${String(settlement)}`).toBe(settlement !== null && SETTLED.has(settlement));
    }
    // Every kind of ending is met: a degree, a trade with no settlement, each settlement.
    const kinds = [...seen.keys()];
    expect(kinds).toContain("degree null");
    expect(kinds).toContain("trade null");
    expect(kinds).toContain("capital prologue.settlement.outcome.generous");
    expect(kinds).toContain("capital prologue.settlement.outcome.fair");
    expect(kinds).toContain("trade prologue.settlement.outcome.cheated");
  });

  test("[R-PROLOGUE-008] given a fixed life, when its path is read, then it has none", () => {
    expect(sixteenPath(newGame("scenario.ada").view())).toBeNull();
  });
});

describe("the first step for a trader with capital", () => {
  test("[R-PROLOGUE-008] given a settled trader who heard of no way out, when the first step is read, then it is the meetup, then the official page, before the jobs board", () => {
    const { view } = play("sixteen-0", (allowed) => ["apprentice", "spare-parts", "stay", "settle", "nowhere", "family-house"].find((id) => allowed.includes(id)) ?? allowed[0] ?? "");
    expect(sixteenPath(view)).toBe("capital");
    expect(view.chapter.current).toBe("chapter.find-your-feet");
    expect(view.chapter.items.find((item) => item.id === "job")?.met).toBe(false);
    expect(nextStepOf(view)).toBe("heard");
    const heard = { ...view, chapter: { ...view.chapter, items: view.chapter.items.map((item) => (item.id === "heard" ? { ...item, met: true } : item)) } };
    expect(nextStepOf(heard)).toBe("known");
  });

  test("[R-PROLOGUE-008] given a graduate, when the first step is read, then it is the chapter's own first undone step", () => {
    const { view } = play("prologue-first", (allowed) => allowed[0] ?? "");
    expect(sixteenPath(view)).toBe("degree");
    expect(nextStepOf(view)).toBe(view.chapter.items.find((item) => !item.met)?.id);
    expect(content.chapter[view.chapter.current!]).toBeDefined();
  });
});

describe("the racks at hand", () => {
  /** The child of the water's answers (R-PROLOGUE-012), and the shop worker's, the same years at the family house. */
  const WATER = ["begin", "commercial", "work", "save", "nowhere", "makoko"];
  const SHOP = ["begin", "commercial", "work", "save", "nowhere", "family-house"];
  const by = (answers: readonly string[]) => (allowed: readonly string[]) => answers.find((id) => allowed.includes(id)) ?? allowed[0] ?? "";

  test("[R-ACTIVITY-017] given a life handed over in Makoko's room with no job, when the racks are read, then they are at hand, and for the same years at the family house they are not", () => {
    for (const seed of ["racks-0", "racks-1", "racks-2"]) {
      const water = play(seed, by(WATER)).view;
      expect(water.activities.find((option) => option.id === "activity.job-hunt")?.params).toContain(RACKS);
      expect(racksAtHand(water)).toBe(true);
      expect(racksAtHand({ ...water, job: { ...water.job, id: RACKS } })).toBe(false);
      expect(racksAtHand(play(seed, by(SHOP)).view)).toBe(false);
    }
  });
});
