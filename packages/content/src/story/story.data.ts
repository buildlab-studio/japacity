// The story tied to the world (docs/rules/world.md R-WORLD-003, R-WORLD-019): for every chapter item,
// the place where it happens, the thing there whose act moves it, and the nudge words that point at it.
// The nudge words are `chapter.<chapter>.item.<item>.nudge` in chapter.text.ts.
import type { Command, Id } from "@japacity/sim";

/** A phone app, by its id on the phone (R-WORLD-018). */
export type StoryApp = "bank" | "chats" | "japa" | "jobs" | "lotto" | "bills" | "news";

/**
 * What moves the step. An entry opens its own sheet (an activity, an offer, a set piece); a command is
 * sent from the thing's sheet; `wait` means nothing is tapped: the step comes with the month's end.
 */
export type StoryAct = { entry: string } | { command: Extract<Command["type"], "route/pay-deposit" | "route/depart"> } | { wait: true };

export interface StoryStep {
  chapter: Id<"chapter">;
  item: string;
  place: Id<"place">;
  /** True when the thing stands in the room inside the place's building (the parlour inside the family house). */
  inside: boolean;
  /** The thing's id in the place file's `stage.things`, or null when the step lives in the phone only. */
  thing: string | null;
  /** The phone app that carries the same step, or null. A step with no thing always has one. */
  app: StoryApp | null;
  act: StoryAct;
  /** The character takes the file from the box under the bed before the ride (R-WORLD-019). */
  fromBox: boolean;
  /** The nudge words key (R-WORLD-003). */
  nudge: string;
}

/**
 * The things this table points at, by place: outside, and in the room inside. The ids follow the
 * places brief's list of things; the place files' `stage.things` must use the same ids.
 * no place file declares things yet; these ids are the content's reading of that list.
 */
export const storyThings: Record<string, { outside: string[]; inside: string[] }> = {
  "place.family-house": { outside: ["gate", "house-door"], inside: ["sofa", "mama", "papa", "tv", "papers-box", "door"] },
  "place.visa-centre": { outside: ["desk", "chairs", "door"], inside: [] },
  "place.agent-office": { outside: ["agent-desk", "door"], inside: [] },
  "place.english-test-centre": { outside: ["test-desk", "door"], inside: [] },
  "place.tb-clinic": { outside: ["nurse-desk", "door"], inside: [] },
  // the places brief's "bank counter" names no place id; the held funds are staged here.
  "place.olokun-office": { outside: ["counter", "door"], inside: [] },
  "place.yaba": { outside: ["long-desk", "jobs-board", "meetup-corner", "door"], inside: [] },
  "place.the-room": { outside: ["bed", "window", "door"], inside: [] },
  "place.airport-lagos": { outside: ["gate", "door"], inside: [] },
  "place.bode-thomas": { outside: ["lotto-kiosk", "betting-shop", "danfo", "keke", "okada"], inside: [] },
  "place.tejuosho-market": { outside: ["mum-stall", "danfo"], inside: [] },
  "place.ojuelegba": { outside: ["hub-front", "stop", "motor-park"], inside: [] },
  // Not among the thirteen places; the church is where some people are met (R-WORLD-020).
  "place.church": { outside: ["pews", "door"], inside: [] },
};

type At = Pick<StoryStep, "place" | "thing" | "app" | "act"> & Partial<Pick<StoryStep, "inside" | "fromBox">>;

function step(chapter: Id<"chapter">, item: string, at: At): StoryStep {
  return { chapter, item, place: at.place, inside: at.inside ?? false, thing: at.thing, app: at.app, act: at.act, fromBox: at.fromBox ?? false, nudge: `${chapter}.item.${item}.nudge` };
}

const FEET: Id<"chapter"> = "chapter.find-your-feet";
const FILE: Id<"chapter"> = "chapter.build-the-file";
const DECISION: Id<"chapter"> = "chapter.decision-day";
const SEND_OFF: Id<"chapter"> = "chapter.send-off";
const LANDING: Id<"chapter"> = "chapter.landing";
const SECURE: Id<"chapter"> = "chapter.secure";

const HUB: Id<"place"> = "place.yaba";
const HOUSE: Id<"place"> = "place.family-house";
const ROOM: Id<"place"> = "place.the-room";
const BANK: Id<"place"> = "place.olokun-office";
const VISA: Id<"place"> = "place.visa-centre";
const CLINIC: Id<"place"> = "place.tb-clinic";
const AGENT: Id<"place"> = "place.agent-office";

export const storySteps: StoryStep[] = [
  // Find your feet: the hub in Yaba carries the first chapter.
  step(FEET, "job", { place: HUB, thing: "long-desk", app: "jobs", act: { entry: "activity.job-hunt" } }),
  step(FEET, "pay", { place: HUB, thing: "long-desk", app: "jobs", act: { wait: true } }),
  // nothing at home makes a route heard on a tap (the send-off party opens by chance and
  // R-ROUTE-003 hears by month 3 on its own), so the step points at the meetup, which can.
  step(FEET, "heard", { place: HUB, thing: "meetup-corner", app: null, act: { entry: "activity.meetup" } }),
  step(FEET, "known", { place: HUB, thing: "long-desk", app: "japa", act: { entry: "activity.look-into-route" } }),

  // Build the file. the passport office and the university are not among the thirteen
  // places, so the passport and the transcript are started from the papers box at home.
  step(FILE, "passport", { place: HOUSE, inside: true, thing: "papers-box", app: "japa", act: { entry: "activity.get-passport" } }),
  step(FILE, "transcript", { place: HOUSE, inside: true, thing: "papers-box", app: "japa", act: { entry: "activity.get-transcript" } }),
  step(FILE, "english", { place: "place.english-test-centre", thing: "test-desk", app: null, act: { entry: "activity.sit-english-test" }, fromBox: true }),
  step(FILE, "offer", { place: HUB, thing: "long-desk", app: "japa", act: { entry: "activity.apply-to-school" } }),

  // Decision day.
  step(DECISION, "deposit", { place: BANK, thing: "counter", app: "bank", act: { command: "route/pay-deposit" } }),
  step(DECISION, "held", { place: BANK, thing: "counter", app: "bank", act: { entry: "offer.held-funds" } }),
  step(DECISION, "tb", { place: "place.tb-clinic", thing: "nurse-desk", app: null, act: { entry: "activity.tb-test" }, fromBox: true }),
  step(DECISION, "applied", { place: VISA, thing: "desk", app: null, act: { entry: "activity.apply-for-visa" }, fromBox: true }),
  step(DECISION, "granted", { place: VISA, thing: "desk", app: "japa", act: { wait: true } }),

  // The file and decision day of each other way out (chapter.md R-CHAPTER-009). the file stays in
  // the box for these rows (the four rows that take it to a desk are the master's); each row names where the
  // step is taken: the clinic's desk, the hub's desk, the visa centre, the agent's office.
  step("chapter.build-the-file-care", "tenure", { place: CLINIC, thing: "nurse-desk", app: "japa", act: { wait: true } }),
  step("chapter.build-the-file-care", "verification", { place: CLINIC, thing: "nurse-desk", app: "japa", act: { entry: "activity.request-verification" } }),
  step("chapter.build-the-file-care", "sponsor", { place: HUB, thing: "long-desk", app: "japa", act: { entry: "activity.find-sponsor" } }),
  step("chapter.build-the-file-care", "applied", { place: VISA, thing: "desk", app: null, act: { entry: "activity.apply-uk-care" } }),
  step("chapter.build-the-file-talent", "portfolio", { place: HUB, thing: "long-desk", app: null, act: { entry: "activity.build-portfolio" } }),
  step("chapter.build-the-file-talent", "endorsement", { place: HUB, thing: "long-desk", app: "japa", act: { entry: "activity.apply-endorsement" } }),
  step("chapter.build-the-file-talent", "applied", { place: VISA, thing: "desk", app: null, act: { entry: "activity.apply-uk-talent" } }),
  step("chapter.build-the-file-points", "eca", { place: HOUSE, inside: true, thing: "papers-box", app: "japa", act: { entry: "activity.get-eca" } }),
  step("chapter.build-the-file-points", "english", { place: "place.english-test-centre", thing: "test-desk", app: null, act: { entry: "activity.sit-english-test" } }),
  step("chapter.build-the-file-points", "pool", { place: HUB, thing: "long-desk", app: "japa", act: { entry: "activity.enter-pool" } }),
  step("chapter.build-the-file-points", "invited", { place: HUB, thing: null, app: "japa", act: { wait: true } }),
  step("chapter.build-the-file-gulf", "medical", { place: CLINIC, thing: "nurse-desk", app: null, act: { entry: "activity.gulf-medical" } }),
  step("chapter.build-the-file-gulf", "agent", { place: AGENT, thing: "agent-desk", app: null, act: { entry: "offer.gulf-agent" } }),
  step("chapter.build-the-file-gulf", "contract", { place: AGENT, thing: "agent-desk", app: null, act: { entry: "activity.apply-gulf-contract" } }),
  step("chapter.decision-day-care", "tb", { place: CLINIC, thing: "nurse-desk", app: null, act: { entry: "activity.tb-test" } }),
  step("chapter.decision-day-care", "police", { place: VISA, thing: "desk", app: null, act: { entry: "activity.get-police-certificate" } }),
  step("chapter.decision-day-care", "applied", { place: VISA, thing: "desk", app: null, act: { entry: "activity.apply-uk-care" } }),
  step("chapter.decision-day-care", "granted", { place: VISA, thing: "desk", app: "japa", act: { wait: true } }),
  step("chapter.decision-day-talent", "tb", { place: CLINIC, thing: "nurse-desk", app: null, act: { entry: "activity.tb-test" } }),
  step("chapter.decision-day-talent", "applied", { place: VISA, thing: "desk", app: null, act: { entry: "activity.apply-uk-talent" } }),
  step("chapter.decision-day-talent", "granted", { place: VISA, thing: "desk", app: "japa", act: { wait: true } }),
  step("chapter.decision-day-points", "police", { place: VISA, thing: "desk", app: null, act: { entry: "activity.get-police-certificate" } }),
  // The invitation sends the application and takes the fee (R-POINTS-003): nothing is tapped.
  step("chapter.decision-day-points", "applied", { place: HUB, thing: null, app: "japa", act: { wait: true } }),
  step("chapter.decision-day-points", "granted", { place: HUB, thing: null, app: "japa", act: { wait: true } }),
  step("chapter.decision-day-gulf", "police", { place: VISA, thing: "desk", app: null, act: { entry: "activity.get-police-certificate" } }),
  step("chapter.decision-day-gulf", "applied", { place: AGENT, thing: "agent-desk", app: null, act: { entry: "activity.apply-gulf-contract" } }),
  step("chapter.decision-day-gulf", "granted", { place: AGENT, thing: "agent-desk", app: "japa", act: { wait: true } }),

  // The send-off.
  step(SEND_OFF, "departed", { place: "place.airport-lagos", thing: "gate", app: "japa", act: { command: "route/depart" }, fromBox: true }),

  // Landing: the room abroad is home now; work, the bank and the bills are in the phone.
  step(LANDING, "room", { place: ROOM, thing: "bed", app: null, act: { wait: true } }),
  step(LANDING, "job", { place: ROOM, thing: "door", app: "jobs", act: { entry: "activity.job-hunt" } }),
  step(LANDING, "status", { place: ROOM, thing: null, app: "japa", act: { wait: true } }),
  step(LANDING, "request", { place: ROOM, thing: null, app: "bank", act: { entry: "activity.send-money" } }),
  step(LANDING, "file", { place: ROOM, thing: null, app: "bills", act: { wait: true } }),

  // Secure.
  step(SECURE, "secure", { place: ROOM, thing: "window", app: "japa", act: { wait: true } }),
];

/** The longest a nudge may be (R-WORLD-003). */
export const NUDGE_WORDS = 8;

/** The row for a chapter's item, or null. */
export function storyStep(chapter: Id<"chapter">, item: string): StoryStep | null {
  return storySteps.find((row) => row.chapter === chapter && row.item === item) ?? null;
}
