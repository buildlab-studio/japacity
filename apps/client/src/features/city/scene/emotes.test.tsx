// The emotes over the crowd (the talk budget, docs/design/09-the-games-look.md section 5): a picture over a head is a tap on that person.
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { Emotes, emotesFor } from "./emotes";

const people = [
  { slot: 0, kind: "player" as const, person: { role: "passer-by" as const } },
  { slot: 1, kind: "resident" as const, person: { role: "hawker" as const } },
  { slot: 2, kind: "resident" as const, person: { role: "elder" as const } },
];

describe("the emotes over the crowd", () => {
  test("[world:street-talk-budget] given residents, when a turn is drawn, then at most two residents carry a picture and the player none", () => {
    const drawn = emotesFor(people, 0);
    expect(drawn.length).toBe(2);
    expect(drawn.every((one) => one.slot !== 0)).toBe(true);
  });

  test("[world:street-talk-budget] [world:things-are-tappable-models] given a picture over a resident, when it is tapped, then the tap is that person's: the shell hears their slot", () => {
    const onTap = vi.fn();
    render(<Emotes people={people} hidden={false} onTap={onTap} />);
    const picture = document.querySelector<HTMLElement>("[data-emote-tap]");
    expect(picture).not.toBeNull();
    if (picture === null) return;
    fireEvent.click(picture);
    expect(onTap).toHaveBeenCalledWith(Number(picture.dataset.emoteTap));
  });
});
