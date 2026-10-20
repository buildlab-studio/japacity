// The screenshot moments (docs/rules/moment.md): which lines make a card, and what each card holds, read from the
// recorded lives played by the real engine wherever a life reaches the moment, and from the line itself where none does.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { newGame, openOffer, recordedGame, recordedSave, viewAfter } from "../testing/fixtures";
import { formatMoney } from "../words/format";
import { say } from "../words/text";
import { figureWords, MOMENTS, momentFace, momentLine, sameLine } from "./moment";

/** The lines and the view a recorded life's command brings, played after every command before it. */
function played(life: string, index: number): { lines: ReportLine[]; view: PlayerView; before: PlayerView } {
  const save = recordedSave(life);
  const game = recordedGame(life, save.commands.length - index);
  const before = game.view();
  const entry = save.commands[index]!;
  const result = game.accept(entry.command, entry.sender);
  return { lines: result.lines, view: game.view(), before };
}

function line(key: string, params: ReportLine["params"], extra: Partial<ReportLine> = {}): ReportLine {
  return { key, params, tone: "plain", attention: false, counts: [], ...extra };
}

// Each moment sits at its own command of a recorded life: Ada's 228th closes her chapter on building the file.
const AT_HOME = played("graduate-careful", 227).view;
const naira = (amount: number) => ({ currency: "NGN" as const, amount });

describe("which outcomes are moments", () => {
  test("[moment:outcomes-that-are-moments] given Ada's decision day, when the visa is granted and the chapter closes in one report, then one card is due, the grant's", () => {
    const { lines, view } = played("graduate-careful", 285);
    expect(lines.map((told) => told.key)).toEqual(expect.arrayContaining(["line.route.granted", "line.chapter.closed"]));
    expect(momentLine(lines, view)?.key).toBe("line.route.granted");
  });

  // In the recorded lives Tunde the borrower's first application is refused on its funds; Zainab's is not.
  test("[moment:outcomes-that-are-moments] given Tunde's first application refused on its funds, then the refusal is the card", () => {
    const { lines, view } = played("banker-borrower", 101);
    expect(momentLine(lines, view)).toMatchObject({ key: "line.route.refused", params: { route: "route.uk-masters", reason: "funds" } });
  });

  test("[moment:outcomes-that-are-moments] given Ada's flight, when it lands, then the landing is the card, made by the flight's own line", () => {
    const { lines, view } = played("graduate-careful", 289);
    expect(momentLine(lines, view)?.key).toBe("line.route.departed");
  });

  test("[moment:outcomes-that-are-moments] given a chapter closing with nothing bigger beside it, then the chapter is the card; of two closed at once the last is told", () => {
    const { lines, view } = played("graduate-careful", 227);
    expect(momentLine(lines, view)).toMatchObject({ key: "line.chapter.closed", params: { chapter: "chapter.build-the-file" } });
    // In the recorded lives it is Ada abroad whose flight closes decision day and the send-off at once.
    const both = played("graduate-abroad", 374);
    expect(momentLine(both.lines, both.view)).toMatchObject({ key: "line.chapter.closed", params: { chapter: "chapter.send-off" } });
  });

  test("[moment:outcomes-that-are-moments] given the agent, the bus home and the draw, then each is its card, the draw only when it is staged as a big win", () => {
    expect(momentLine([line("line.offer.agent-scam", { agent: "offer.agent-stop.who.1", amount: naira(2_500_000) }, { tone: "bad" })], AT_HOME)?.key).toBe("line.offer.agent-scam");
    expect(momentLine([line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" })], AT_HOME)?.key).toBe("line.activity.robbed");
    expect(momentLine([line("line.lottery.letter", { draw: 6, won: naira(5_000_000) }, { big: true })], AT_HOME)?.key).toBe("line.lottery.letter");
    expect(momentLine([line("line.lottery.letter", { draw: 6, won: naira(50_000) })], AT_HOME)).toBeNull();
    expect(momentLine([line("line.activity.lotto-won", { tickets: 3, stake: naira(60_000), won: naira(50_000) })], AT_HOME)).toBeNull();
  });

  test("[moment:outcomes-that-are-moments] given the order of the list, when a refusal and a robbery come in one report, then the refusal is the card, and no line of a quiet month makes one", () => {
    const robbed = line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" });
    const refused = line("line.route.refused", { route: "route.uk-masters", reason: "interview" }, { tone: "bad" });
    expect(momentLine([robbed, refused], AT_HOME)).toBe(refused);
    expect(momentLine([line("line.activity.played", { activity: "activity.rest" })], AT_HOME)).toBeNull();
    // The endorsement's own refusal is a refusal, and the deposit lost follows the agent.
    // The passbook's stamps follow the chapter, the road's own figure first.
    expect(MOMENTS.map((entry) => entry.kind)).toEqual(["refused", "refused", "granted", "robbed", "agent", "deposit", "won", "won", "landed", "chapter", "held", "held"]);
  });

  test("[moment:outcomes-that-are-moments] given the road or a life that has ended, then nothing is a moment", () => {
    const refused = line("line.route.refused", { route: "route.uk-masters", reason: "funds" }, { tone: "bad" });
    expect(momentLine([refused], { ...AT_HOME, place: { ...AT_HOME.place, where: "road" } })).toBeNull();
    expect(momentLine([refused], { ...AT_HOME, ended: true })).toBeNull();
  });

  test("[moment:card-shows-when-outcome-lands] given a line and its tidied copy, then they are the same line, and another is not", () => {
    const granted = line("line.route.granted", { route: "route.uk-masters" }, { big: true });
    expect(sameLine(granted, { ...granted, params: { ...granted.params } })).toBe(true);
    expect(sameLine(granted, line("line.route.granted", { route: "route.uk-care" }))).toBe(false);
  });
});

/** The cousin's pitch taken on the first seed whose hidden draw makes it a fraud: the answer's lines, then the month's. */
function depositTaken(): { answer: ReportLine[]; month: ReportLine[]; view: PlayerView } {
  for (let seed = 1; seed < 40; seed += 1) {
    const game = newGame("scenario.graduate", `deposit-${String(seed)}`);
    viewAfter(game, [{ type: "money/add", currency: "NGN", pocket: "bank", amount: 100_000_000, reason: "gift" }]);
    const offer = openOffer(game, "offer.road-cousin");
    const answer = game.accept({ type: "offer/choose", offer: offer.id, choice: "take" }).lines;
    if (game.state.setpiece.open !== null) continue;
    const month = game.endTurn().lines;
    if (month.some((told) => told.key === "line.route.road-fraud")) return { answer, month, view: game.view() };
  }
  throw new Error("No seed made the cousin's pitch a fraud.");
}

// The endorsement refused and the cousin's ₦300,000 deposit each make a card.
describe("the biggest losses get their card", () => {
  // In the recorded lives the developer abroad is one refused an endorsement (decision 0012).
  test("[moment:outcomes-that-are-moments] given the endorsement refused by the body (the developer's recorded life abroad), when the month's lines come, then the refusal is the card, told by the body's own line", () => {
    for (const [life, index] of [["developer-abroad", 60]] as const) {
      const { lines, view, before } = played(life, index);
      expect(lines.map((told) => told.key)).toContain("line.route.endorsement-refused");
      const shot = momentLine(lines, view);
      expect(shot?.key).toBe("line.route.endorsement-refused");
      const face = momentFace(shot!, view, before)!;
      expect(face).toMatchObject({ kind: "refused", tone: "bad", kicker: say("moment.refused.kicker.endorsement"), title: say("route.uk-talent.name"), line: say("moment.refused.line.endorsement") });
      expect(face.kicker).toBe("Endorsement refused");
      expect(face.figure).toMatchObject({ value: view.month, unit: { kind: "count" } });
    }
  });

  test("[moment:outcomes-that-are-moments] [moment:moment-card-contents] given the cousin's pitch taken and the deposit gone to a fraud, when the month ends, then the deposit is the card: the pitch's name, its own line, the deposit as the figure", () => {
    const { answer, month, view } = depositTaken();
    const shot = momentLine(month, view, answer);
    expect(shot?.key).toBe("line.route.road-fraud");
    const face = momentFace(shot!, view, null, [...answer, ...month])!;
    const paid = answer.filter((told) => told.key === "line.wallet.fee-agent").reduce((sum, told) => sum + (told.params["amount"] as { amount: number }).amount, 0);
    expect(paid).toBeGreaterThanOrEqual(30_000_000);
    expect(face).toMatchObject({ kind: "deposit", tone: "bad", icon: "banknote-x", kicker: "The deposit is gone", title: say("offer.road-cousin.name"), line: say("moment.deposit.line.offer.road-cousin"), chip: null });
    expect(face.figure).toEqual({ value: paid, unit: { kind: "money", currency: "NGN" }, caption: say("moment.deposit.caption") });
    expect(face.line).not.toContain(figureWords(face.figure, face.figure.value));
    // Without the deposit among the month's lines there is no figure, so no card.
    expect(momentLine(month, view)).toBeNull();
    expect(momentFace(shot!, view)).toBeNull();
  });

  // The recorded lives never take the cousin's pitch (decision 0013), so the honest pitch is taken here on the first
  // seed whose hidden draw sends the road to the night meeting (no fraud), and the road is walked on at the night,
  // paid at the truth, then month after month.
  test("[moment:outcomes-that-are-moments] given Zainab taking the cousin's pitch that is no fraud, when she walks the road month after month, then no deposit card comes in any month after it", () => {
    for (let seed = 1; seed < 40; seed += 1) {
      const game = newGame("scenario.developer", `honest-${String(seed)}`);
      viewAfter(game, [{ type: "money/add", currency: "NGN", pocket: "cash", amount: 100_000_000, reason: "gift" }]);
      const offer = openOffer(game, "offer.road-cousin");
      const told: ReportLine[] = [...game.accept({ type: "offer/choose", offer: offer.id, choice: "take" }).lines];
      if (game.state.route["route.road"]?.gate?.gate !== "road" || game.state.route["route.road"].gate.step !== "night") continue;
      expect(told.some((line) => line.key === "line.offer.taken" && line.params["offer"] === "offer.road-cousin" && line.params["choice"] === "take")).toBe(true);
      let months = 0;
      for (let step = 0; step < 60 && months < 12 && !game.view().ended; step += 1) {
        const question = game.view().setpiece?.question ?? null;
        const lines = question === null ? game.endTurn().lines : game.accept({ type: "setpiece/answer", question: question.id, answer: question.allowed[0]! }).lines;
        if (question === null) months += 1;
        expect(lines.map((line) => line.key)).not.toContain("line.route.road-fraud");
        expect(momentLine(lines, game.view(), told)?.key).not.toBe("line.route.road-fraud");
        told.push(...lines);
      }
      // The road was really walked: she set off after the truth, and a year of months passed after the pitch.
      expect(told.map((line) => line.key)).toContain("line.place.on-road");
      expect(months).toBe(12);
      return;
    }
    throw new Error("No seed made the cousin's pitch honest.");
  });
});

describe("what a card holds", () => {
  test("[moment:moment-card-contents] given Ada's grant, then the card names the route, says the route's line, and the figure is the months played", () => {
    const { lines, view } = played("graduate-careful", 285);
    const face = momentFace(momentLine(lines, view)!, view)!;
    expect(face).toMatchObject({ kind: "granted", tone: "good", kicker: say("moment.granted.kicker"), title: say("route.uk-masters.name"), line: say("moment.granted.line.route.uk-masters"), chip: null });
    expect(face.figure).toEqual({ value: view.month, unit: { kind: "count" }, caption: say("moment.granted.caption") });
    expect(face.mark).toBe("Japacity");
    expect(face.address).toBe("japacity.app");
  });

  // The recorded refusal on the funds is Tunde the borrower's, on a file 55% untraced (decision 0012).
  test("[moment:moment-card-contents] given Tunde's refusal on the funds, then it is dark, says the funds' line, and its figure is the untraced share on the file the letter judged, as a whole percent", () => {
    const { lines, view, before } = played("banker-borrower", 101);
    const face = momentFace(momentLine(lines, view)!, view, before)!;
    expect(face).toMatchObject({ kind: "refused", tone: "bad", line: say("moment.refused.line.funds"), chip: null });
    const filed = before.routes.find((held) => held.id === "route.uk-masters")!;
    expect(filed.state).toBe("applying");
    expect(face.figure).toEqual({ value: Math.floor(filed.unexplainedBp / 100), unit: { kind: "percent" }, caption: say("moment.refused.caption.funds") });
    expect(figureWords(face.figure, face.figure.value)).toBe("55%");
    // Without the file as it was decided, the months stand instead: the share worked out after the refusal is another file's.
    expect(momentFace(momentLine(lines, view)!, view)!.figure).toEqual({ value: view.month, unit: { kind: "count" }, caption: say("moment.refused.caption") });
    // From the second refusal on the route, its count stands beside the figure.
    const again = { ...view, routes: view.routes.map((held) => (held.id === filed.id ? { ...held, refusals: 2 } : held)) };
    expect(momentFace(momentLine(lines, again)!, again, before)!.chip).toBe(say("moment.refused.again", { count: 2 }));
  });

  test("[moment:moment-card-contents] given every reason a letter can give, then the refusal card has its own line for it", () => {
    for (const reason of ["funds", "interview", "history", "credibility", "sponsor", "agent", "endorsement", "relationship", "sham", "lead"]) {
      const face = momentFace(line("line.route.refused", { route: "route.uk-masters", reason }, { tone: "bad" }), AT_HOME)!;
      expect(face.line).toBe(say(`moment.refused.line.${reason}`));
    }
  });

  test("[moment:moment-card-contents] given the agent and the bus home, then the figure is the money gone, in whole naira, with the new phone beside the cash", () => {
    const agent = momentFace(line("line.offer.agent-scam", { agent: "offer.agent-stop.who.1", amount: naira(2_500_000) }, { tone: "bad" }), AT_HOME)!;
    expect(agent).toMatchObject({ kind: "agent", tone: "bad", title: say("offer.agent-stop.who.1.name"), line: say("moment.agent.line") });
    expect(figureWords(agent.figure, agent.figure.value)).toBe(formatMoney(2_500_000, "NGN"));
    const robbed = momentFace(line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" }), AT_HOME)!;
    expect(figureWords(robbed.figure, robbed.figure.value)).toBe("₦142,000");
    expect(robbed.chip).toBe(`New phone ${formatMoney(6_000_000, "NGN")}`);
    const pocketsEmpty = momentFace(line("line.activity.robbed", { cash: naira(0), phone: naira(6_000_000) }, { tone: "bad" }), AT_HOME)!;
    expect(pocketsEmpty.figure).toMatchObject({ value: 6_000_000, caption: say("moment.robbed.caption.phone") });
    expect(pocketsEmpty.chip).toBeNull();
  });

  test("[moment:moment-card-contents] given a big win, then the figure is the sum won, and a kiosk win says the tickets and what they cost", () => {
    const letter = momentFace(line("line.lottery.letter", { draw: 6, won: naira(31_400_000) }, { big: true }), AT_HOME)!;
    expect(letter).toMatchObject({ kind: "won", tone: "good", title: say("moment.won.title.letter"), chip: null });
    expect(figureWords(letter.figure, letter.figure.value)).toBe("₦314,000");
    const kiosk = momentFace(line("line.activity.lotto-won", { tickets: 3, stake: naira(60_000), won: naira(5_000_000) }, { big: true }), AT_HOME)!;
    expect(kiosk.title).toBe(say("moment.won.title.kiosk"));
    expect(kiosk.chip).toBe(`3 tickets for ${formatMoney(60_000, "NGN")}`);
  });

  test("[moment:moment-card-contents] given Ada's landing, then the title is the country, the line is the country's, and the figure the months from Lagos", () => {
    const { lines, view } = played("graduate-careful", 289);
    const face = momentFace(momentLine(lines, view)!, view)!;
    expect(face).toMatchObject({ kind: "landed", title: say("country.uk.name"), line: say("moment.landed.line.country.uk") });
    expect(face.figure).toMatchObject({ value: view.month, unit: { kind: "count" } });
  });

  test("[moment:moment-card-contents] given a chapter at home, then the figure is japacity; given one after the flight, the months played", () => {
    const home = played("graduate-careful", 227);
    const face = momentFace(momentLine(home.lines, home.view)!, home.view)!;
    expect(face).toMatchObject({ title: say("chapter.build-the-file.title"), line: say("chapter.build-the-file.close") });
    expect(face.figure).toEqual({ value: home.view.japacity.percent, unit: { kind: "percent" }, caption: say("moment.chapter.caption.japacity") });
    const abroad = played("graduate-abroad", 377);
    const landed = momentFace(momentLine(abroad.lines, abroad.view)!, abroad.view)!;
    expect(landed.title).toBe(say("chapter.landing.title"));
    expect(landed.figure).toEqual({ value: abroad.view.month, unit: { kind: "count" }, caption: say("moment.chapter.caption") });
  });

  test("[moment:words-in-game-voice] given every card these lives and lines make, then the line never repeats the figure the card shows, and a loss carries no joke version", () => {
    const faces = [played("graduate-careful", 285), played("banker-borrower", 101), played("graduate-careful", 289), played("graduate-careful", 227)].map(({ lines, view, before }) => momentFace(momentLine(lines, view)!, view, before)!);
    faces.push(momentFace(line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" }), AT_HOME)!);
    faces.push(momentFace(line("line.offer.agent-scam", { agent: "offer.agent-stop.who.1", amount: naira(2_500_000) }, { tone: "bad" }), AT_HOME)!);
    for (const face of faces) {
      expect(face.line).not.toContain(figureWords(face.figure, face.figure.value));
      expect(face.line).not.toMatch(/\{|\}/);
    }
    // A loss's words have one version only: no joke can be drawn for it (text:bad-news-never-joked).
    for (const entry of MOMENTS.filter((moment) => moment.tone === "bad")) expect(say(`moment.${entry.kind}.line.v2`)).toBe(`moment.${entry.kind}.line.v2`);
  });
});
