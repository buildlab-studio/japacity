import type { Id } from "../engine/types";

/** Placeholder: the credit agent defines the real events. */
export type CreditEvent = { type: "credit/marked"; country: Id<"country">; amount: number };
