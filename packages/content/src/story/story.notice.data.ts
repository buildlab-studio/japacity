// The phone's bill notices and the appointment's reminders (world:phone-holds-what-phones-hold).
// A notice is one line per open obligation, read from `view.obligations`: the words are
// `obligation.notice.<type>` in obligation.text.ts, or the shared `obligation.notice.late` once a
// charge was missed and `obligation.notice.defaulted` for a loan gone bad; each carries `obligation`
// (the entry id) and `amount` (this month's charge, as money).
// A reminder is read from the documents' and the routes' state; its words are in document.text.ts
// and route.text.ts, and `month` is the month the paper or the decision is due.
import type { Content, Id, MoneyParam, ObligationType, PlayerView } from "@japacity/sim";

import { signalsHold, type StorySignal, type StoryView } from "./story.signal";

/** Every obligation type, so a notice exists for each. */
export const OBLIGATION_TYPES = [
  "upkeep",
  "support",
  "loan",
  "held-funds",
  "rent",
  "phone",
  "car",
  "surcharge",
  "tuition",
  "agent-debt",
  "undertaking",
  "group-loan",
  "ajo",
] as const satisfies readonly ObligationType[];

export interface Notice {
  key: string;
  params: { obligation: Id<"obligation">; amount: MoneyParam };
}

/** The notice key for an open obligation: due, late once a charge was missed, or defaulted. */
export function noticeKey(type: ObligationType, state: "active" | "grace" | "defaulted", missed: number): string {
  if (state === "defaulted") return "obligation.notice.defaulted";
  if (missed > 0) return "obligation.notice.late";
  return `obligation.notice.${type}`;
}

/** The bill notices due now: one for each open obligation with a charge this month. */
export function noticesDue(view: Pick<PlayerView, "obligations">, content: Content): Notice[] {
  return view.obligations.flatMap((open): Notice[] => {
    const entry = content.obligation[open.entry];
    if (entry === undefined || open.due <= 0) return [];
    return [{ key: noticeKey(entry.type, open.state, open.missed), params: { obligation: open.entry, amount: { currency: entry.currency, amount: open.due } } }];
  });
}

export interface Reminder {
  /** The words key. */
  key: string;
  when: StorySignal[];
  /** Where `month` comes from, or null when the words carry none. */
  month: { document: Id<"document"> } | { route: Id<"route"> } | null;
}

const UK: Id<"route"> = "route.uk-masters";

export const reminders: Reminder[] = [
  // The appointments: the visa centre and the tests. The file comes from the box under the bed first.
  { key: "route.uk-masters.reminder.appointment", when: [{ on: "activity", activity: "activity.apply-for-visa" }], month: null },
  { key: "route.uk-masters.reminder.interview", when: [{ on: "setpiece", setpiece: "setpiece.credibility-interview" }], month: null },
  { key: "route.uk-masters.reminder.decision", when: [{ on: "visa", route: UK }], month: { route: UK } },
  { key: "document.english-test.reminder.book", when: [{ on: "activity", activity: "activity.sit-english-test" }, { on: "chapter", chapter: "chapter.build-the-file" }], month: null },
  { key: "document.english-test.reminder.due", when: [{ on: "document", document: "document.english-test", state: "pending" }], month: { document: "document.english-test" } },
  { key: "document.tb-certificate.reminder.book", when: [{ on: "activity", activity: "activity.tb-test" }, { on: "chapter", chapter: "chapter.decision-day" }], month: null },
  // Papers on the way, and papers run out.
  { key: "document.passport.reminder.due", when: [{ on: "document", document: "document.passport", state: "pending" }], month: { document: "document.passport" } },
  { key: "document.transcript.reminder.due", when: [{ on: "document", document: "document.transcript", state: "pending" }], month: { document: "document.transcript" } },
  { key: "document.passport.reminder.expired", when: [{ on: "document", document: "document.passport", state: "expired" }], month: null },
  { key: "document.english-test.reminder.expired", when: [{ on: "document", document: "document.english-test", state: "expired" }], month: null },
  { key: "document.tb-certificate.reminder.expired", when: [{ on: "document", document: "document.tb-certificate", state: "expired" }], month: null },
];

/** The reminders due now, with the month each is due when it carries one. */
export function remindersDue(view: StoryView, content: Content): { key: string; params: { month?: number } }[] {
  return reminders.flatMap((reminder) => {
    if (!signalsHold(reminder.when, view, content)) return [];
    if (reminder.month === null) return [{ key: reminder.key, params: {} }];
    const at = reminder.month;
    const month = "document" in at ? view.documents.find((paper) => paper.id === at.document)?.readyMonth : view.routes.find((route) => route.id === at.route)?.visa?.decisionMonth;
    return month === undefined || month === null ? [] : [{ key: reminder.key, params: { month } }];
  });
}
