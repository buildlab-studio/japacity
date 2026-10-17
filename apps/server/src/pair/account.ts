// The account behind a character, for the people routes.
import type { AccountRow } from "@japacity/store";

import type { ServerDeps } from "../deps";

/** The account that holds a character, read from its row. */
export async function accountOfCharacter(deps: ServerDeps, character: string): Promise<AccountRow | null> {
  if (character === "") return null;
  const held = await deps.stores.player.load(character);
  return held === null ? null : deps.stores.account.get(held.character.account);
}
