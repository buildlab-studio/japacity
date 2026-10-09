// Which stops the story has reached (docs/rules/world.md R-WORLD-015): a place tied to a chapter
// shows on the map as not yet until that chapter is current or done, so the first map holds the
// places that matter now. Abroad nothing is held back.
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

/** True when the story has reached the place: no chapter ties it, or that chapter is current or done, or the character is abroad. */
export function stopReached(chapter: PlayerView["chapter"], where: PlayerView["place"]["where"], place: string): boolean {
  const opens = OPENS_WITH[place];
  if (opens === undefined || where !== "home") return true;
  return chapter.current === opens || chapter.done.includes(opens);
}
