// What the boards need from the accounts: who is a guest (account.md
// account:social-needs-secured-account, read from the account's own state, so a guest is on no board
// and reads none). Every board names a line by the account's username, read
// from the account store (city:board-line-and-ranking).
import type { ServerDeps } from "../deps";

export interface BoardPorts {
  /** account:social-needs-secured-account: the guests among these accounts. */
  guests: (accounts: readonly string[]) => Promise<ReadonlySet<string>>;
}

/** account:social-needs-secured-account: the ports as production reads them, from the account store. An unknown account is no guest. */
export function accountPorts(deps: Pick<ServerDeps, "stores">): BoardPorts {
  return {
    guests: async (accounts) => {
      const rows = await Promise.all([...new Set(accounts)].map((account) => deps.stores.account.get(account)));
      return new Set(rows.flatMap((row) => (row?.state === "guest" ? [row.id] : [])));
    },
  };
}
