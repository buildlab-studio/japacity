// What the boards need from the accounts: who is a guest (account.md
// R-ACCOUNT-022) and the display names friends see (city.md R-CITY-040).
// the account row on main has neither a guest state nor a display
// name (the accounts work adds both); until someone adds them here, no
// account is a guest and no display name is known, so friends see first names.

export interface BoardPorts {
  /** R-ACCOUNT-022: the guests among these accounts. */
  guests: (accounts: readonly string[]) => Promise<ReadonlySet<string>>;
  /** R-CITY-040: the display names of these accounts that have one. */
  displayNames: (accounts: readonly string[]) => Promise<ReadonlyMap<string, string>>;
}

export const STAND_IN_PORTS: BoardPorts = {
  guests: () => Promise.resolve(new Set()),
  displayNames: () => Promise.resolve(new Map()),
};
