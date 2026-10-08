// Real names shown as neutral scenery on a place's signs: docs/rules/city.md R-CITY-022 as
// amended and R-CITY-041 (the decision P17). One entry per real name, so removing one
// on request is one change: set its `realName` to null and the sign shows its plain words.

/** What a real name stands for. Only `public`, `market`, `mall` and `food` may carry one (R-CITY-041). */
export type RealNameTrade = "public" | "market" | "mall" | "food" | "bank" | "lender" | "agent" | "employer" | "sponsor" | "school" | "airline";

export interface RealNameEntry {
  /** The sign that shows it, `place.<slug>.sign.<n>`. */
  sign: string;
  trade: RealNameTrade;
  /** The name as plain words. Null: switched off, and the sign shows `plain`. */
  realName: string | null;
  /** The sign's words with the name in them. */
  words: string;
  /** The sign's words without it. */
  plain: string;
  /** Where it was read that the name is well known. */
  source: { title: string; url: string; readOn: string };
}

const READ_ON = "2026-10-09";

export const realNames: Record<string, RealNameEntry> = {
  // The market's own public name (R-CITY-005), on the third block's last board.
  "place.tejuosho-market.sign.12": {
    sign: "place.tejuosho-market.sign.12",
    trade: "public",
    realName: "Tejuosho Market",
    words: "WELCOME TO\nTEJUOSHO MARKET",
    plain: "MARKET OFFICE\nUPSTAIRS",
    source: { title: "Wikipedia: Tejuosho Market", url: "https://en.wikipedia.org/wiki/Tejuosho_Market", readOn: READ_ON },
  },
  // The gold market of Deira by the creek, a public souk of several hundred traders.
  "place.deira.sign.2": {
    sign: "place.deira.sign.2",
    trade: "market",
    realName: "Deira Gold Souk",
    words: "DEIRA GOLD SOUK",
    plain: "GOLD & DIAMONDS",
    source: { title: "Wikipedia: Dubai Gold Souk", url: "https://en.wikipedia.org/wiki/Dubai_Gold_Souk", readOn: READ_ON },
  },
  // The spice market beside it, at the Old Souk abra station.
  "place.deira.sign.6": {
    sign: "place.deira.sign.6",
    trade: "market",
    realName: "Spice Souk",
    words: "SPICE SOUK\nSPICES, DRY FRUITS",
    plain: "SPICES\nAND DRY FRUITS",
    source: { title: "Wikipedia: Dubai Spice Souk", url: "https://en.wikipedia.org/wiki/Dubai_Spice_Souk", readOn: READ_ON },
  },
};

/** What each sign of the register shows: its words while the name is on, its plain words once it is off. */
export function realNameSigns(register: Readonly<Record<string, RealNameEntry>>): Record<string, string> {
  return Object.fromEntries(Object.values(register).map((entry) => [entry.sign, entry.realName === null ? entry.plain : entry.words]));
}
