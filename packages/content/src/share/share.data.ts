// The share cards' kinds and the official accounts: docs/rules/share.md.
import type { Id, PlayerView } from "@japacity/sim";
import type { Proof, Same } from "@japacity/sim/schemas";

export type ShareKind = NonNullable<PlayerView["card"]>["kind"];

/** Every moment a card is made for, in the order the page lists them (R-SHARE-001), then the ending. */
export const shareKinds = ["chapter", "granted", "send-off", "first-pay-abroad", "secured", "december", "draw-win", "real-story", "lost"] as const;

/** Fails to compile if the view gains or loses a card kind without this list following. */
export type ShareKindsListed = Proof<Same<(typeof shareKinds)[number], ShareKind>>;

/** The chapters a `chapter` card may name, each with its own art key (`share.chapter.<slug>.art`). */
export const shareChapters: readonly Id<"chapter">[] = [
  "chapter.find-your-feet",
  "chapter.build-the-file",
  "chapter.decision-day",
  // R-CHAPTER-009: the variants of the file and decision day, in content's order.
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

export type OfficialPlatform = "web" | "email" | "whatsapp" | "instagram" | "tiktok" | "x" | "youtube" | "facebook" | "repository";

/**
 * One row per account in the page's entries table (R-SHARE-012). An address
 * is filled once the maintainer has claimed it; the page lists only those.
 */
export interface OfficialAccount {
  platform: OfficialPlatform;
  /** Shown as written, and linked: a domain, an email address or a profile address. */
  address: string | null;
  /** For the web domain: the misspellings the maintainer holds that point to it. */
  aliases: readonly string[];
}

export const officialAccounts: readonly OfficialAccount[] = [
  { platform: "web", address: "japacity.com", aliases: [] },
  // the support mailbox is the maintainer's to open (docs/legal/04-terms-draft.md says "[Owner: support email]"); this is the address on the game's own domain the page assumes.
  { platform: "email", address: "support@japacity.com", aliases: [] },
  { platform: "whatsapp", address: null, aliases: [] },
  { platform: "instagram", address: null, aliases: [] },
  { platform: "tiktok", address: null, aliases: [] },
  { platform: "x", address: null, aliases: [] },
  { platform: "youtube", address: null, aliases: [] },
  { platform: "facebook", address: null, aliases: [] },
  // the repository is the current remote; the maintainer confirms it is the public home before launch.
  { platform: "repository", address: "github.com/buildlab-studio/japacity", aliases: [] },
];
