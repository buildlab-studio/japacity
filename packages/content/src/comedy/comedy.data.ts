// Joke versions of common, neutral report lines (idea file 11, comedy row 1 cut
// down, and the decision P12). The plain line keeps its own key and is
// version 1; the jokes are `<key>.v2` up to `<key>.v5` in comedy.text.ts. A line
// not listed here has only its plain version.

/** How many versions each line has, the plain one included: three to five. */
export const versionedLines: Record<string, number> = {
  "line.activity.salary": 4,
  "line.activity.job-started": 4,
  "line.activity.rested": 4,
  "line.activity.played": 3,
  "line.wallet.upkeep": 4,
  "line.wallet.bank-charge": 4,
  "line.wallet.social": 3,
  "line.wallet.converted": 3,
  "line.wallet.gift": 4,
  "line.document.requested": 4,
  "line.document.issued": 3,
  "line.news.delivered": 4,
};

/** Lines about the cost of living: the simulation marks money going out as bad, but paying for life is not bad news. */
export const spendingLines: readonly string[] = ["line.wallet.upkeep", "line.wallet.bank-charge", "line.wallet.social"];

/** The fewest and most versions a joke line has, the plain one included. */
export const VERSIONS = { min: 3, max: 5 } as const;
