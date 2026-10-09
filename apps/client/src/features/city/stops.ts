// Which stops the story has reached (docs/rules/world.md R-WORLD-015): a place tied to a chapter
// shows on the map as not yet until that chapter is current or done, so the first map holds the
// places that matter now. Abroad nothing is held back.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";

/** Stops the story opens with its chapter. A place not listed is open from the first month. */
export const OPENS_WITH: Record<string, Id<"chapter">> = {
  "place.english-test-centre": "chapter.build-the-file",
  "place.agent-office": "chapter.build-the-file",
  "place.olokun-office": "chapter.decision-day",
  "place.tb-clinic": "chapter.decision-day",
  "place.visa-centre": "chapter.decision-day",
  "place.airport-lagos": "chapter.send-off",
};

/**
 * True when the story has reached the place: no chapter ties it, or that chapter is current or done, or the character is abroad,
 * or the life's own first step is there (`early`: the nurse's clinic, prologue.md R-PROLOGUE-010).
 */
export function stopReached(chapter: PlayerView["chapter"], where: PlayerView["place"]["where"], place: string, early: readonly string[] = []): boolean {
  const opens = OPENS_WITH[place];
  if (opens === undefined || where !== "home" || early.includes(place)) return true;
  // A chapter standing in for a base by route (R-CHAPTER-009) opens the base's stops.
  const base = (id: string): string => content.chapter[id as Id<"chapter">]?.variantOf ?? id;
  return (chapter.current !== null && base(chapter.current) === opens) || chapter.done.some((done) => base(done) === opens);
}
