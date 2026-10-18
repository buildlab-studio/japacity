// The sponsor step reads the care window (world:nudge-says-one-thing; route-gates.md
// route-gates:care-route-needs-verification): while no sponsor can take a nurse from abroad, the nudge never says "Find a sponsor with a licence".
// Real content, the ready nurse played through `step`.
import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { hearCare, month, readCare, readyNurse, until } from "../../../shared/testing/nurse";
import { earlyStops } from "../../../shared/words/sixteen";
import { say } from "../../../shared/words/text";
import { MEANWHILE_WAYS, nudgeOf, stepWayOf } from "./nudge";
import { stopReached } from "./stops";

const FILE = "chapter.build-the-file-care";
const SHUT = `${FILE}.item.sponsor.shut`;
const CARE = "route.uk-care";
const CERTIFY = "activity.nurse-certification";
const POLICE = "activity.get-police-certificate";
const ENGLISH = "activity.sit-english-test";
const NUDGE_WORDS = 8;
const MONTH_END = { go: null, at: [] };

/** The ready nurse at her care file's sponsor step: care work heard of and read, the council asked and answered. */
function atTheSponsor(open = false): PlayerView {
  const game = readyNurse("sponsor-window", open);
  hearCare(game);
  readCare(game);
  until(game, (view) => view.chapter.current === FILE, 4);
  game.accept({ type: "activity/now", activity: "activity.request-verification", param: null });
  return until(game, (view) => view.chapter.items.find((item) => item.id === "verification")?.met === true, 16);
}

/** The view with the care file's papers met but `unmet`, and each act's standing as `acts` gives it. */
function standing(view: PlayerView, unmet: readonly string[], acts: Record<string, { allowed: boolean; affordable: boolean }>): PlayerView {
  return {
    ...view,
    offers: [],
    setpiece: null,
    documents: view.documents.filter((paper) => paper.onItsWay === null),
    routes: view.routes.map((route) => (route.id === CARE ? { ...route, checklist: route.checklist.map((item) => ({ ...item, met: !unmet.includes(item.id) })) } : route)),
    activities: view.activities.map((option) => (acts[option.id] === undefined ? option : { ...option, ...acts[option.id] })),
  };
}

describe("the sponsor step while the care window is shut", () => {
  const view = atTheSponsor();

  test("[world:nudge-says-one-thing] [route-gates:care-route-needs-verification] given the ready nurse at the sponsor step with care work shut to applicants abroad, when the nudge is read, then it says sponsors are closed and to keep the file ready, in one sentence of at most eight words, never to find a sponsor", () => {
    expect(view.routes.find((route) => route.id === CARE)?.window).toBe("closed");
    expect(view.chapter.items.find((item) => !item.met)?.id).toBe("sponsor");
    const nudge = nudgeOf(view);
    expect(nudge.key).toBe(SHUT);
    const said = say(SHUT);
    expect(said).toBe(text[SHUT]);
    expect(said.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(NUDGE_WORDS);
    expect(said).not.toMatch(/[.!?]\s|[{}]/);
    expect(said).not.toBe(say(`${FILE}.item.sponsor.nudge`));
    // The way the nudge opens is the way the city reads for the step.
    expect(nudge.way).toEqual(stepWayOf(view));
  });

  test("[world:nudge-says-one-thing] [world:map-is-painted-lagos] [route-gates:care-route-needs-verification] given the shut sponsor step with the English test still to sit, when its tap is followed, then it goes to the test centre; with the file's own papers in hand it goes to the certification's card while she can pay it, else to the month's end, never to the decision day's papers, and every stop it names is open on the map", () => {
    const allowed = { allowed: true, affordable: true };
    const english = standing(view, ["sponsor", "salary", "tb", "applied", "police", "certificate", "english"], { [ENGLISH]: allowed, [POLICE]: allowed, [CERTIFY]: allowed });
    expect(nudgeOf(english)).toMatchObject({ key: SHUT, way: { go: "place.english-test-centre" } });
    // The police paper and the TB test run out and wait for the decision day's visa centre (world:map-is-painted-lagos).
    const certify = standing(view, ["sponsor", "salary", "tb", "applied", "police", "certificate"], { [POLICE]: allowed, [CERTIFY]: allowed });
    expect(nudgeOf(certify)).toEqual({ key: SHUT, about: "step", way: MEANWHILE_WAYS["nurse-certification"] });
    for (const shown of [english, certify]) {
      const go = nudgeOf(shown).way?.go ?? null;
      expect(go !== null && stopReached(shown.chapter, shown.place.where, go, earlyStops(shown))).toBe(true);
    }
    expect(MEANWHILE_WAYS["nurse-certification"]?.opens).toBe(CERTIFY);
    const unpaid = standing(view, ["sponsor", "salary", "tb", "applied", "certificate"], { [CERTIFY]: { allowed: true, affordable: false } });
    expect(nudgeOf(unpaid)).toEqual({ key: SHUT, about: "step", way: MONTH_END });
    const certified = standing(view, ["sponsor", "salary", "tb", "applied"], { [CERTIFY]: { allowed: false, affordable: true } });
    expect(nudgeOf(certified)).toEqual({ key: SHUT, about: "step", way: MONTH_END });
    // The English test planned this month is not asked for again.
    expect(nudgeOf(english, undefined, [ENGLISH]).way).toEqual(MEANWHILE_WAYS["nurse-certification"]);
  });

  test("[world:nudge-says-one-thing] [route-gates:care-route-needs-verification] given the shut sponsor step, when the window opens, then the sponsor step reads as it did: find a sponsor at the hub's desk", () => {
    const open: PlayerView = { ...view, routes: view.routes.map((route) => (route.id === CARE ? { ...route, window: "open" as const } : route)) };
    expect(nudgeOf(open).key).toBe(`${FILE}.item.sponsor.nudge`);
    expect(stepWayOf(open)).toMatchObject({ go: "place.yaba", at: ["place.yaba:desk", "place.ojuelegba:hub"] });
  });
});

describe("the ready nurse's months at the shut sponsor step", () => {
  test("[world:nudge-says-one-thing] [route-gates:care-route-needs-verification] given the ready nurse at the sponsor step with care work shut, when twelve more months are played, then no month's nudge says to find a sponsor", () => {
    const game = readyNurse("sponsor-window");
    hearCare(game);
    readCare(game);
    until(game, (view) => view.chapter.current === FILE, 4);
    game.accept({ type: "activity/now", activity: "activity.request-verification", param: null });
    until(game, (view) => view.chapter.items.find((item) => item.id === "verification")?.met === true, 16);
    const said: string[] = [];
    for (let months = 0; months < 12; months += 1) {
      const view = game.view();
      if (view.routes.find((route) => route.id === CARE)?.window === "closed" && view.chapter.items.find((item) => !item.met)?.id === "sponsor") said.push(nudgeOf(view).key);
      month(game);
    }
    expect(said.length).toBeGreaterThan(0);
    expect(said.filter((key) => key.startsWith(`${FILE}.item.sponsor.nudge`))).toEqual([]);
    expect(content.route[CARE]?.window).toBe("var.uk-care-window");
  });
});
