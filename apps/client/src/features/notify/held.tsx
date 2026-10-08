// What asks something of the player waits for the early win (docs/rules/guides.md
// R-GUIDE-015): the shell mounts an ask inside one of these, and it shows only
// once the store's `earlyWin` flag is up.
import { useEffect, type ReactNode } from "react";

import { useGame, useView } from "../../authority/GameProvider";
import { cardKey } from "../../shared/ui/stage";

/** True once the early win has been shown in this tab. */
export function useEarlyWin(): boolean {
  return useGame((state) => state.earlyWin);
}

/** Its children only after the early win; nothing before it. */
export function AfterEarlyWin({ children }: { children: ReactNode }) {
  return useEarlyWin() ? children : null;
}

/**
 * The share card and its button, held back until the early win. A card due
 * before it is put aside as closed, so a scene staged after the card does not
 * wait on a card that cannot show; after the win its tile opens it as usual.
 */
export function HeldShareCard({ children }: { children: ReactNode }) {
  const won = useEarlyWin();
  const key = cardKey(useView().card);
  const closeCard = useGame((state) => state.closeCard);
  useEffect(() => {
    if (!won && key !== null) closeCard(key);
  }, [won, key, closeCard]);
  return won ? children : null;
}
