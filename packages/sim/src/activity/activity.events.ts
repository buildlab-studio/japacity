import type { Id, SlotPick } from "../engine/types";

/** Placeholder: the activity work defines the real events. */
export type ActivityEvent =
  | { type: "activity/job-started"; job: Id<"activity"> }
  | { type: "activity/slots-played"; slots: SlotPick[] };
