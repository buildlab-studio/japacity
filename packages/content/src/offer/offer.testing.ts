// What the content tests share about offers.

/** The terms the effect that opens an offer hands over (offer:effect-opens-named-offer, activity:missed-hunt-opens-a-lead). */
export const HANDED_TERMS: Readonly<Record<string, readonly string[]>> = {
  "offer.job": ["job"],
  "offer.job-lead": ["job", "missed", "lead", "cost"],
  "offer.job-word": ["job", "lead"],
};
