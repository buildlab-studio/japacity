// The nudge respects money and the file (docs/rules/world.md R-WORLD-003).
// Z9: "Sit the nursing certification at the clinic" stood four months while she could not pay it, and the care file
// lists no certification. Z10: the TB certificate was taken first and ran out before the application. Z7: "The
// endorsement needs more. See Japa." for five months with no act named. Z18: the meetup's nudge was two taps. Real
// content, lives played through `step`.
import { content, text } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { applyEffects, readyLife, slot } from "../../../../../packages/sim/src/route/route.journey";
import type { Game } from "../../../../../packages/sim/src/testing/play";
import { formatMoney } from "../../shared/words/format";
import { hearCare, month, readCare, readyNurse, until } from "../../shared/testing/nurse";
import { hasWords, say } from "../../shared/words/text";
import { nudgeOf, STEP_ACTIVITY, stepWayOf } from "./nudge";
import { stepOpen } from "./stepOpen";

const FILE = "chapter.build-the-file-care";
const CARE_DAY = "chapter.decision-day-care";
const TALENT_FILE = "chapter.build-the-file-talent";
const TALENT_DAY = "chapter.decision-day-talent";
const TALENT: Id<"route"> = "route.uk-talent";
const CERTIFY = "activity.nurse-certification";
const VERIFY = "activity.request-verification";
const NUDGE_WORDS = 8;

function wordCount(said: string): number {
  return said.split(/\s+/).filter(Boolean).length;
}

/** The ready nurse in her care file: care work heard of at the meetup and its page read, the first chapter closed. */
function readyInTheFile(): Game {
  const game = readyNurse("nudge-files");
  hearCare(game);
  readCare(game);
  until(game, (view) => view.chapter.current === FILE, 4);
  return game;
}

function naira(view: PlayerView): number {
  return view.pockets.NGN.bank + view.pockets.NGN.cash;
}

/** The view with only `amount` naira in the bank and none in cash. */
function holding(view: PlayerView, amount: number): PlayerView {
  return { ...view, pockets: { ...view.pockets, NGN: { ...view.pockets.NGN, bank: amount, cash: 0 } } };
}

describe("a step the naira cannot pay names the gap", () => {
  test("[R-WORLD-003] given every chapter step whose act costs naira, when its words are read, then it has words for the gap with the amount and for waiting on payday, each one sentence under eight words", () => {
    const priced = Object.entries(STEP_ACTIVITY).filter(([, act]) => (content.activity[act as Id<"activity">]?.cost ?? []).some((cost) => cost.currency === "NGN"));
    expect(priced.length).toBeGreaterThan(10);
    const missing: string[] = [];
    for (const [step] of priced) {
      const cut = step.lastIndexOf(".");
      const own = `${step.slice(0, cut)}.item.${step.slice(cut + 1)}`;
      for (const key of [`${own}.short`, `${own}.saving`]) {
        if (!hasWords(key)) {
          missing.push(key);
          continue;
        }
        const said = say(key, { amount: formatMoney(1_730_000, "NGN") });
        expect(wordCount(said)).toBeLessThan(NUDGE_WORDS);
        expect(said).not.toMatch(/[{}]|[.]$/);
      }
      expect(text[`${own}.short`]).toContain("{amount}");
    }
    expect(missing).toEqual([]);
  });

  test("[R-WORLD-003] given the ready nurse at the council's step with less naira than its fee, when the nudge is read, then it names how much more to find, never the act", () => {
    const view = readyInTheFile().view();
    expect(nudgeOf(view).key).toBe(`${FILE}.item.verification.nudge`);
    const fee = view.activities.find((option) => option.id === VERIFY)!.cost.reduce((sum, cost) => sum + cost.amount, 0);
    const short = holding({ ...view, job: { ...view.job, id: null } }, fee - 1_730_000);
    const option = short.activities.find((candidate) => candidate.id === VERIFY)!;
    const broke = { ...short, activities: short.activities.map((candidate) => (candidate === option ? { ...option, affordable: false } : candidate)) };
    expect(nudgeOf(broke)).toEqual({ key: `${FILE}.item.verification.short`, params: { amount: formatMoney(1_730_000, "NGN") }, about: "step" });
  });

  test("[R-WORLD-003] [R-ACTIVITY-013] given the ready nurse on the ward while the council works, with the certification open to her, when the nudge is read each month, then it never names the certification: the care file reads neither the certificate nor the care it adds", () => {
    // The care route's checklist and gate read neither the certificate nor care above the nurse's own sixty.
    const care = content.route["route.uk-care"]!;
    expect(care.checklist.some((item) => JSON.stringify(item.requirement).includes("nurse-certificate") || JSON.stringify(item.requirement).includes("quality.care"))).toBe(false);
    const game = readyInTheFile();
    game.accept({ type: "activity/now", activity: VERIFY, param: null });
    const said: string[] = [];
    let offered = 0;
    for (let months = 0; months < 6; months += 1) {
      const view = game.view();
      if (view.activities.find((option) => option.id === CERTIFY)?.allowed === true) offered += 1;
      const nudge = nudgeOf(view);
      said.push(`${nudge.key} ${say(nudge.key, nudge.params ?? {})}`);
      month(game);
    }
    expect(offered).toBeGreaterThan(0);
    expect(said.filter((line) => /certification/i.test(line))).toEqual([]);
  });
});

describe("the TB test comes last", () => {
  test("[R-WORLD-003] [R-DOCUMENT-004] given the ready nurse at the decision day's TB step with her police paper still to get, when the nudge is read, then it names the police paper and its way, never the TB test", () => {
    const view = readyInTheFile().view();
    const care = view.routes.find((route) => route.id === "route.uk-care")!;
    const atDay: PlayerView = {
      ...view,
      chapter: { current: CARE_DAY, items: [{ id: "tb", met: false }, { id: "police", met: false }, { id: "applied", met: false }, { id: "granted", met: false }], done: [], closes: false, next: null },
      routes: view.routes.map((route) => (route === care ? { ...care, window: "open" as const, checklist: care.checklist.map((item) => ({ ...item, met: item.id !== "tb" && item.id !== "police" && item.id !== "applied" })) } : route)),
      documents: view.documents.filter((paper) => paper.id !== "document.police-certificate" && paper.id !== "document.tb-certificate"),
    };
    expect(nudgeOf(atDay).key).toMatch(/^chapter\.decision-day-care\.item\.police/);
    expect(stepWayOf(atDay)?.go).toBe("place.visa-centre");
    // Once the police paper is held, the TB test is next.
    const policeHeld: PlayerView = { ...atDay, chapter: { ...atDay.chapter, items: atDay.chapter.items.map((item) => (item.id === "police" ? { ...item, met: true } : item)) }, routes: atDay.routes.map((route) => (route.id === "route.uk-care" ? { ...route, checklist: route.checklist.map((item) => (item.id === "police" ? { ...item, met: true } : item)) } : route)) };
    expect(nudgeOf(policeHeld).key).toMatch(/^chapter\.decision-day-care\.item\.tb/);
  });

  test("[R-WORLD-003] given a developer at the talent decision day with no passport, when the nudge is read, then it names the passport the TB test needs, never the TB test", () => {
    const view = talentGame({}, []).view();
    expect(view.routes.find((route) => route.id === TALENT)?.checklist.find((item) => item.id === "passport")?.met).toBe(false);
    const talentDay: PlayerView = {
      ...view,
      offers: [],
      chapter: { current: TALENT_DAY, items: [{ id: "tb", met: false }, { id: "applied", met: false }, { id: "granted", met: false }], done: [], closes: false, next: null },
    };
    expect(nudgeOf(talentDay).key).toMatch(/^chapter\.build-the-file\.item\.passport/);
    expect(stepWayOf(talentDay)?.go).toBe("place.passport-office");
  });
});

/**
 * A developer with the talent route heard of and its page read, then the qualities moved to `qualities`, at the
 * endorsement step of its file. `documents`: the papers the ready life starts with, the passport among them by default.
 */
function talentGame(qualities: Partial<Record<Id<"quality">, number>>, documents?: []): Game {
  const game = readyLife(content, { quiet: true, qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 }, ...(documents === undefined ? {} : { documents }) });
  for (let months = 0; months < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; months += 1) game.endTurn();
  applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
  game.endTurn([slot("activity.look-into-route", TALENT)]);
  applyEffects(game, Object.entries(qualities).map(([quality, value]) => ({ type: "quality/add" as const, quality: quality as Id<"quality">, amount: (value ?? 0) - (game.state.quality[quality as Id<"quality">] ?? 0) })));
  return game;
}

function talentFile(qualities: Partial<Record<Id<"quality">, number>>): PlayerView {
  const view = talentGame(qualities).view();
  return { ...view, offers: [], chapter: { current: TALENT_FILE, items: [{ id: "portfolio", met: true }, { id: "endorsement", met: false }, { id: "applied", met: false }], done: [], closes: false, next: null } };
}

describe("the endorsement's needs name their acts", () => {
  test("[R-WORLD-003] [R-ENDORSE-001] given the endorsement shut by tech, when the nudge is read, then it names the coding course at the hub in under eight words and its tap opens the course's own card at the desk; with the tech met, the meetup", () => {
    const view = talentFile({ "quality.tech": 50, "quality.portfolio": 5, "quality.network": 30 });
    const shut = view.activities.find((option) => option.id === "activity.apply-endorsement")!;
    expect(shut.allowed).toBe(false);
    const nudge = nudgeOf(view);
    expect(nudge.key).toBe(`${TALENT_FILE}.item.endorsement.needs.quality.tech`);
    expect(say(nudge.key)).toBe("Take the coding course at the hub");
    expect(wordCount(say(nudge.key))).toBeLessThan(NUDGE_WORDS);
    const way = nudge.way!;
    expect(way).toMatchObject({ go: "place.yaba", at: ["place.yaba:desk"], opens: "activity.learn-tech" });
    expect(stepOpen(way, "desk", view.activities.filter((option) => option.allowed).map((option) => option.id), "place.yaba")).toEqual({ kind: "act", activity: "activity.learn-tech" });
    // With the tech met, the people who will write are next: the hub's meetup.
    const network = talentFile({ "quality.tech": 85, "quality.portfolio": 5, "quality.network": 30 });
    const next = nudgeOf(network);
    expect(next.key).toBe(`${TALENT_FILE}.item.endorsement.needs.quality.network`);
    expect(say(next.key)).toBe("Meet people at the hub's meetup");
    expect(next.way).toMatchObject({ go: "place.yaba", at: ["place.yaba:meetup"], opens: "activity.meetup" });
  });

  test("[R-WORLD-003] [R-ENDORSE-001] given the endorsement open, when the nudge's tap is followed at the hub's desk, then it opens the endorsement's own card, not the desk's chips", () => {
    const view = talentFile({ "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 });
    const way = stepWayOf(view)!;
    expect(way).toMatchObject({ go: "place.yaba", opens: "activity.apply-endorsement" });
    expect(stepOpen(way, "desk", ["activity.apply-endorsement"], "place.yaba")).toEqual({ kind: "act", activity: "activity.apply-endorsement" });
  });
});

describe("the meetup is one tap", () => {
  test("[R-WORLD-003] [R-GUIDE-014] given the ready nurse's first month, when the nudge names the meetup and is followed at the hub, then it opens the meetup's own card, not the corner's two acts", () => {
    const view = readyNurse("meetup-one-tap").view();
    expect(nudgeOf(view).key).toBe("chapter.find-your-feet.item.heard.nudge");
    const way = stepWayOf(view)!;
    expect(way).toMatchObject({ go: "place.yaba", opens: "activity.meetup" });
    expect(stepOpen(way, "meetup", view.activities.filter((option) => option.allowed).map((option) => option.id), "place.yaba")).toEqual({ kind: "act", activity: "activity.meetup" });
    // Followed, care work is heard of that month (R-GUIDE-016).
    const game = readyNurse("meetup-one-tap");
    month(game, [slot("activity.meetup")]);
    expect(game.view().routes.find((route) => route.id === "route.uk-care")?.state).not.toBe("unknown");
    expect(naira(game.view())).toBeGreaterThan(0);
  });
});
