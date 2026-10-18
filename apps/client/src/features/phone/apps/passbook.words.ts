// The passbook's words (the Bank's first page; docs/rules/wallet.md R-WALLET-021), in the voice of
// docs/rules/text.md: a title of a few words, one line in a person's voice, money in naira, months as a count of months.
// Never a day count, a percentage, slots, turns or pages. The words are content's ui/ui.passbook.text.ts.
import { formatMoney, formatNumber } from "../../../shared/words/format";
import { hasWords, say, type Params } from "../../../shared/words/text";

/** Words for a passbook key. */
export function passbookWords(key: string, params: Params = {}): string {
  return say(key, params);
}

/** A count's own words where the drafts have them (`.one`, `.zero`), else the plain key. */
export function passbookCount(key: string, count: number, params: Params = {}): string {
  const exact = count === 1 ? `${key}.one` : count === 0 ? `${key}.zero` : null;
  return passbookWords(exact !== null && hasWords(exact) ? exact : key, { ...params, months: count });
}

/** Naira in the short way people say a big sum: "₦11m", "₦2.5m", "₦850,000" under a million. Rounded down, never up past what is held. */
export function shortNaira(kobo: number): string {
  const naira = Math.floor(kobo / 100);
  if (naira < 1_000_000) return formatMoney(kobo, "NGN");
  const tenths = Math.floor(naira / 100_000);
  const whole = Math.floor(tenths / 10);
  const rest = tenths % 10;
  return `₦${formatNumber(whole)}${rest === 0 ? "" : `.${String(rest)}`}m`;
}
