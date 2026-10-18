// The share cards' kinds and the official accounts: docs/rules/share.md.
import type { Id, PlayerView } from "@japacity/sim";
import type { Proof, Same } from "@japacity/sim/schemas";

export type ShareKind = NonNullable<PlayerView["card"]>["kind"];

/** Every moment a card is made for, in the order the page lists them (share:cards-due-at-set-moments), then the ending. */
export const shareKinds = ["chapter", "granted", "send-off", "first-pay-abroad", "secured", "december", "draw-win", "real-story", "lost"] as const;

/** Fails to compile if the view gains or loses a card kind without this list following. */
export type ShareKindsListed = Proof<Same<(typeof shareKinds)[number], ShareKind>>;

/** The chapters a `chapter` card may name, each with its own art key (`share.chapter.<slug>.art`). */
export const shareChapters: readonly Id<"chapter">[] = [
  "chapter.find-your-feet",
  "chapter.build-the-file",
  "chapter.decision-day",
  // chapter:chapters-follow-lean-route: the variants of the file and decision day, in content's order.
  "chapter.build-the-file-care",
  "chapter.build-the-file-talent",
  "chapter.build-the-file-points",
  "chapter.build-the-file-gulf",
  "chapter.decision-day-care",
  "chapter.decision-day-talent",
  "chapter.decision-day-points",
  "chapter.decision-day-gulf",
  "chapter.send-off",
  "chapter.landing",
  "chapter.secure",
];

/**
 * The japa types (decision 0024), in the decision's order: a label read from the life at the send-off,
 * never a number. The client reads which one (apps/client/src/shared/words/japaType.ts); the words are
 * `share.type.<type>.name` and `share.type.<type>.line`.
 */
export const japaTypes = ["careful-saver", "hustler", "night-reader", "family-anchor", "gambler", "long-way-round"] as const;

export type JapaType = (typeof japaTypes)[number];

export type OfficialPlatform = "web" | "email" | "whatsapp" | "instagram" | "tiktok" | "x" | "youtube" | "facebook" | "repository";

/**
 * One row per account in the page's entries table (share:official-accounts-page). An address
 * is filled once the game holds it; the page lists only those.
 */
export interface OfficialAccount {
  platform: OfficialPlatform;
  /** Shown as written, and linked: a domain, an email address or a profile address. */
  address: string | null;
  /** For the web domain: the misspellings the game holds that point to it. */
  aliases: readonly string[];
}

export const officialAccounts: readonly OfficialAccount[] = [
  // The game's one address. japacity.com redirects to it, so it is not listed as a second address.
  { platform: "web", address: "japacity.app", aliases: [] },
  // The product email: it receives only; the game's own mail will send from a subdomain.
  { platform: "email", address: "social@japacity.app", aliases: [] },
  { platform: "whatsapp", address: null, aliases: [] },
  { platform: "instagram", address: null, aliases: [] },
  { platform: "tiktok", address: null, aliases: [] },
  { platform: "x", address: null, aliases: [] },
  { platform: "youtube", address: null, aliases: [] },
  { platform: "facebook", address: null, aliases: [] },
  // The repository's address is the git remote the code is kept in.
  { platform: "repository", address: "github.com/buildlab-studio/japacity", aliases: [] },
];
