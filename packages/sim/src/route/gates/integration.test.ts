// R-ACTIVITY-015: a now-act (an application, a paper, a visit) is refused in a slot, so each probe sends one as
// activity/now, and an application checked as applying is read in the month it is sent.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { check } from "../../engine/check";
import type { Content, Id, ReadCtx, RouteState, ScenarioEntry, Tuning } from "../../engine/types";
import type { Game } from "../../testing/play";
import { flown } from "../../testing/place.journey";
import { applyEffects, readyLife, slot, toDecision } from "../../testing/route.journey";
import type { LifeOptions } from "../../testing/route.journey";
import { GATES } from "./index";

const CARE: Id<"route"> = "route.uk-care";
const GULF: Id<"route"> = "route.gulf-contract";
const SKILLED: Id<"route"> = "route.uk-skilled";
const UK: Id<"route"> = "route.uk-masters";
const ALWAYS_GRANTED: Partial<Tuning["route"]> = { refusalMinBp: 0, refusalMaxBp: 0 };
const CARE_BAR = content.var["var.uk-care-salary"]!.start;
const BAN_MONTHS = 3;

const CARE_PAPERS: ScenarioEntry["documents"] = [
  { document: "document.passport", monthsLeft: 40, value: null },
  { document: "document.nursing-licence", monthsLeft: 30, value: null },
  { document: "document.nmcn-verification", monthsLeft: 24, value: null },
  { document: "document.english-test", monthsLeft: 24, value: 40 },
  { document: "document.tb-certificate", monthsLeft: 24, value: null },
];
const GULF_PAPERS: ScenarioEntry["documents"] = [
  { document: "document.passport", monthsLeft: 40, value: null },
  { document: "document.medical", monthsLeft: 3, value: null },
];

/** The UK's deception ban cut to three months, so a test can watch it lift. */
const shortBan: Content = { ...content, country: { ...content.country, "country.uk": { ...content.country["country.uk"]!, deceptionBanMonths: BAN_MONTHS } } };

function routeOf(game: Game, route: Id<"route">): RouteState {
  return game.state.route[route]!;
}

function readOf(game: Game): ReadCtx {
  return { state: game.state, world: game.world(), content: game.content };
}

/** Talk of the route reaches the character, then it is looked into. */
function toKnown(game: Game, route: Id<"route">): void {
  applyEffects(game, [{ type: "route/hear", route, via: "friend" }]);
  game.endTurn([slot("activity.look-into-route", route)]);
  expect(routeOf(game, route).state).toBe("known");
}

function ngozi(used: Content, options: LifeOptions = {}): Game {
  return readyLife(used, { from: "scenario.ngozi", documents: CARE_PAPERS, quiet: true, vars: () => ({ "var.uk-care-window": 2 }), tuning: ALWAYS_GRANTED, ...options });
}

describe("the gates through the dispatcher", () => {
  test("[R-SPONSOR-002] [R-GATE-005] given a fraud sponsor taken through the offer's effect, when the application is decided, then the fraud rode on the route's secret, the refusal names sponsor, every known route into the country is refused with the ban, and the ban lifts on its month with the routes known again", () => {
    const game = ngozi(shortBan);
    toKnown(game, CARE);
    // A second route into the same country, known before the decision, is banned too.
    toKnown(game, SKILLED);
    applyEffects(game, [{ type: "route/record-sponsor", route: CARE, employer: "care-home", salary: 0, fraud: true }], { salary: CARE_BAR });
    expect(routeOf(game, CARE).secret.sponsorFraud).toBe(true);
    expect(JSON.stringify(game.view())).not.toContain("sponsorFraud");
    game.accept({ type: "activity/now", activity: "activity.apply-uk-care", param: null });
    expect(routeOf(game, CARE).state).toBe("applying");
    game.endTurn();
    const month = game.state.turn.month;
    expect(routeOf(game, CARE)).toMatchObject({ state: "refused", bannedUntil: month + BAN_MONTHS });
    expect(routeOf(game, CARE).lastRefusal?.reasons[0]).toBe("sponsor");
    expect(routeOf(game, SKILLED)).toMatchObject({ state: "refused", bannedUntil: month + BAN_MONTHS });
    const during: string[] = [];
    for (let passed = 0; passed < BAN_MONTHS - 1; passed += 1) {
      game.endTurn();
      during.push(routeOf(game, CARE).state);
    }
    expect(during).toEqual(Array<string>(BAN_MONTHS - 1).fill("refused"));
    game.endTurn();
    expect(routeOf(game, CARE)).toMatchObject({ state: "known", bannedUntil: null });
    expect(routeOf(game, SKILLED).state).toBe("known");
  });

  test("[R-SPONSOR-007] [R-CONTRACT-004] given the sponsor and contract gates, when the job on arrival is asked for, then each names the job its block or its agent's role gives, and the study gate names none", () => {
    const care = content.route[CARE]!;
    const held = { ...GATES.sponsor.initial() };
    expect(GATES.sponsor.departureJob?.(care, { ...routeOf(ngozi(content), CARE), gate: held })).toBe("activity.job-uk-care");
    const gulf = content.route[GULF]!;
    const agent = { gate: "contract" as const, agent: { employer: "agent", salary: 180000, role: "cleaner" } };
    expect(GATES.contract.departureJob?.(gulf, { ...routeOf(ngozi(content), GULF), gate: agent })).toBe("activity.job-gulf-cleaner");
    expect("departureJob" in GATES.study).toBe(false);
  });

  test("[R-GATE-003] [R-CONTRACT-004] [R-STATUS-009] given a Gulf contract granted, when the character departs, then no flight is paid, the status is the Gulf worker's with the agent's job, and the character is in the UAE", () => {
    const game = readyLife(content, { quiet: true, documents: GULF_PAPERS, qualities: { "quality.age-months": 360, "quality.edu-level": 3 }, vars: () => ({ "var.uae-window": 2 }), tuning: ALWAYS_GRANTED });
    toKnown(game, GULF);
    applyEffects(game, [{ type: "route/record-sponsor", route: GULF, employer: "agent", salary: 0, fraud: false }], { salary: 180000, role: 1 });
    expect(routeOf(game, GULF).gate).toMatchObject({ gate: "contract", agent: { role: "guard" } });
    game.accept({ type: "activity/now", activity: "activity.apply-gulf-contract", param: null });
    expect(routeOf(game, GULF).state).toBe("applying");
    game.endTurn();
    expect(routeOf(game, GULF).state).toBe("granted");
    const naira = game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash;
    const result = game.accept({ type: "route/depart", route: GULF });
    expect(result.events.some((event) => event.type === "wallet/debited" && (event as { reason?: string }).reason === "flight")).toBe(false);
    expect(game.state.wallet.pockets.NGN.bank + game.state.wallet.pockets.NGN.cash).toBe(naira);
    expect(game.state.place).toMatchObject({ where: "abroad", country: "country.uae" });
    expect(game.state.status.current).toMatchObject({ entry: "status.gulf-worker", job: "activity.job-gulf-guard" });
  });

  test("[R-ABROAD-005] given a student granted, when they depart, then the tuition opens for the course less the deposit and the discount, and nobody else owes tuition", () => {
    const game = readyLife(content, { quiet: true, tuning: ALWAYS_GRANTED });
    toDecision(game);
    const held = routeOf(game, UK);
    expect(held.state).toBe("granted");
    const school = content.school[held.school!]!;
    const owed = school.tuition - (held.schools[held.school!]?.discount ?? 0) - held.depositPaid;
    game.accept({ type: "route/depart", route: UK });
    const tuition = Object.values(game.state.obligation.items).filter((item) => item.entry === "obligation.tuition");
    expect(tuition).toHaveLength(1);
    expect(tuition[0]).toMatchObject({ principal: owed });
  });

  test("[R-ABROAD-006] [R-WALLET-014] given money sent home, when the ledger is read, then the naira arrived under remit, so the total sent is a requirement a goal can read and the ledger counts it as a transfer", () => {
    const game = flown(content);
    applyEffects(game, [{ type: "money/add", currency: "GBP", pocket: "bank", amount: 100000, reason: "salary" }]);
    expect(check(readOf(game), { type: "wallet/total", flow: "in", reason: "remit", currency: "NGN", amount: 1 }).met).toBe(false);
    game.accept({ type: "wallet/remit", currency: "GBP", amount: 10000, channel: "app" });
    expect(check(readOf(game), { type: "wallet/total", flow: "in", reason: "remit", currency: "NGN", amount: 1 }).met).toBe(true);
    expect(game.state.wallet.totals.in.remit?.NGN).toBeGreaterThan(0);
    expect(game.state.wallet.totals.in.gift?.NGN ?? 0).toBe(0);
  });
});
