import type { Id } from "../engine/types";

export type ThingsEvent =
  /** A thing bought from the market, delivered at once: a rider at the gate, a slip. `paid` in kobo. */
  | { type: "things/bought"; thing: Id<"thing">; month: number; paid: number }
  /** A thing sold back at its resale figure, in kobo. */
  | { type: "things/sold"; thing: Id<"thing">; amount: number }
  /** Leaving Lagos, everything owned sold at once at the resale figures, as the room is let go (place:departure-moves-abroad). */
  | { type: "things/sold-off"; things: Id<"thing">[]; amount: number }
  /** A month's running cost taken at the close: the fuel, the data plan, the bouquet, the light. */
  | { type: "things/ran"; thing: Id<"thing">; amount: number }
  /** A month's running cost not held: the thing stood idle and did nothing this month. */
  | { type: "things/stood"; thing: Id<"thing">; amount: number };
