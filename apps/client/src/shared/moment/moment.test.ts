// The screenshot moments (docs/rules/moments.md): which lines make a card, and what each card holds, read from the
// recorded lives played by the real engine wherever a life reaches the moment, and from the line itself where none does.
import type { PlayerView, ReportLine } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { recordedGame, recordedSave } from "../testing/fixtures";
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

const AT_HOME = played("ada-careful", 31).view;
const naira = (amount: number) => ({ currency: "NGN" as const, amount });

describe("which outcomes are moments", () => {
  test("[R-MOMENT-001] given Ada's decision day, when the visa is granted and the chapter closes in one report, then one card is due, the grant's", () => {
    const { lines, view } = played("ada-careful", 144);
    expect(lines.map((told) => told.key)).toEqual(expect.arrayContaining(["line.route.granted", "line.chapter.closed"]));
    expect(momentLine(lines, view)?.key).toBe("line.route.granted");
  });

  test("[R-MOMENT-001] given Tunde's first application refused on its funds, then the refusal is the card", () => {
    const { lines, view } = played("tunde-borrower", 56);
    expect(momentLine(lines, view)).toMatchObject({ key: "line.route.refused", params: { route: "route.uk-masters", reason: "funds" } });
  });

  test("[R-MOMENT-001] given Ada's flight, when it lands, then the landing is the card, made by the flight's own line", () => {
    const { lines, view } = played("ada-careful", 148);
    expect(momentLine(lines, view)?.key).toBe("line.route.departed");
  });

  test("[R-MOMENT-001] given a chapter closing with nothing bigger beside it, then the chapter is the card; of two closed at once the last is told", () => {
    const { lines, view } = played("ada-careful", 31);
    expect(momentLine(lines, view)).toMatchObject({ key: "line.chapter.closed", params: { chapter: "chapter.build-the-file" } });
    const both = played("tunde-abroad", 115);
    expect(momentLine(both.lines, both.view)).toMatchObject({ key: "line.chapter.closed", params: { chapter: "chapter.send-off" } });
  });

  test("[R-MOMENT-001] given the agent, the bus home and the draw, then each is its card, the draw only when it is staged as a big win", () => {
    expect(momentLine([line("line.offer.agent-scam", { agent: "offer.agent-stop.who.1", amount: naira(2_500_000) }, { tone: "bad" })], AT_HOME)?.key).toBe("line.offer.agent-scam");
    expect(momentLine([line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" })], AT_HOME)?.key).toBe("line.activity.robbed");
    expect(momentLine([line("line.lottery.letter", { draw: 6, won: naira(5_000_000) }, { big: true })], AT_HOME)?.key).toBe("line.lottery.letter");
    expect(momentLine([line("line.lottery.letter", { draw: 6, won: naira(50_000) })], AT_HOME)).toBeNull();
    expect(momentLine([line("line.activity.lotto-won", { tickets: 3, stake: naira(60_000), won: naira(50_000) })], AT_HOME)).toBeNull();
  });

  test("[R-MOMENT-001] given the order of the list, when a refusal and a robbery come in one report, then the refusal is the card, and no line of a quiet month makes one", () => {
    const robbed = line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" });
    const refused = line("line.route.refused", { route: "route.uk-masters", reason: "interview" }, { tone: "bad" });
    expect(momentLine([robbed, refused], AT_HOME)).toBe(refused);
    expect(momentLine([line("line.activity.played", { activity: "activity.rest" })], AT_HOME)).toBeNull();
    expect(MOMENTS.map((entry) => entry.kind)).toEqual(["refused", "granted", "robbed", "agent", "won", "won", "landed", "chapter"]);
  });

  test("[R-MOMENT-001] given the road or a life that has ended, then nothing is a moment", () => {
    const refused = line("line.route.refused", { route: "route.uk-masters", reason: "funds" }, { tone: "bad" });
    expect(momentLine([refused], { ...AT_HOME, place: { ...AT_HOME.place, where: "road" } })).toBeNull();
    expect(momentLine([refused], { ...AT_HOME, ended: true })).toBeNull();
  });

  test("[R-MOMENT-006] given a line and its tidied copy, then they are the same line, and another is not", () => {
    const granted = line("line.route.granted", { route: "route.uk-masters" }, { big: true });
    expect(sameLine(granted, { ...granted, params: { ...granted.params } })).toBe(true);
    expect(sameLine(granted, line("line.route.granted", { route: "route.uk-care" }))).toBe(false);
  });
});

describe("what a card holds", () => {
  test("[R-MOMENT-002] given Ada's grant, then the card names the route, says the route's line, and the figure is the months played", () => {
    const { lines, view } = played("ada-careful", 144);
    const face = momentFace(momentLine(lines, view)!, view)!;
    expect(face).toMatchObject({ kind: "granted", tone: "good", kicker: say("moment.granted.kicker"), title: say("route.uk-masters.name"), line: say("moment.granted.line.route.uk-masters"), chip: null });
    expect(face.figure).toEqual({ value: view.month, unit: { kind: "count" }, caption: say("moment.granted.caption") });
    expect(face.mark).toBe("Japacity");
    expect(face.address).toBe("japacity.app");
  });

  test("[R-MOMENT-002] given Tunde's refusal on the funds, then it is dark, says the funds' line, and its figure is the untraced share on the file the letter judged, as a whole percent", () => {
    const { lines, view, before } = played("tunde-borrower", 56);
    const face = momentFace(momentLine(lines, view)!, view, before)!;
    expect(face).toMatchObject({ kind: "refused", tone: "bad", line: say("moment.refused.line.funds"), chip: null });
    const filed = before.routes.find((held) => held.id === "route.uk-masters")!;
    expect(filed.state).toBe("applying");
    expect(face.figure).toEqual({ value: Math.floor(filed.unexplainedBp / 100), unit: { kind: "percent" }, caption: say("moment.refused.caption.funds") });
    expect(figureWords(face.figure, face.figure.value)).toBe("35%");
    // Without the file as it was decided, the months stand instead: the share worked out after the refusal is another file's.
    expect(momentFace(momentLine(lines, view)!, view)!.figure).toEqual({ value: view.month, unit: { kind: "count" }, caption: say("moment.refused.caption") });
    // From the second refusal on the route, its count stands beside the figure.
    const again = { ...view, routes: view.routes.map((held) => (held.id === filed.id ? { ...held, refusals: 2 } : held)) };
    expect(momentFace(momentLine(lines, again)!, again, before)!.chip).toBe(say("moment.refused.again", { count: 2 }));
  });

  test("[R-MOMENT-002] given every reason a letter can give, then the refusal card has its own line for it", () => {
    for (const reason of ["funds", "interview", "history", "credibility", "sponsor", "agent", "endorsement", "relationship", "sham", "lead"]) {
      const face = momentFace(line("line.route.refused", { route: "route.uk-masters", reason }, { tone: "bad" }), AT_HOME)!;
      expect(face.line).toBe(say(`moment.refused.line.${reason}`));
    }
  });

  test("[R-MOMENT-002] given the agent and the bus home, then the figure is the money gone, in whole naira, with the new phone beside the cash", () => {
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

  test("[R-MOMENT-002] given a big win, then the figure is the sum won, and a kiosk win says the tickets and what they cost", () => {
    const letter = momentFace(line("line.lottery.letter", { draw: 6, won: naira(31_400_000) }, { big: true }), AT_HOME)!;
    expect(letter).toMatchObject({ kind: "won", tone: "good", title: say("moment.won.title.letter"), chip: null });
    expect(figureWords(letter.figure, letter.figure.value)).toBe("₦314,000");
    const kiosk = momentFace(line("line.activity.lotto-won", { tickets: 3, stake: naira(60_000), won: naira(5_000_000) }, { big: true }), AT_HOME)!;
    expect(kiosk.title).toBe(say("moment.won.title.kiosk"));
    expect(kiosk.chip).toBe(`3 tickets for ${formatMoney(60_000, "NGN")}`);
  });

  test("[R-MOMENT-002] given Ada's landing, then the title is the country, the line is the country's, and the figure the months from Lagos", () => {
    const { lines, view } = played("ada-careful", 148);
    const face = momentFace(momentLine(lines, view)!, view)!;
    expect(face).toMatchObject({ kind: "landed", title: say("country.uk.name"), line: say("moment.landed.line.country.uk") });
    expect(face.figure).toMatchObject({ value: view.month, unit: { kind: "count" } });
  });

  test("[R-MOMENT-002] given a chapter at home, then the figure is japacity; given one after the flight, the months played", () => {
    const home = played("ada-careful", 31);
    const face = momentFace(momentLine(home.lines, home.view)!, home.view)!;
    expect(face).toMatchObject({ title: say("chapter.build-the-file.title"), line: say("chapter.build-the-file.close") });
    expect(face.figure).toEqual({ value: home.view.japacity.percent, unit: { kind: "percent" }, caption: say("moment.chapter.caption.japacity") });
    const abroad = played("ada-abroad", 186);
    const landed = momentFace(momentLine(abroad.lines, abroad.view)!, abroad.view)!;
    expect(landed.title).toBe(say("chapter.landing.title"));
    expect(landed.figure).toEqual({ value: abroad.view.month, unit: { kind: "count" }, caption: say("moment.chapter.caption") });
  });

  test("[R-MOMENT-005] given every card these lives and lines make, then the line never repeats the figure the card shows, and a loss carries no joke version", () => {
    const faces = [played("ada-careful", 144), played("tunde-borrower", 56), played("ada-careful", 148), played("ada-careful", 31)].map(({ lines, view, before }) => momentFace(momentLine(lines, view)!, view, before)!);
    faces.push(momentFace(line("line.activity.robbed", { cash: naira(14_200_000), phone: naira(6_000_000) }, { tone: "bad" }), AT_HOME)!);
    faces.push(momentFace(line("line.offer.agent-scam", { agent: "offer.agent-stop.who.1", amount: naira(2_500_000) }, { tone: "bad" }), AT_HOME)!);
    for (const face of faces) {
      expect(face.line).not.toContain(figureWords(face.figure, face.figure.value));
      expect(face.line).not.toMatch(/\{|\}/);
    }
    // A loss's words have one version only: no joke can be drawn for it (R-TEXT-002).
    for (const entry of MOMENTS.filter((moment) => moment.tone === "bad")) expect(say(`moment.${entry.kind}.line.v2`)).toBe(`moment.${entry.kind}.line.v2`);
  });
});
