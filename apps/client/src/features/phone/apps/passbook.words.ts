// The passbook's own words (the Bank's first page; docs/rules/wallet.md R-WALLET-021), first drafts in the voice of
// docs/rules/text.md: a title of a few words, one line in a person's voice, money in naira, months as a count of months.
// Never a day count, a percentage, slots, turns or pages. Content's table wins over these, so each key can move there.
import { text } from "@japacity/content";

import { formatMoney, formatNumber } from "../../../shared/words/format";
import { hasWords, say, type Params } from "../../../shared/words/text";

export const passbookText: Record<string, string> = {
  "passbook.held": "Held for the road",
  "passbook.of": "of {target}",
  "passbook.cash": "Cash on you {amount}",
  "passbook.bank": "In the bank",
  // The pace line: the whole money chapter in one sentence.
  "passbook.pace": "At this pace: ready in {months} months.",
  "passbook.pace.one": "At this pace: ready next month.",
  "passbook.pace.none": "Live a month and the pace shows.",
  "passbook.pace.stuck": "At this pace the road gets no nearer.",
  "passbook.pace.ready": "Everything the road costs is held.",
  "passbook.pace.no-plan": "No plan yet. A way out sets what the road costs.",
  "passbook.pace.unread": "Look into {route} and its whole cost shows here.",
  "passbook.with.ladder": "With the {job} job: {months}.",
  "passbook.with.side": "With a side job: {months}.",
  "passbook.with.family": "With Papa's loan: {months}.",
  "passbook.with.family-meeting": "With the family behind you: {months}.",
  "passbook.with.scholarship": "With the scholarship: {months}.",
  "passbook.with.now": "now",
  "passbook.stamps": "Stamps",
  "passbook.stamp.heard": "Mama heard",
  "passbook.stamp.ready": "Ready",
  "passbook.stamp.all-in": "all in",
  "passbook.last-month": "Last month",
  "passbook.in": "{amount} in",
  "passbook.out": "{amount} out",
  "passbook.roads": "Roads to it",
  "passbook.road.months": "{months} months",
  "passbook.road.months.one": "1 month",
  "passbook.road.months.zero": "Ready now",
  "passbook.road.taken": "Yours",
  "passbook.road.pay": "{amount} a month",
  "passbook.road.side": "{amount} a month, beside the day",
  "passbook.road.ajo": "The street's circle",
  "passbook.road.ajo.line": "{share} a month, a {pot} pot once",
  "passbook.road.ajo.taken": "You are in. The pot comes to you by the draw.",
  "passbook.road.ajo.wait": "Waits for the street to ask",
  "passbook.road.ajo.open": "The street is asking",
  "passbook.road.ajo.go": "Join the circle",
  "passbook.road.family": "Papa's loan",
  "passbook.road.family.line": "About {amount} from the house, no deadline",
  "passbook.road.family.call": "Call Papa",
  "passbook.road.family.ask": "A call home",
  "passbook.road.family.ask.line": "You ask what the house can lend toward the move. Papa will think about it.",
  "passbook.road.family.take": "Take it, with thanks",
  "passbook.road.family-meeting": "The family meeting",
  "passbook.road.family-meeting.line": "What the house can stand behind, {amount} or so",
  "passbook.road.family-meeting.go": "Call the meeting",
  "passbook.road.scholarship.line": "{amount} off what you need to show",
  "passbook.road.scholarship.wait": "Comes in the scholarship round, if it comes",
  "passbook.road.scholarship.go": "Accept the scholarship",
  "passbook.road.needs": "Needs: {needs}",
  "passbook.rest": "The rest of the bank",
};

/** Words for a passbook key: content's first, then the interface's, then these drafts. */
export function passbookWords(key: string, params: Params = {}): string {
  if (text[key] !== undefined || hasWords(key)) return say(key, params);
  const template = passbookText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    if (value === undefined) return whole;
    if (typeof value === "object") return formatMoney(value.amount, value.currency);
    return typeof value === "number" ? formatNumber(value) : value;
  });
}

/** A count's own words where the drafts have them (`.one`, `.zero`), else the plain key. */
export function passbookCount(key: string, count: number, params: Params = {}): string {
  const exact = count === 1 ? `${key}.one` : count === 0 ? `${key}.zero` : null;
  return passbookWords(exact !== null && (passbookText[exact] !== undefined || hasWords(exact)) ? exact : key, { ...params, months: count });
}

/** Naira in the short way people say a big sum: "₦11m", "₦2.5m", "₦850,000" under a million. Rounded down, never up past what is held. */
export function shortNaira(kobo: number): string {
  const naira = Math.floor(kobo / 100);
  if (naira < 1_000_000) return formatMoney(kobo, "NGN");
  const tenths = Math.floor(naira / 100_000);
  const whole = Math.floor(tenths / 10);
  const rest = tenths % 10;
  return `₦${formatNumber(whole)}${rest === 0 ? "" : `.${String(rest)}`}m`;
}
