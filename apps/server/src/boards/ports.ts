// What the boards need from the accounts: who is a guest (account.md
// R-ACCOUNT-022, read from the account's own state, so a guest is on no board
// and reads none) and the display names friends see (city.md R-CITY-040).
// the account holds no display name apart from its username
// (R-ACCOUNT-001), so none is known here and friends see first names, as the
// friends board did before; the maintainer decides whether friends see the username.
import type { ServerDeps } from "../deps";

export interface BoardPorts {
  /** R-ACCOUNT-022: the guests among these accounts. */
  guests: (accounts: readonly string[]) => Promise<ReadonlySet<string>>;
  /** R-CITY-040: the display names of these accounts that have one. */
  displayNames: (accounts: readonly string[]) => Promise<ReadonlyMap<string, string>>;
}

/** R-ACCOUNT-022, R-CITY-040: the ports as production reads them, from the account store. An unknown account is no guest. */
export function accountPorts(deps: Pick<ServerDeps, "stores">): BoardPorts {
  return {
    guests: async (accounts) => {
      const rows = await Promise.all([...new Set(accounts)].map((account) => deps.stores.account.get(account)));
      return new Set(rows.flatMap((row) => (row?.state === "guest" ? [row.id] : [])));
    },
    displayNames: () => Promise.resolve(new Map()),
  };
}
