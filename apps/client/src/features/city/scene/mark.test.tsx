// Labels on tap and a quiet mark for what is interactive (world:things-are-tappable-models, world:colours-are-role-tokens, world:nudge-says-one-thing):
// each thing shows a small still dot and no name; a tap on the dot is a tap on the thing;
// the nudge's thing pulses; a person shows their name only while they hold an ask or are the nudge's target; a place's
// first entry in a life shows every name, then they fade.
import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import parlourRaw from "../../../../public/assets/places/home-family-house/place.json";
import { engineView } from "../../../shared/testing/fixtures";
import { anchorFan } from "../fan/anchor";
import { Fan } from "../fan/Fan";
import { fanEntriesOf, fanModel } from "../fan/fanActs";
import { withMeetings } from "../meetings";
import { isPerson, markNode, namedThings, showMark } from "./mark";
import { type PlaceFile, stageOf } from "../../../shared/scene/placeFile";
import { cityWords } from "../city.words";
import { thingIn } from "../../../shared/testing/things";

const things = stageOf(parlourRaw as unknown as PlaceFile).things ?? [];

function thingOf(id: string) {
  return thingIn(things, id);
}

describe("a thing's mark", () => {
  test("[world:things-are-tappable-models] [world:colours-are-role-tokens] given a thing, when its mark is built, then it is a small dot with its name for a screen reader only, and a tap on it is a tap on the thing", () => {
    let tapped = 0;
    const node = markNode(thingOf("mattress"), () => (tapped += 1));
    showMark(node, { named: false, teaching: false, pulse: false });
    expect(node.dataset["thingMark"]).toBe("mattress");
    expect(node.getAttribute("aria-label")).toBe(cityWords("city.thing.mattress"));
    expect(node.querySelector("[data-mark-dot]")?.className).toBe("mark-dot");
    expect(node.querySelector<HTMLElement>("[data-mark-name]")?.hidden).toBe(true);
    expect(node.hasAttribute("data-named")).toBe(false);
    node.click();
    expect(tapped).toBe(1);
  });

  test("[world:things-are-tappable-models] [world:nudge-says-one-thing] given the nudge pointing at a thing, when its mark shows, then its dot pulses and no other does", () => {
    const pointed = markNode(thingOf("cooking"), () => undefined);
    const other = markNode(thingOf("drum"), () => undefined);
    showMark(pointed, { named: false, teaching: false, pulse: true });
    showMark(other, { named: false, teaching: false, pulse: false });
    expect(pointed.querySelector("[data-mark-dot]")?.classList.contains("mark-pulse")).toBe(true);
    expect(other.querySelector("[data-mark-dot]")?.classList.contains("mark-pulse")).toBe(false);
  });

  test("[world:things-are-tappable-models] given a place's first entry in a life, when the marks teach, then every name shows and fades; named, it stays with its state beside it", () => {
    const node = markNode(thingOf("mama"), () => undefined);
    showMark(node, { named: false, teaching: true, pulse: false });
    const name = node.querySelector<HTMLElement>("[data-mark-name]");
    expect(name?.hidden).toBe(false);
    expect(name?.classList.contains("mark-teach")).toBe(true);
    showMark(node, { named: true, teaching: false, pulse: false, state: "Ongoing" });
    expect(name?.hidden).toBe(false);
    expect(name?.classList.contains("mark-teach")).toBe(false);
    expect(node.querySelector<HTMLElement>("[data-thing-state]")?.textContent).toBe("Ongoing");
    showMark(node, { named: false, teaching: false, pulse: false });
    expect(name?.hidden).toBe(true);
  });

  test("[world:things-are-tappable-models] given the parlour, when the names are read, then Mama and Papa are people and a person keeps a name only while holding an ask or as the nudge's target", () => {
    expect(isPerson(thingOf("mama"))).toBe(true);
    expect(isPerson(thingOf("papa"))).toBe(true);
    expect(isPerson(thingOf("mattress"))).toBe(false);
    // The light bill open: Mama holds an ask; Papa's roof is not open, so his acts carry no ask.
    const now = [{ ...thingOf("mama"), acts: thingOf("mama").acts }, { ...thingOf("papa"), acts: thingOf("papa").acts.filter((act) => act.stages !== "offer.roof") }, thingOf("mattress")];
    expect(namedThings(now, null)).toEqual(["mama"]);
    const quiet = now.map((thing) => ({ ...thing, acts: thing.acts.filter((act) => act.stages?.startsWith("offer.") !== true) }));
    expect(namedThings(quiet, null)).toEqual([]);
    expect(namedThings(quiet, "papa")).toEqual(["papa"]);
    // A thing the nudge points at pulses, but keeps no name: only people are named.
    expect(namedThings(quiet, "mattress")).toEqual([]);
  });
});

describe("a person met in a place", () => {
  test("[person:computer-mark-is-quiet] [world:things-are-tappable-models] given Tobi standing in the parlour, when his mark is built, then no name floats over him until a tap or a place's first entry, and then his name carries the computer tag, on his fan as on his mark", () => {
    const [tobi] = withMeetings(things, "place.family-house", [{ thing: "after-service", person: "person.tobi-bank" }]).filter((thing) => thing.id === "after-service");
    expect(tobi?.mark).toBe("computer");
    const node = markNode(tobi!, () => undefined);
    showMark(node, { named: false, teaching: false, pulse: false });
    const name = node.querySelector<HTMLElement>("[data-mark-name]");
    expect(name?.hidden).toBe(true);
    showMark(node, { named: false, teaching: true, pulse: false });
    expect(name?.hidden).toBe(false);
    expect(name?.textContent).toContain("Tobi");
    expect(name?.querySelector("[data-person-mark]")?.textContent).toBe(cityWords("ui.people.mark.computer"));
    // His fan, which a tap opens (world:fan-of-sticker-buttons), carries the same tag beside his name.
    render(<Fan thing={tobi!.id} title={cityWords(tobi!.label)} mark={tobi!.mark} entries={fanModel(fanEntriesOf(tobi!), engineView("scenario.ada"), [])} onAct={vi.fn()} onFallback={vi.fn()} />);
    act(() => anchorFan(tobi!.id, { x: 90, y: 420 }));
    const title = document.querySelector(`[data-fan="${tobi!.id}"] [data-fan-title]`);
    expect(title?.textContent).toContain("Tobi");
    expect(title?.querySelector("[data-person-mark]")?.textContent).toBe(cityWords("ui.people.mark.computer"));
    cleanup();
  });
});
