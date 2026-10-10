// The nurse's way, from the clinic to the visa, every step reachable (docs/rules/world.md R-WORLD-003, R-WORLD-015;
// The ready nurse's "Ask the council for your verification" opened a clinic the map
// kept shut for seven months; the visa nudge opened a shut visa centre with four things still missing. Real content,
// both nurses played through `step`: the tile's nurse from school and the ready nurse.
import { content } from "@japacity/content";
import type { PlayerView, SlotPick } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import clinic from "../../../public/assets/places/tb-clinic/place.json";
import { earlyStops } from "../../shared/words/sixteen";
import { hasWords, say } from "../../shared/words/text";
import { actsOffered } from "./acts";
import { nudgeOf, stepThingHere, stepWayOf } from "./nudge";
import { CARE, hearCare, hire, month, readCare, readyNurse, tileNurse, until } from "./nurse.testing";
import { type PlaceFile, stageOf } from "./placeFile";
import { stepOpen } from "./stepOpen";
import { stagedNow, thingsNow, thingsOf, withMoreAt } from "./things";
import { stopReached } from "./stops";
import type { Game } from "../../../../../packages/sim/src/testing/play";

const CLINIC = "place.tb-clinic";
const VISA_CENTRE = "place.visa-centre";
const FILE = "chapter.build-the-file-care";
const NUDGE_WORDS = 8;
/** The care route sent, or past it. */
const SENT = ["applying", "granted", "departed"];

/** The clinic's things as the city reads them for this view: the place file's, the tables' extra entries, only what can open now. */
function clinicThings(view: PlayerView): ReturnType<typeof thingsNow> {
  const staged = new Set<string>(content.place[CLINIC]?.stages ?? []);
  return thingsNow(withMoreAt(thingsOf(stageOf(clinic as unknown as PlaceFile)), CLINIC), stagedNow(new Set(actsOffered(view)), staged, new Set(), null, view.chapter.current));
}

/** True when the map lets the player ride to the stop, as the city reads it. */
function reached(view: PlayerView, place: string): boolean {
  return stopReached(view.chapter, view.place.where, place, earlyStops(view));
}

/** What the nudge's tap opens while the player stands at `here`, as the city follows it. */
function opensAt(view: PlayerView, here: string): ReturnType<typeof stepOpen> | null {
  const way = stepWayOf(view);
  if (way === null) return null;
  const things = here === CLINIC ? clinicThings(view) : [];
  return stepOpen(way, stepThingHere(way, here, things), view.activities.filter((option) => option.allowed).map((option) => option.id), here);
}

/** The ready nurse in her care file: care work heard of at the meetup and its page read, the first chapter closed. */
function readyInTheFile(open = false): Game {
  const game = readyNurse("ready-nurse", open);
  hearCare(game);
  readCare(game);
  until(game, (view) => view.chapter.current === FILE, 4);
  return game;
}

/** The stop the nudge's way goes to this month when the map keeps it shut, else null. */
function shutStop(view: PlayerView): string | null {
  const go = stepWayOf(view)?.go ?? null;
  return go === null || reached(view, go) ? null : `${String(view.month)}: ${go}`;
}

/** The act each care step's nudge names, as a player follows it: the tables' step's own act. */
const ACT_OF: Record<string, string> = {
  "chapter.build-the-file.item.passport": "activity.get-passport",
  "chapter.build-the-file.item.english": "activity.sit-english-test",
  "chapter.decision-day-care.item.tb": "activity.tb-test",
  "chapter.decision-day-care.item.police": "activity.get-police-certificate",
  "chapter.build-the-file-care.item.licence": "activity.renew-licence",
  "chapter.build-the-file-care.item.verification": "activity.request-verification",
  "chapter.build-the-file-care.item.sponsor": "activity.find-sponsor",
  "chapter.build-the-file-care.item.salary": "activity.find-sponsor",
  "chapter.build-the-file-care.item.applied": "activity.apply-uk-care",
};

/** The act the nudge names this month, if it is one the player can take now: what a player who follows the nudge does. */
function followed(view: PlayerView): SlotPick[] {
  const key = nudgeOf(view).key.replace(/\.nudge(\.here)?$/, "");
  const act = ACT_OF[key];
  const option = view.activities.find((candidate) => candidate.id === act);
  if (act === undefined || option?.allowed !== true || !option.affordable) return [];
  return [{ activity: act, param: act === "activity.find-sponsor" ? CARE : null } as SlotPick];
}

describe("the nurse's way never opens a shut place", () => {
  test("[R-WORLD-015] [R-WORLD-003] given the ready nurse in her care file, when the nudge asks for the council's verification, then the clinic is open on the map every month until it is asked, and at the clinic the tap opens the council's own card", () => {
    const game = readyInTheFile();
    for (let months = 0; months < 7; months += 1) {
      const view = game.view();
      expect(nudgeOf(view).key).toBe(`${FILE}.item.verification.nudge`);
      expect(stepWayOf(view)?.go).toBe(CLINIC);
      expect(reached(view, CLINIC)).toBe(true);
      expect(opensAt(view, CLINIC)).toEqual({ kind: "act", activity: "activity.request-verification" });
      // Away from it, the map opens with the clinic picked, never a stop marked not yet.
      expect(opensAt(view, "place.family-house")).toEqual({ kind: "map", stop: CLINIC });
      month(game);
    }
  });

  test("[R-WORLD-015] given the ready nurse before she hears of care work, when the stops are read, then the clinic is not yet; once care work is her plan it is open", () => {
    const game = readyNurse();
    expect(reached(game.view(), CLINIC)).toBe(false);
    hearCare(game);
    expect(game.view().plan.route).toBe(CARE);
    expect(reached(game.view(), CLINIC)).toBe(true);
  });

  test("[R-WORLD-003] [R-WORLD-015] given the ready nurse with a sponsor, when the visa is next, then the nudge names each missing thing in the route's order and opens its way, the visa centre opens with the step, and the application is named only once nothing is missing", () => {
    const game = readyInTheFile(true);
    const seen: string[] = [];
    const shut: string[] = [];
    until(
      game,
      (view) => {
        const key = nudgeOf(view).key;
        if (seen.at(-1) !== key) seen.push(key);
        return key === `${FILE}.item.applied.nudge`;
      },
      90,
      (view) => {
        // Every month the nudge names a step whose stop the map lets her ride to.
        shut.push(...[shutStop(view)].filter((stop) => stop !== null));
        return followed(view);
      },
    );
    expect(shut).toEqual([]);
    const view = game.view();
    const care = view.routes.find((route) => route.id === CARE)!;
    // When the application is named, everything the visa needs before it is in.
    expect(care.checklist.filter((item) => !item.met).map((item) => item.id)).toEqual(["applied"]);
    expect(stepWayOf(view)?.go).toBe(VISA_CENTRE);
    expect(reached(view, VISA_CENTRE)).toBe(true);
    // On the way, each missing thing was named before the application, in the route's order: the English test, the TB test, the police paper.
    const order = ["chapter.build-the-file.item.english", "chapter.decision-day-care.item.tb", "chapter.decision-day-care.item.police"].map((own) => seen.findIndex((key) => key.startsWith(own)));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(seen.indexOf(`${FILE}.item.applied.nudge`)).toBeGreaterThan(Math.max(...order));
  });

  test("[R-WORLD-003] given the tile's nurse with a sponsor and no passport, English, TB or police paper, when the visa is next, then the nudge names the passport first and never the application while one is missing", () => {
    const game = tileNurse("nurse-way-1", true);
    hire(game);
    readCare(game);
    const seen: string[] = [];
    const shut: string[] = [];
    const early: string[] = [];
    until(
      game,
      (view) => {
        const key = nudgeOf(view).key;
        if (seen.at(-1) !== key) seen.push(key);
        const care = view.routes.find((route) => route.id === CARE);
        const missing = (care?.checklist ?? []).filter((item) => !item.met && item.id !== "applied").map((item) => item.id);
        if (key === `${FILE}.item.applied.nudge` && missing.length > 0) early.push(`${String(view.month)}: ${missing.join(", ")}`);
        return SENT.includes(care?.state ?? "unknown");
      },
      120,
      (view) => {
        shut.push(...[shutStop(view)].filter((stop) => stop !== null));
        return followed(view);
      },
    );
    expect(shut).toEqual([]);
    expect(early).toEqual([]);
    const firstPaper = seen.findIndex((key) => key.startsWith("chapter.build-the-file.item.passport") || key.startsWith("chapter.build-the-file.item.english") || key.startsWith("chapter.decision-day-care"));
    expect(seen[firstPaper]).toMatch(/^chapter\.build-the-file\.item\.passport/);
  });

  test("[R-WORLD-003] given the care file's new words, when each is said, then it is one sentence in under eight words", () => {
    const keys = ["item.tenure.count", "item.licence.nudge", "item.licence.started", "item.salary.nudge", "item.window.nudge"].map((key) => `${FILE}.${key}`);
    for (const key of keys) {
      expect(hasWords(key)).toBe(true);
      const said = say(key, { done: 14, need: 24, when: "next month", amount: "₦25,000" });
      expect(said.split(/\s+/).filter(Boolean).length).toBeLessThan(NUDGE_WORDS);
      expect(said).not.toMatch(/[{}]|[.]$/);
    }
  });
});
