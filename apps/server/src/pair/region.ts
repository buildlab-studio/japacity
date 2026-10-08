// Who may meet whom (account.md R-ACCOUNT-009, R-ACCOUNT-010, region.md
// R-REGION-002, R-REGION-006, pair.md R-PAIR-018): each account's row, and a
// row whose age check is `verified` counts as `none` until the account passes it.
import type { AccountRow } from "@japacity/store";

import type { ServerDeps } from "../deps";
import type { Interaction } from "../region";
import { policyFor, stricter } from "../region";

/** R-ACCOUNT-010: the interaction an account may use where it signed up. A missing account may use none. */
export function interactionOf(deps: Pick<ServerDeps, "config">, account: AccountRow | null): Interaction {
  if (account === null) return "none";
  const policy = policyFor(deps.config.regions, account.country);
  if (policy.ageCheck === "verified" && account.age.method !== "verified") return "none";
  return policy.interaction;
}

/** R-ACCOUNT-009, R-REGION-006: where two accounts meet, the stricter interaction applies to both. */
export function meeting(deps: Pick<ServerDeps, "config">, x: AccountRow | null, y: AccountRow | null): Interaction {
  const policy = (interaction: Interaction) => ({ open: true, interaction, ageCheck: "declared" as const });
  return stricter(policy(interactionOf(deps, x)), policy(interactionOf(deps, y))).interaction;
}

/** The account that holds a character, read from its row. */
export async function accountOfCharacter(deps: ServerDeps, character: string): Promise<AccountRow | null> {
  if (character === "") return null;
  const held = await deps.stores.player.load(character);
  return held === null ? null : deps.stores.account.get(held.character.account);
}
