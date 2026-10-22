// The first-use labels (world:no-walkthrough-before-play): nothing lectures before play. On a device that has not
// played, the Map and Phone thumbs carry their word until each is tapped once; the device keeps it under the
// `japacity.walkthrough` key, and a device whose key holds the played mark, or a life with a month behind it, shows none.
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { FIRST_THUMBS, walkSeen } from "../../shared/world/Walkthrough";
import { City } from "./City";
import { cityWords } from "./city.words";
import { WALK_KEY } from "../../shared/storage/storage";

const world = () => <City world results={(place) => <p data-results-for={place} />} />;

function labels(): string[] {
  return [...document.querySelectorAll<HTMLElement>("[data-first-label]")].map((label) => label.dataset["firstLabel"] ?? "");
}

/** Taps a thumb, and closes what it opened. */
function tapThumb(id: "map" | "phone"): void {
  fireEvent.click(document.querySelector<HTMLElement>(`[data-thumb='${id}']`)!);
  const close = screen.queryByRole("button", { name: cityWords("city.close") }) ?? screen.queryByRole("button", { name: say("ui.dismiss") });
  if (close !== null) fireEvent.click(close);
}

describe("the first-use labels", () => {
  test("[world:no-walkthrough-before-play] given the first play on a new device, when the world opens, then no pointer or card lectures, the first brief is handed by its person, and once it is carried the Map and Phone thumbs each carry their word, and each word goes once its thumb is tapped", async () => {
    localStorage.removeItem(WALK_KEY);
    await renderWithView(world(), engineView());
    expect(document.querySelector("[data-walkthrough], [data-walk-card]")).toBeNull();
    // The first chapter's brief is a person handing a mission over (design page 09 section 4), not a lecture: its card
    // stands over the foot, and the thumbs' words wait for it to be carried.
    expect(document.querySelector("[data-brief]")).not.toBeNull();
    expect(labels()).toEqual([]);
    fireEvent.click(document.querySelector<HTMLElement>("[data-brief-go]")!);
    expect(labels()).toEqual(["map", "phone"]);
    for (const thumb of FIRST_THUMBS) expect(document.querySelector(`[data-first-label='${thumb.id}']`)?.textContent).toBe(say(thumb.words));
    expect(say("ui.first.phone")).toBe("Chats, bank, news");
    expect(say("ui.first.map")).toBe("Go places");
    // Never a button: the thumbs are the only things to press at the foot of the world.
    expect(document.querySelector("[data-first-labels] button")).toBeNull();
    tapThumb("map");
    expect(document.querySelector("[data-thumb='map']")).not.toBeNull();
    expect(labels()).toEqual(["phone"]);
    expect(walkSeen()).toBe(false);
    tapThumb("phone");
    expect(labels()).toEqual([]);
    expect(walkSeen()).toBe(true);
  });

  test("[world:no-walkthrough-before-play] given a thumb tapped on this device, when another life is played, then only the other thumb carries its word, and once both were tapped no word shows again", async () => {
    localStorage.removeItem(WALK_KEY);
    await renderWithView(world(), engineView());
    tapThumb("phone");
    document.body.innerHTML = "";
    await renderWithView(world(), engineView("scenario.banker"));
    // The new life's first brief is carried first; its card stands over the thumbs until then.
    fireEvent.click(document.querySelector<HTMLElement>("[data-brief-go]")!);
    expect(labels()).toEqual(["map"]);
    tapThumb("map");
    document.body.innerHTML = "";
    await renderWithView(world(), engineView("scenario.nurse"));
    expect(labels()).toEqual([]);
  });

  test("[world:no-walkthrough-before-play] given the walkthrough seen on this device before, or a life with a month behind it on a new one, when the world opens, then no word shows", async () => {
    localStorage.setItem(WALK_KEY, "1");
    await renderWithView(world(), engineView());
    expect(labels()).toEqual([]);
    document.body.innerHTML = "";
    localStorage.removeItem(WALK_KEY);
    await renderWithView(world(), richView());
    expect(labels()).toEqual([]);
    expect(walkSeen()).toBe(true);
  });
});
