import type { InviteRow, InviteStore, RewardRow } from "../pair.types";
import { compareIds } from "../keys";
import { accept, copy, refuse } from "./copy.memory";

function namesCharacter(row: InviteRow, character: string): boolean {
  return row.from === character || row.by === character;
}

function distinctKeys(rows: readonly InviteRow[]): string[] {
  return [...new Set(rows.flatMap((row) => (row.pair === null ? [] : [row.pair])))].sort(compareIds);
}

/** R-PAIR-007 to 009: links in the order they were made, and the rewards given. */
export function memoryInviteStore(): InviteStore {
  let invites: InviteRow[] = [];
  let rewards: RewardRow[] = [];
  const find = (code: string) => invites.find((row) => row.code === code);

  return {
    create: (invite) => {
      if (find(invite.code) !== undefined) return Promise.resolve(refuse("exists", `The link ${invite.code} exists already.`));
      const row: InviteRow = { ...copy(invite), used: false, by: null, pair: null, usedAt: null, before: [] };
      invites.push(row);
      return Promise.resolve(accept(row));
    },
    get: (code) => Promise.resolve(copy(find(code) ?? null)),
    open: (from, now) => Promise.resolve(copy(invites.filter((row) => row.from === from && !row.used && row.expires > now).sort((x, y) => x.madeAt - y.madeAt))),
    use: (code, use) => {
      const row = find(code);
      if (row === undefined) return Promise.resolve(refuse("missing", `No link ${code}.`));
      if (row.used) return Promise.resolve(refuse("closed", `The link ${code} is used.`));
      Object.assign(row, { used: true, by: use.by, pair: use.pair, usedAt: use.at, before: [...use.before] });
      return Promise.resolve(accept(row));
    },
    release: (code) => {
      const row = find(code);
      if (row === undefined || !row.used) return Promise.resolve(refuse("missing", `No used link ${code}.`));
      Object.assign(row, { used: false, by: null, pair: null, usedAt: null, before: [] });
      return Promise.resolve(accept(row));
    },
    pairsOf: (character) => Promise.resolve(distinctKeys(invites.filter((row) => row.used && namesCharacter(row, character)))),
    pairs: () => Promise.resolve(distinctKeys(invites.filter((row) => row.used))),
    linkedBy: (friend) => Promise.resolve(copy(invites.filter((row) => row.used && row.by === friend).sort((x, y) => (x.usedAt ?? 0) - (y.usedAt ?? 0)))),
    rewards: (from) => Promise.resolve(copy(rewards.filter((row) => row.from === from))),
    reward: (row) => {
      if (rewards.some((given) => given.from === row.from && given.friend === row.friend && given.reached === row.reached)) {
        return Promise.resolve(refuse("exists", `${row.from} has had ${row.friend}'s ${row.reached} already.`));
      }
      rewards.push(copy(row));
      return Promise.resolve(accept(row));
    },
    remove: (character) => {
      invites = invites.filter((row) => !namesCharacter(row, character));
      rewards = rewards.filter((row) => row.from !== character && row.friend !== character);
      return Promise.resolve();
    },
  };
}
