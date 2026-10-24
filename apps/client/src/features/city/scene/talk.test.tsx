// The talk budget (docs/design/09-the-games-look.md section 5): at most three callouts over the scene, the
// bubble waiting behind the fan, the chip and the marker; and the emotes, pictures over two residents at a time.
import { describe, expect, test } from "vitest";

import { CALLOUTS_MAX, calloutsShown } from "../../../shared/world/callouts";
import { EMOTE_PICTURES, emotesFor, EMOTES_MAX } from "./emotes";

describe("the callout budget", () => {
  test("[world:street-talk-budget] given the fan, the chip, the marker and a bubble all wanting the screen, when the budget is read, then three show and the bubble waits; with fewer, all show", () => {
    expect(CALLOUTS_MAX).toBe(3);
    expect(calloutsShown({ fan: true, chip: true, marker: true, bubble: true })).toEqual({ fan: true, chip: true, marker: true, bubble: false });
    expect(calloutsShown({ fan: false, chip: true, marker: true, bubble: true })).toEqual({ fan: false, chip: true, marker: true, bubble: true });
    expect(calloutsShown({ fan: true, chip: false, marker: false, bubble: true })).toEqual({ fan: true, chip: false, marker: false, bubble: true });
    expect(calloutsShown({ fan: false, chip: false, marker: false, bubble: false })).toEqual({ fan: false, chip: false, marker: false, bubble: false });
  });
});

describe("the emotes", () => {
  const people = [
    { slot: 0, kind: "resident" as const, person: { role: "hawker" as const } },
    { slot: 1, kind: "player" as const, person: { role: "trader" as const } },
    { slot: 2, kind: "resident" as const, person: { role: "elder" as const } },
    { slot: 3, kind: "resident" as const, person: { role: "rider" as const } },
  ];

  test("[world:street-talk-budget] given a crowd, when its emotes are read, then at most two residents show a picture of what they do, never a player, and the pair moves on with each turn", () => {
    expect(EMOTES_MAX).toBe(2);
    const first = emotesFor(people, 0);
    expect(first).toHaveLength(2);
    expect(first.every((emote) => emote.slot !== 1)).toBe(true);
    for (const emote of first) {
      const role = people.find((person) => person.slot === emote.slot)?.person.role;
      expect(role === undefined ? [] : EMOTE_PICTURES[role]).toContain(emote.emoji);
    }
    expect(emotesFor(people, 1).map((emote) => emote.slot)).not.toEqual(first.map((emote) => emote.slot));
    expect(emotesFor([], 0)).toEqual([]);
  });
});
