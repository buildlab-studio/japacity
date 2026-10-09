// What the room's basics take off this month's living costs, said at the tap (docs/rules/world.md
// R-WORLD-005, R-WORLD-029; obligation.md R-OBLIGATION-014): the share each
// takes of the upkeep where the character lives, read from the view as the simulation will charge it.
import { content } from "@japacity/content";
import type { MoneyParam, PlayerView } from "@japacity/sim";
import { int } from "@japacity/sim";

type Seen = Pick<PlayerView, "obligations" | "place">;

/** The share an activity takes off the upkeep, in basis points, from its own `obligation/relief` effect. 0 when it has none. */
function reliefBp(activity: string): number {
  const entry = (content.activity as Record<string, (typeof content.activity)[keyof typeof content.activity] | undefined>)[activity];
  return (entry?.effects ?? []).reduce((sum, effect) => (effect.type === "obligation/relief" && effect.obligationType === "upkeep" ? sum + effect.bp : sum), 0);
}

/** The upkeep where the character lives now, as the relief finds it: open, not defaulted, and for this place. */
function upkeepHere(view: Seen): Seen["obligations"][number] | null {
  return (
    view.obligations.find((owed) => {
      const entry = content.obligation[owed.entry];
      if (entry?.type !== "upkeep" || owed.state === "defaulted") return false;
      const where = entry.where ?? "home";
      if (where === "any") return true;
      if (where !== view.place.where) return false;
      const country = (entry as { country?: string | null }).country ?? null;
      return where !== "abroad" || country === null || country === view.place.country;
    }) ?? null
  );
}

/** What cooking or fetching water takes off this month's living costs, or null when nothing would come off. */
export function choreSaving(view: Seen, activity: string): MoneyParam | null {
  const share = reliefBp(activity);
  const owed = upkeepHere(view);
  if (share === 0 || owed === null || owed.due <= 0) return null;
  const amount = Math.min(owed.due, int.bp(owed.due, share));
  return amount <= 0 ? null : { currency: content.obligation[owed.entry]?.currency ?? "NGN", amount };
}
