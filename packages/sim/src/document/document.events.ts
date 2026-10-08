import type { Id } from "../engine/types";

export type DocumentEvent =
  /** A copy was asked for and is due in `readyMonth`. A held copy stays in force meanwhile (R-DOCUMENT-004). */
  | { type: "document/requested"; document: Id<"document">; readyMonth: number }
  /**
   * A request found a copy already being made. It changes nothing; it exists
   * so the report can say the request went nowhere (R-DOCUMENT-004).
   */
  | { type: "document/already-pending"; document: Id<"document">; readyMonth: number }
  /**
   * A copy was issued, by the papers phase or by a grant, and replaces whatever was there.
   * `genuine: false` only when it replaces a fake already used in an application, whose mark stays (R-ADVICE-008).
   */
  | { type: "document/issued"; document: Id<"document">; expiresMonth: number | null; value: number | null; genuine?: false }
  /** Fake papers from a scammer, held from now and never genuine (R-ADVICE-008). */
  | { type: "document/faked"; document: Id<"document">; expiresMonth: number | null }
  /** A fixer brought the copy being made forward: it is now due in `readyMonth` (R-ADVICE-005). */
  | { type: "document/hastened"; document: Id<"document">; readyMonth: number; was: number }
  /** The held copy's expiry month came. */
  | { type: "document/expired"; document: Id<"document"> }
  /** The document was removed, held or pending. */
  | { type: "document/voided"; document: Id<"document"> };
