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
import { CARE, hearCare, hire, month, readCare, readyNurse, tileNurse, until } from "../../shared/testing/nurse";
import { type PlaceFile, stageOf } from "./placeFile";
import { sceneWords } from "./scene.words";
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
  "ui.nudge.meanwhile.nurse-certification": "activity.nurse-certification",
};

/** The act the nudge names this month, if it is one the player can take now: what a player who follows the nudge does. */
function followed(view: PlayerView): SlotPick[] {
  const key = nudgeOf(view).key.replace(/\.nudge(\.here)?$/, "");
  const act = ACT_OF[key];
  const option = view.activities.find((candidate) => candidate.id === act);
  if (act === undefined || option?.allowed !== true || !option.affordable) return [];
  return [{ activity: act, param: act === "activity.find-sponsor" ? CARE : null } as SlotPick];
}

const CARE_CHAPTER = new Set([FILE, "chapter.decision-day-care"]);

/** As `followed`, but the licence is left to run out: the months before a lapse, played as a player who never renews early. */
function followedButLicence(view: PlayerView): SlotPick[] {
  return followed(view).filter((pick) => pick.activity !== "activity.renew-licence");
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

describe("the nurse's nudges point at the chip that holds the act", () => {
  test("[R-WORLD-003] [R-WORLD-005] given the ready nurse at the council's step, when the clinic's notice is read, then the chip that holds the act is named the council and lists the verification and the licence's renewal", () => {
    const view = readyInTheFile().view();
    const notice = clinicThings(view).find((thing) => thing.id === stepThingHere(stepWayOf(view)!, CLINIC, clinicThings(view)));
    const council = notice?.acts.find((act) => [act.stages, ...(act.more ?? [])].includes("activity.request-verification"));
    expect(sceneWords(council?.label ?? "")).toBe("The council");
    expect([council?.stages, ...(council?.more ?? [])]).toEqual(expect.arrayContaining(["activity.request-verification", "activity.renew-licence"]));
  });

  test("[R-WORLD-003] [R-CHAPTER-009] given the tile's nurse at work who has heard of care work, when the page is next, then the nudge names the page in Japa in under eight words and its tap opens Japa, where the care page is one tap away", () => {
    const game = tileNurse("nurse-page");
    hire(game);
    const view = until(game, (now) => now.chapter.items.find((item) => item.id === "pay")?.met === true, 3);
    expect(view.chapter.items.find((item) => item.id === "known")?.met).toBe(false);
    const nudge = nudgeOf(view);
    expect(nudge).toEqual({ key: "chapter.find-your-feet.item.known.own.needs", params: { route: "care work" }, about: "step" });
    // A step's `.needs` words open Japa on a tap (City.tsx's `nudgeNeeds`), never the map.
    expect(nudge.key.endsWith(".needs")).toBe(true);
    const said = say(nudge.key, nudge.params);
    expect(said).toBe("Read about care work in Japa");
    expect(said.split(/\s+/).length).toBeLessThan(NUDGE_WORDS);
    // Japa offers the page of the plan's way: care work is the plan and the page offers it.
    expect(view.plan.route).toBe(CARE);
    expect(view.activities.find((option) => option.id === "activity.look-into-route")?.params).toContain(CARE);
  });

  test("[R-WORLD-003] [R-ACTIVITY-013] given the tile's nurse months into her job while the council works, when the nudge is read, then it never sends her to the hub's board to get noticed", () => {
    const game = tileNurse("nurse-noticed");
    hire(game);
    readCare(game);
    const asked: string[] = [];
    until(game, (view) => view.documents.some((paper) => paper.id === "document.nmcn-verification"), 40, (view) => (view.activities.find((option) => option.id === "activity.request-verification")?.allowed === true ? [{ activity: "activity.request-verification", param: null }] : []));
    for (let months = 0; months < 6; months += 1) {
      const view = game.view();
      asked.push(nudgeOf(view).key, stepWayOf(view)?.go ?? "month");
      month(game, followed(view));
    }
    expect(asked).not.toContain("ui.nudge.meanwhile.be-noticed");
    expect(asked).not.toContain("place.yaba");
    expect(game.view().job.months).toBeGreaterThanOrEqual(6);
  });
});

describe("the nurse's waiting months and her licence", () => {
  test("[R-WORLD-003] [R-ACTIVITY-013] given the tile's nurse on the ward, when the nudge is read each month of the twenty-four, then it names one thing of hers to do or counts the months, never keep nursing alone", () => {
    const game = tileNurse("nurse-ward");
    hire(game);
    readCare(game);
    until(game, (view) => view.chapter.current === FILE, 4);
    const said: string[] = [];
    until(
      game,
      (view) => view.chapter.items.find((item) => item.id === "tenure")?.met === true,
      30,
      (view) => {
        const nudge = nudgeOf(view);
        said.push(say(nudge.key, nudge.params ?? {}));
        return followed(view);
      },
    );
    expect(said.length).toBeGreaterThan(12);
    expect(said).not.toContain(say(`${FILE}.item.tenure.nudge`));
    // The months counted, each month a count that rises: "Keep nursing: 14 of 24 months done".
    const counts = said.filter((line) => line.startsWith("Keep nursing:")).map((line) => Number(/(\d+) of 24/.exec(line)?.[1]));
    expect(counts.length).toBeGreaterThan(0);
    expect(counts.every((count, at) => at === 0 || count > (counts[at - 1] ?? 0))).toBe(true);
    // The first thing of hers to do in those months is her passport, before the months are only counted.
    expect(said.findIndex((line) => line === say("chapter.build-the-file.item.passport.nudge"))).toBeLessThan(said.findIndex((line) => line.startsWith("Keep nursing:")));
  });

  test("[R-WORLD-003] [R-DOCUMENT-004] given the tile's nurse whose licence runs out in the care file, when the nudge is read, then it names the renewal at the clinic, its tap there opens the renewal's card, and once renewed the licence is held and the nudge moves on", () => {
    // Care work stays shut to applicants from abroad, as it was in the review: no sponsor answers and the file waits.
    const game = tileNurse("nurse-licence");
    hire(game);
    readCare(game);
    const lapsed = until(game, (view) => view.documents.some((paper) => paper.id === "document.nursing-licence" && paper.state === "expired"), 60, followedButLicence);
    expect(CARE_CHAPTER.has(lapsed.chapter.current ?? "")).toBe(true);
    expect(nudgeOf(lapsed)).toEqual({ key: `${FILE}.item.licence.nudge`, about: "step" });
    expect(say(`${FILE}.item.licence.nudge`)).toBe("Renew your nursing licence at the clinic");
    expect(stepWayOf(lapsed)?.go).toBe(CLINIC);
    expect(reached(lapsed, CLINIC)).toBe(true);
    expect(opensAt(lapsed, CLINIC)).toEqual({ kind: "act", activity: "activity.renew-licence" });
    month(game, followed(lapsed));
    const renewed = game.view();
    expect(renewed.documents.find((paper) => paper.id === "document.nursing-licence")?.state).toBe("held");
    expect(nudgeOf(renewed).key).not.toMatch(/item\.licence/);
  });
});
