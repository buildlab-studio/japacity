// The order full-screen things take after a month ends: the staged wins first,
// then the month's report with its moment card over it (docs/rules/moments.md), then the share card, then a scene such as the
// December visit. Each waits for the one before it, so two never cover each
// other and a click always lands on the one in front.
import { useGame, useView } from "../../authority/GameProvider";
import { cardKey } from "./cardKey";

export { cardKey } from "./cardKey";

/** True when no staged win or moment card is on screen and the report is closed: the card may open (R-MOMENT-006). */
export function useCardsTurn(): boolean {
  const moments = useGame((state) => state.moments.length);
  const momentCards = useGame((state) => state.momentCards.length);
  const reportOpen = useGame((state) => state.reportOpen);
  return moments === 0 && momentCards === 0 && !reportOpen;
}

/** True when the card before it has had its turn too: a scene may open. */
export function useScenesTurn(): boolean {
  const cardsTurn = useCardsTurn();
  const cardClosed = useGame((state) => state.cardClosed);
  const key = cardKey(useView().card);
  return cardsTurn && (key === null || cardClosed === key);
}
