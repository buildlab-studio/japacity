// R-ADVERT-015, R-ADVERT-016: the banned and restricted categories, row for row
// from docs/rules/adverts.md. The words screen a submission's text and link: a
// hit refuses it before a reviewer sees it. The reviewer still checks the rest.

/** Recorded on every review, so a decision can be read against the list it was made under (R-ADVERT-010). */
export const BANNED_LIST_VERSION = "2026-10-08";

export interface BannedCategory {
  key: string;
  /** Lower-case words and phrases, matched whole. */
  words: string[];
}

export interface RestrictedCategory {
  key: string;
  /** The checks a reviewer must record before a campaign in this category may be approved. */
  conditions: string[];
}

export const BANNED: readonly BannedCategory[] = [
  { key: "loans", words: ["loan", "loans", "payday", "salary advance", "quick cash", "proof of funds", "funds placement", "borrow"] },
  { key: "gambling", words: ["bet", "bets", "betting", "casino", "lottery", "jackpot", "sweepstake", "sweepstakes", "prediction market"] },
  { key: "schemes", words: ["crypto", "bitcoin", "forex", "trading signals", "double your money", "investment returns", "mlm", "get rich"] },
  { key: "visa-guarantees", words: ["guaranteed visa", "visa guaranteed", "visa guarantee", "arranged papers", "fake documents", "job abroad fee"] },
  { key: "alcohol-tobacco", words: ["beer", "whisky", "vodka", "alcohol", "cigarette", "cigarettes", "tobacco", "vape", "vaping", "nicotine", "shisha"] },
  { key: "medicines", words: ["cure", "cures", "herbal", "remedy", "weight loss", "slimming", "supplement", "supplements", "pills"] },
  { key: "dating", words: ["dating", "hookup", "escort", "sugar daddy", "sugar mummy", "adult"] },
  { key: "politics-religion", words: ["vote", "election", "candidate", "crusade", "church", "mosque"] },
  { key: "weapons-counterfeit", words: ["gun", "guns", "firearm", "ammunition", "counterfeit", "replica", "spyware", "hacking"] },
  { key: "other-games", words: ["game", "games", "gaming", "esports"] },
  { key: "impersonation", words: ["official notice", "bank alert", "credit alert", "debit alert", "transfer successful", "breaking news", "verify your account"] },
];

export const RESTRICTED: readonly RestrictedCategory[] = [
  { key: "immigration-advice", conditions: ["adviser-registered", "no-result-promise", "no-proof-of-funds"] },
  { key: "money-transfer", conditions: ["licensed-each-region", "no-credit-product"] },
  { key: "education", conditions: ["accredited-institution", "no-charging-agent", "no-score-or-visa-promise"] },
  { key: "travel", conditions: ["no-visa-claim"] },
  { key: "telco", conditions: ["no-prize-or-promo"] },
  { key: "named-place", conditions: ["place-agreement"] },
];

/** A category that is neither banned nor restricted. */
const GENERAL = "general";

export type CategoryKind = "banned" | "restricted" | "general" | "unknown";

export function categoryKind(key: string): CategoryKind {
  if (BANNED.some((category) => category.key === key)) return "banned";
  if (RESTRICTED.some((category) => category.key === key)) return "restricted";
  return key === GENERAL ? "general" : "unknown";
}

export function conditionsOf(key: string): string[] {
  return RESTRICTED.find((category) => category.key === key)?.conditions ?? [];
}

function escaped(phrase: string): string {
  return phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[\\s\\-_]+");
}

/** The banned categories whose words appear whole in any of the texts. */
export function bannedHits(...texts: string[]): string[] {
  const joined = texts.join("\n").toLowerCase();
  return BANNED.filter((category) => category.words.some((phrase) => new RegExp(`(^|[^a-z0-9])${escaped(phrase)}($|[^a-z0-9])`).test(joined))).map((category) => category.key);
}
