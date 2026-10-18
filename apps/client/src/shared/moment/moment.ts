// The screenshot moments (docs/rules/moment.md): every big outcome is one clean card over the scene, with one line in
// the game's voice, the figure that makes it land, and the game's small mark with its address in a corner. This file
// says which lines are moments and what each card holds; features/moment/MomentCard.tsx draws it. Words come from content only.
import { content } from "@japacity/content";
import type { Currency, Id, PlayerView, ReportLine } from "@japacity/sim";

import { tidyLines } from "../words/lines";
import { formatMoney, formatNumber } from "../words/format";
import { formatParam, hasWords, nameOf, say, sayCount } from "../words/text";

/** The kinds of moment, each with its words under `moment.<kind>` in content. */
type MomentKind = "granted" | "refused" | "agent" | "deposit" | "robbed" | "won" | "landed" | "chapter" | "held";

/** A card's icon, by name; the card maps each to its drawing. */
export type MomentIcon = "luggage" | "file-x" | "phone-off" | "banknote-x" | "bus" | "ticket" | "plane-landing" | "book" | "piggy-bank";

/** One entry of the list: the line that makes the moment, and whether a given line of that key does. */
export interface MomentEntry {
  kind: MomentKind;
  key: string;
  icon: MomentIcon;
  /** A win is drawn light, a loss dark (R-MOMENT-002). */
  tone: "good" | "bad";
  /** Narrows the key: a draw is a moment only when it is staged as a big win (R-LUCK-008). */
  is?: (line: ReportLine) => boolean;
}

const bigWin = (line: ReportLine): boolean => line.big === true;

/**
 * R-MOMENT-001: the outcomes that are moments, most telling first. A batch of lines (a month's report, a command's
 * answer, the authority's own lines) gives at most one card: the first entry here that one of its lines makes. The
 * flight's line is the landing, so the chapter closed beside it, or the decision day closed beside the grant, never
 * stacks a second card on the first. The endorsement refused is a refusal: its own line tells it, since
 * the screen folds the route's refusal into the body's (`oneEndorsementStory`). The deposit a road pitch took for
 * nothing is a loss in the agent's style.
 */
export const MOMENTS: readonly MomentEntry[] = [
  { kind: "refused", key: "line.route.refused", icon: "file-x", tone: "bad" },
  { kind: "refused", key: "line.route.endorsement-refused", icon: "file-x", tone: "bad" },
  { kind: "granted", key: "line.route.granted", icon: "luggage", tone: "good" },
  { kind: "robbed", key: "line.activity.robbed", icon: "bus", tone: "bad" },
  { kind: "agent", key: "line.offer.agent-scam", icon: "phone-off", tone: "bad" },
  { kind: "deposit", key: "line.route.road-fraud", icon: "banknote-x", tone: "bad" },
  { kind: "won", key: "line.lottery.letter", icon: "ticket", tone: "good", is: bigWin },
  { kind: "won", key: "line.activity.lotto-won", icon: "ticket", tone: "good", is: bigWin },
  { kind: "landed", key: "line.route.departed", icon: "plane-landing", tone: "good" },
  { kind: "chapter", key: "line.chapter.closed", icon: "book", tone: "good" },
  // The passbook's stamps: the road's own figure held before a milestone on the way.
  { kind: "held", key: "line.passbook.ready", icon: "piggy-bank", tone: "good" },
  { kind: "held", key: "line.passbook.stamped", icon: "piggy-bank", tone: "good" },
];

function entryFor(line: ReportLine): MomentEntry | null {
  return MOMENTS.find((entry) => entry.key === line.key && (entry.is?.(line) ?? true)) ?? null;
}

/**
 * R-MOMENT-001: the one line of a batch that becomes a card, or null. Nothing on the road chain is a moment (road.md
 * R-ROAD-010), and an ended life has its own card. Of several chapters closed at once, the last is the one told.
 * `earlier`: the month's lines told before the batch, where the deposit a pitch took was paid; a deposit's line whose
 * deposit is not among them makes no card, since a card never stands without its figure.
 */
export function momentLine(lines: readonly ReportLine[], view: Pick<PlayerView, "place" | "ended">, earlier: readonly ReportLine[] = []): ReportLine | null {
  if (view.place.where === "road" || view.ended) return null;
  const told = tidyLines(lines);
  for (const entry of MOMENTS) {
    const made = told.filter((line) => entryFor(line) === entry && (entry.kind !== "deposit" || depositPaid([...earlier, ...lines]) !== null));
    // Of several chapters closed at once the last is told; of several stamps reached at one close, the highest.
    const line = entry.kind === "chapter" || entry.kind === "held" ? made.at(-1) : made[0];
    if (line !== undefined) return line;
  }
  return null;
}

const WALLET = "line.wallet.";
const DEPOSIT_PAID = "line.wallet.fee-agent";
const TAKEN = "line.offer.taken";

/** A road pitch (road.md R-ROAD-002): an offer of the road's group whose taking pays a deposit. */
function isPitch(offer: unknown): offer is Id<"offer"> {
  const entry = typeof offer === "string" ? content.offer[offer as Id<"offer">] : undefined;
  return entry?.group === "road" && entry.terms.deposit !== undefined;
}

/**
 * The deposit the last road pitch taken was paid, and the pitch: the wallet's lines told just before its answer (the
 * deposit leaves the naira by its size, so from one pocket or two, R-ROAD-003). Null when the lines hold none.
 */
function depositPaid(lines: readonly ReportLine[]): { offer: Id<"offer">; amount: { currency: Currency; amount: number } } | null {
  for (let at = lines.length - 1; at >= 0; at -= 1) {
    const line = lines[at]!;
    const offer = line.params["offer"];
    if (line.key !== TAKEN || line.params["choice"] !== "take" || !isPitch(offer)) continue;
    let amount = 0;
    let currency: Currency = "NGN";
    for (let before = at - 1; before >= 0 && lines[before]!.key.startsWith(WALLET); before -= 1) {
      const paid = lines[before]!.key === DEPOSIT_PAID ? moneyParamOf(lines[before]!, "amount") : null;
      if (paid === null) continue;
      amount += paid.amount;
      currency = paid.currency;
    }
    return amount > 0 ? { offer, amount: { currency, amount } } : null;
  }
  return null;
}

/** True when two lines are the same line, whether or not they are the same object (the store tidies its own copies). */
export function sameLine(a: ReportLine, b: ReportLine): boolean {
  return a.key === b.key && JSON.stringify(a.params) === JSON.stringify(b.params);
}

/** The figure that makes the moment land: a whole number and how it is said, with its caption (R-MOMENT-002). */
export interface MomentFigure {
  value: number;
  /** Money in whole units of its currency, a share as a whole percent, or a count. */
  unit: { kind: "money"; currency: Currency } | { kind: "percent" } | { kind: "count" };
  caption: string;
}

/** What a card holds (R-MOMENT-002): every string is content's words, formatted. */
export interface MomentFace {
  kind: MomentKind;
  tone: "good" | "bad";
  icon: MomentIcon;
  kicker: string;
  title: string;
  line: string;
  figure: MomentFigure;
  /** At most one small fact beside the figure: a second refusal, the new phone, the tickets bought. */
  chip: string | null;
  mark: string;
  address: string;
}

/** The figure as the card shows it: whole naira, pounds or dollars, a whole percent, or a count. Never a sign. */
export function figureWords(figure: Pick<MomentFigure, "unit">, value: number): string {
  switch (figure.unit.kind) {
    case "money":
      return formatMoney(value, figure.unit.currency);
    case "percent":
      return `${formatNumber(value)}%`;
    case "count":
      return formatNumber(value);
    default: {
      const never: never = figure.unit;
      throw new Error(`Unknown figure ${JSON.stringify(never)}`);
    }
  }
}

/** Content's variant of a key where it has words for it, else the key itself. */
function variant(key: string, part: string | null): string {
  return part !== null && hasWords(`${key}.${part}`) ? `${key}.${part}` : key;
}

function stringParam(line: ReportLine, name: string): string | null {
  const value = line.params[name];
  return typeof value === "string" ? value : null;
}

function moneyParamOf(line: ReportLine, name: string): { currency: Currency; amount: number } | null {
  const value = line.params[name];
  return typeof value === "object" ? value : null;
}

/** How long the life has been at it: the months played, the figure the share cards carry too (R-SHARE-004). */
function monthsFigure(view: Pick<PlayerView, "month">, caption: string): MomentFigure {
  return { value: view.month, unit: { kind: "count" }, caption: sayCount(caption, view.month) };
}

function moneyFigure(money: { currency: Currency; amount: number }, caption: string): MomentFigure {
  return { value: money.amount, unit: { kind: "money", currency: money.currency }, caption: say(caption) };
}

/** R-ROUTE-013, R-ROUTE-019: the untraced share as a whole percent, when it is what the letter refused on. */
function untracedShare(route: PlayerView["routes"][number] | undefined): number | null {
  if (route === undefined || route.unexplainedBp < content.tuning.route.fundsReasonBp) return null;
  return Math.floor(route.unexplainedBp / 100);
}

type Built = Pick<MomentFace, "title" | "line" | "figure" | "chip"> & {
  /** The kicker's variant where the outcome has its own (`moment.<kind>.kicker.<part>`), else the kind's. */
  kicker?: string;
};

function granted(line: ReportLine, view: PlayerView): Built {
  const route = stringParam(line, "route") ?? "";
  return { title: nameOf(route), line: say(variant("moment.granted.line", route)), figure: monthsFigure(view, "moment.granted.caption"), chip: null };
}

/** The endorsing body's refusal (R-ENDORSE-002): told by its own line, the route's refusal noted beside it folded away. */
const ENDORSEMENT_REFUSED = "line.route.endorsement-refused";

function refused(line: ReportLine, view: PlayerView, before: PlayerView | null): Built {
  const route = stringParam(line, "route") ?? "";
  const reason = line.key === ENDORSEMENT_REFUSED ? "endorsement" : (stringParam(line, "reason") ?? "credibility");
  const held = view.routes.find((candidate) => candidate.id === route);
  // The share on the file the letter judged: the route as it stood while it was being decided. Once refused, the
  // figure is worked against the funds a new file would need, so it is not the one the letter read.
  const filed = before?.routes.find((candidate) => candidate.id === route && candidate.state === "applying");
  const share = reason === "funds" ? untracedShare(filed) : null;
  const figure: MomentFigure = share === null ? monthsFigure(view, "moment.refused.caption") : { value: share, unit: { kind: "percent" }, caption: say("moment.refused.caption.funds") };
  const again = held !== undefined && held.refusals > 1 ? say("moment.refused.again", { count: held.refusals }) : null;
  return { title: nameOf(route), kicker: say(variant("moment.refused.kicker", reason)), line: say(variant("moment.refused.line", reason)), figure, chip: again };
}

function agent(line: ReportLine): Built {
  const who = line.params["agent"];
  const amount = moneyParamOf(line, "amount") ?? { currency: "NGN", amount: 0 };
  return { title: who === undefined ? "" : formatParam("agent", who, line.params, line.key), line: say("moment.agent.line"), figure: moneyFigure(amount, "moment.agent.caption"), chip: null };
}

/** R-MOMENT-002: the deposit a road pitch took and the pitch's own name; the figure the deposit gone. */
function deposit(earlier: readonly ReportLine[]): Built | null {
  const paid = depositPaid(earlier);
  if (paid === null) return null;
  return { title: nameOf(paid.offer), line: say(variant("moment.deposit.line", paid.offer)), figure: moneyFigure(paid.amount, "moment.deposit.caption"), chip: null };
}

function robbed(line: ReportLine): Built {
  const cash = moneyParamOf(line, "cash");
  const phone = moneyParamOf(line, "phone");
  // With no cash on you, the phone is what the bus took.
  const figure = cash !== null && cash.amount > 0 ? moneyFigure(cash, "moment.robbed.caption") : moneyFigure(phone ?? { currency: "NGN", amount: 0 }, "moment.robbed.caption.phone");
  const chip = cash !== null && cash.amount > 0 && phone !== null && phone.amount > 0 ? say("moment.robbed.phone", { phone }) : null;
  return { title: say("moment.robbed.title"), line: say("moment.robbed.line"), figure, chip };
}

function won(line: ReportLine): Built {
  const kiosk = line.key === "line.activity.lotto-won";
  const amount = moneyParamOf(line, "won") ?? { currency: "NGN", amount: 0 };
  const tickets = line.params["tickets"];
  const stake = moneyParamOf(line, "stake");
  const chip = kiosk && typeof tickets === "number" && stake !== null ? sayCount("moment.won.tickets", tickets, { tickets, stake }) : null;
  return { title: say(kiosk ? "moment.won.title.kiosk" : "moment.won.title.letter"), line: say("moment.won.line"), figure: moneyFigure(amount, "moment.won.caption"), chip };
}

function landed(line: ReportLine, view: PlayerView): Built {
  const route = stringParam(line, "route") as Id<"route"> | null;
  const country = (route === null ? null : content.route[route]?.country) ?? view.place.country ?? "";
  return { title: nameOf(country), line: say(variant("moment.landed.line", country)), figure: monthsFigure(view, "moment.landed.caption"), chip: null };
}

function chapter(line: ReportLine, view: PlayerView): Built {
  const id = stringParam(line, "chapter") ?? "";
  // Japacity is how ready the move is, so it is the figure only at home; after the flight the months are (R-SHARE-004).
  const percent = view.place.where === "home" ? view.japacity.percent : null;
  const figure: MomentFigure = percent === null ? monthsFigure(view, "moment.chapter.caption") : { value: percent, unit: { kind: "percent" }, caption: say("moment.chapter.caption.japacity") };
  return { title: say(`${id}.title`), line: say(`${id}.close`), figure, chip: null };
}

/** A passbook stamp: the sum held, with Mama hearing of it; the road's own figure names the way and says the money is ready. */
function held(line: ReportLine): Built {
  const amount = moneyParamOf(line, "amount") ?? { currency: "NGN", amount: 0 };
  if (line.key === "line.passbook.ready") {
    const route = stringParam(line, "route") ?? "";
    return { title: nameOf(route), kicker: say("moment.held.kicker.ready"), line: say("moment.held.line.ready"), figure: moneyFigure(amount, "moment.held.caption.ready"), chip: null };
  }
  return { title: say("moment.held.title"), line: say("moment.held.line"), figure: moneyFigure(amount, "moment.held.caption"), chip: null };
}

function built(entry: MomentEntry, line: ReportLine, view: PlayerView, before: PlayerView | null, earlier: readonly ReportLine[]): Built | null {
  switch (entry.kind) {
    case "granted":
      return granted(line, view);
    case "refused":
      return refused(line, view, before);
    case "agent":
      return agent(line);
    case "deposit":
      return deposit(earlier);
    case "robbed":
      return robbed(line);
    case "won":
      return won(line);
    case "landed":
      return landed(line, view);
    case "chapter":
      return chapter(line, view);
    case "held":
      return held(line);
    default: {
      const never: never = entry.kind;
      throw new Error(`Unknown moment ${String(never)}`);
    }
  }
}

/**
 * R-MOMENT-002: the card for a moment's line, read from the view the line came with (and, for a refusal, the view
 * before it, while the file was being decided). `earlier` holds the month's lines up to and with the moment's own, where
 * a deposit was paid. Null for a line that is no moment, or one whose figure the lines do not hold.
 */
export function momentFace(line: ReportLine, view: PlayerView, before: PlayerView | null = null, earlier: readonly ReportLine[] = [line]): MomentFace | null {
  const entry = entryFor(line);
  if (entry === null) return null;
  const face = built(entry, line, view, before, earlier);
  if (face === null) return null;
  const { kicker, ...rest } = face;
  return { kind: entry.kind, tone: entry.tone, icon: entry.icon, kicker: kicker ?? say(`moment.${entry.kind}.kicker`), ...rest, mark: say("moment.mark"), address: say("moment.address") };
}
