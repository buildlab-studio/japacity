// What the phone can read from the view to decide that a chat line, a notice or a reminder is due
// (world:phone-holds-what-phones-hold). Each signal names one thing the view already shows, so a line
// appears only when its event is in the view.
import type { BondStage, Content, Id, ObligationType, PlayerView } from "@japacity/sim";

export type StorySignal =
  /** This chapter is the current one. */
  | { on: "chapter"; chapter: Id<"chapter"> }
  /** This month's report carries a line with this key, and with `about` as one of its params when given. */
  | { on: "line"; key: string; about?: string }
  /** An obligation of this type is open: a bill is due. */
  | { on: "obligation"; obligationType: ObligationType }
  /** A document is in this state. */
  | { on: "document"; document: Id<"document">; state: "pending" | "held" | "expired" }
  /** An activity may be chosen now. */
  | { on: "activity"; activity: Id<"activity"> }
  /** An offer is open. */
  | { on: "offer"; offer: Id<"offer"> }
  /** A visa application on this route waits for its decision. */
  | { on: "visa"; route: Id<"route"> }
  /** A set piece is open. */
  | { on: "setpiece"; setpiece: Id<"setpiece"> }
  /** A job is held. */
  | { on: "job" }
  /** A bond with a computer character is at one of these stages. */
  | { on: "bond"; stages: BondStage[] }
  /** A sibling fills a slot. */
  | { on: "sibling" };

/** The parts of the view the signals read. */
export type StoryView = Pick<PlayerView, "chapter" | "report" | "obligations" | "documents" | "activities" | "offers" | "routes" | "setpiece" | "job" | "people">;

/** True when the view shows the signal's event. */
export function signalHolds(signal: StorySignal, view: StoryView, content: Content): boolean {
  switch (signal.on) {
    case "chapter":
      return view.chapter.current === signal.chapter;
    case "line":
      return view.report?.lines.some((line) => line.key === signal.key && (signal.about === undefined || Object.values(line.params).includes(signal.about))) ?? false;
    case "obligation":
      return view.obligations.some((open) => content.obligation[open.entry]?.type === signal.obligationType);
    case "document":
      return view.documents.some((paper) => paper.id === signal.document && paper.state === signal.state);
    case "activity":
      return view.activities.some((option) => option.id === signal.activity && option.allowed);
    case "offer":
      return view.offers.some((open) => open.entry === signal.offer);
    case "visa":
      return view.routes.some((route) => route.id === signal.route && route.state === "applying" && route.visa !== null);
    case "setpiece":
      return view.setpiece?.entry === signal.setpiece;
    case "job":
      return view.job.id !== null;
    case "bond":
      return view.people.bonds.some((bond) => bond.label === "computer" && signal.stages.includes(bond.stage));
    case "sibling":
      return Object.entries(view.people.slots).some(([slot, held]) => slot.startsWith("sibling-") && held.state !== "empty");
    default: {
      const never: never = signal;
      return never;
    }
  }
}

/** True when every signal holds. */
export function signalsHold(signals: readonly StorySignal[], view: StoryView, content: Content): boolean {
  return signals.every((signal) => signalHolds(signal, view, content));
}
