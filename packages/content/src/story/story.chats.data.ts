// The phone's Chats (world:phone-holds-what-phones-hold): the family group, the partner and a friend.
// The family thread is the family feed (family/family.data.ts, one post a month, chosen as the news
// kind chooses it) plus the lines below, which the story needs at each chapter: Mama on the bills,
// the sibling on the kiosk, Papa on the papers. A line shows when its chapter is current (or it names
// none) and every signal holds in the view, so it appears only when its event is there. The partner's
// lines are a computer partner's; a real partner talks through the pair's own conversation
// (pair:conversation-phrases-stored). Every reply is a preset phrase (pair:preset-phrases-only).
// The words are `<id>.text` in story.text.ts; the sender's name is `chats.from.<sender>`.
import type { Content, Id } from "@japacity/sim";

import { signalsHold, type StorySignal, type StoryView } from "./story.signal";

export type ChatThread = "family" | "partner" | "friend";

export type ChatSender = "mum" | "dad" | "sibling" | "partner" | "friend";

/** A preset reply: a phrase, with its fill-in where the phrase takes one. */
export interface ChatReply {
  phrase: Id<"phrase">;
  fill?: string;
}

export interface ChatLine {
  id: `chats.${string}`;
  thread: ChatThread;
  from: ChatSender;
  /** The chapter the line belongs to, or null for any. */
  chapter: Id<"chapter"> | null;
  /** Every signal must hold for the line to show. */
  when: StorySignal[];
  replies: ChatReply[];
}

/** The sender a thread is with: a family line comes from the family, the others from their one person. */
export const threadSenders: Record<ChatThread, ChatSender[]> = {
  family: ["mum", "dad", "sibling"],
  partner: ["partner"],
  friend: ["friend"],
};

const FEET: Id<"chapter"> = "chapter.find-your-feet";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const DECISION: Id<"chapter"> = "chapter.decision-day";
const SEND_OFF: Id<"chapter"> = "chapter.send-off";
const LANDING: Id<"chapter"> = "chapter.landing";
const SECURE: Id<"chapter"> = "chapter.secure";
const UK: Id<"route"> = "route.uk-masters";
const CARE: Id<"route"> = "route.uk-care";
const TALENT: Id<"route"> = "route.uk-talent";
const POINTS: Id<"route"> = "route.canada-points";
const GULF: Id<"route"> = "route.gulf-contract";

const SIBLING: StorySignal = { on: "sibling" };
const COURTING: StorySignal = { on: "bond", stages: ["courting"] };
const TOGETHER: StorySignal = { on: "bond", stages: ["partner", "married"] };
const ANY_BOND: StorySignal = { on: "bond", stages: ["courting", "partner", "married"] };

const THANKS: ChatReply = { phrase: "phrase.thanks" };
const YES: ChatReply = { phrase: "phrase.yes" };
const NO: ChatReply = { phrase: "phrase.no" };

function family(id: `chats.${string}`, from: "mum" | "dad" | "sibling", chapter: Id<"chapter"> | null, when: StorySignal[], replies: ChatReply[]): ChatLine {
  return { id, thread: "family", from, chapter, when: from === "sibling" ? [SIBLING, ...when] : when, replies };
}

function partner(id: `chats.${string}`, chapter: Id<"chapter"> | null, when: StorySignal[], replies: ChatReply[]): ChatLine {
  return { id, thread: "partner", from: "partner", chapter, when, replies };
}

function friend(id: `chats.${string}`, chapter: Id<"chapter"> | null, when: StorySignal[], replies: ChatReply[]): ChatLine {
  return { id, thread: "friend", from: "friend", chapter, when, replies };
}

export const chatLines: ChatLine[] = [
  // Find your feet.
  family("chats.mum.find-work", "mum", FEET, [{ on: "activity", activity: "activity.job-hunt" }], [THANKS, { phrase: "phrase.busy" }]),
  family("chats.mum.first-job", "mum", null, [{ on: "line", key: "line.activity.job-started" }], [THANKS]),
  family("chats.sibling.kiosk", "sibling", FEET, [{ on: "activity", activity: "activity.play-lotto" }], [YES, NO]),
  family("chats.dad.heard", "dad", FEET, [{ on: "line", key: "line.route.heard" }], [YES, THANKS]),
  friend("chats.friend.meetup", FEET, [{ on: "activity", activity: "activity.meetup" }], [YES, { phrase: "phrase.busy" }]),
  friend("chats.friend.job", null, [{ on: "line", key: "line.activity.job-started" }], [THANKS]),

  // Build the file: Papa on the papers.
  family("chats.dad.passport", "dad", FILE, [{ on: "activity", activity: "activity.get-passport" }], [YES, THANKS]),
  family("chats.dad.passport-box", "dad", null, [{ on: "line", key: "line.document.issued", about: "document.passport" }], [THANKS]),
  family("chats.mum.test", "mum", FILE, [{ on: "document", document: "document.english-test", state: "pending" }], [THANKS, { phrase: "phrase.good-luck", fill: "test" }]),
  family("chats.sibling.offer", "sibling", null, [{ on: "line", key: "line.route.school-offer" }], [{ phrase: "phrase.good-news", fill: "got-papers" }]),

  // Decision day: Mama on the bill, Papa on the file.
  family("chats.mum.light-bill", "mum", null, [{ on: "offer", offer: "offer.nepa-bill" }], [YES, { phrase: "phrase.sorry" }]),
  family("chats.mum.upkeep-missed", "mum", null, [{ on: "line", key: "line.obligation.missed" }, { on: "obligation", obligationType: "upkeep" }], [{ phrase: "phrase.sorry" }]),
  family("chats.dad.file", "dad", DECISION, [{ on: "activity", activity: "activity.apply-for-visa" }], [YES, THANKS]),
  family("chats.mum.waiting", "mum", DECISION, [{ on: "visa", route: UK }], [{ phrase: "phrase.thanks" }]),
  family("chats.sibling.granted", "sibling", null, [{ on: "line", key: "line.route.granted" }], [{ phrase: "phrase.good-news", fill: "visa-came" }]),
  // Bad news is written straight (text:bad-news-never-joked).
  family("chats.mum.refused", "mum", null, [{ on: "line", key: "line.route.refused" }], [THANKS]),
  friend("chats.friend.funds", DECISION, [{ on: "offer", offer: "offer.held-funds-agent" }], [THANKS]),

  // The file and decision day of each other way out (chapter:chapters-follow-lean-route).
  family("chats.dad.verification", "dad", "chapter.build-the-file-care", [{ on: "activity", activity: "activity.request-verification" }], [YES, THANKS]),
  family("chats.dad.endorsement", "dad", "chapter.build-the-file-talent", [{ on: "activity", activity: "activity.apply-endorsement" }], [YES, THANKS]),
  family("chats.mum.eca", "mum", "chapter.build-the-file-points", [{ on: "document", document: "document.eca", state: "pending" }], [THANKS]),
  family("chats.mum.agent", "mum", "chapter.build-the-file-gulf", [{ on: "offer", offer: "offer.gulf-agent" }], [YES, THANKS]),
  family("chats.mum.waiting-care", "mum", "chapter.decision-day-care", [{ on: "visa", route: CARE }], [THANKS]),
  family("chats.mum.waiting-talent", "mum", "chapter.decision-day-talent", [{ on: "visa", route: TALENT }], [THANKS]),
  family("chats.mum.waiting-points", "mum", "chapter.decision-day-points", [{ on: "visa", route: POINTS }], [THANKS]),
  family("chats.dad.waiting-gulf", "dad", "chapter.decision-day-gulf", [{ on: "visa", route: GULF }], [YES, THANKS]),

  // The send-off.
  family("chats.mum.suitcase", "mum", SEND_OFF, [], [YES, THANKS]),
  family("chats.dad.call", "dad", SEND_OFF, [{ on: "line", key: "line.route.departed" }], [{ phrase: "phrase.call-later" }]),

  // Landing.
  family("chats.mum.landed", "mum", null, [{ on: "line", key: "line.place.arrived" }], [{ phrase: "phrase.good-news", fill: "landed" }]),
  family("chats.mum.rent", "mum", LANDING, [{ on: "obligation", obligationType: "rent" }], [THANKS]),
  family("chats.sibling.first-pay", "sibling", null, [{ on: "line", key: "line.activity.salary-first-abroad" }], [THANKS, { phrase: "phrase.busy" }]),
  friend("chats.friend.landed", null, [{ on: "line", key: "line.place.arrived" }], [{ phrase: "phrase.good-news", fill: "landed" }]),

  // Secure.
  family("chats.dad.door", "dad", SECURE, [], [THANKS, { phrase: "phrase.home" }]),
  family("chats.mum.december", "mum", null, [{ on: "line", key: "line.setpiece.december-go" }], [YES, { phrase: "phrase.busy" }]),

  // The partner, while a computer partner is courting or together.
  partner("chats.partner.after-time", null, [COURTING, { on: "line", key: "line.people.met" }], [YES, { phrase: "phrase.slowly" }, { phrase: "phrase.see-you", fill: "suya-spot" }]),
  partner("chats.partner.thinking", null, [TOGETHER], [{ phrase: "phrase.thinking" }, { phrase: "phrase.miss-you" }]),
  partner("chats.partner.interview", null, [ANY_BOND, { on: "setpiece", setpiece: "setpiece.credibility-interview" }], [THANKS]),
  partner("chats.partner.granted", null, [ANY_BOND, { on: "line", key: "line.route.granted" }], [THANKS, { phrase: "phrase.serious" }]),
  partner("chats.partner.going", SEND_OFF, [TOGETHER], [{ phrase: "phrase.serious" }, { phrase: "phrase.plan" }, { phrase: "phrase.sorry" }]),
  partner("chats.partner.abroad", LANDING, [TOGETHER], [{ phrase: "phrase.december" }, { phrase: "phrase.miss-you" }]),
];

/** The chat lines due now, in the table's order (world:phone-holds-what-phones-hold). */
export function chatsDue(view: StoryView, content: Content): ChatLine[] {
  return chatLines.filter((line) => (line.chapter === null || line.chapter === view.chapter.current) && signalsHold(line.when, view, content));
}

/**
 * Each ready life's sibling, named from the pool and the family's people (familyPeople in person.names.data.ts). The prologue's
 * life has no fixed family, so its sibling goes by relation (`chats.from.sibling.plain`).
 */
export const siblingNames: Partial<Record<Id<"scenario">, string>> = {
  "scenario.graduate": "Uche",
  "scenario.banker": "Tolu",
  "scenario.developer": "Amina",
  "scenario.nurse": "Emeka",
  "scenario.teacher": "Mfon",
};
