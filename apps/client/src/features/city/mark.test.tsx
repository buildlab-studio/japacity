// Labels on tap and a quiet mark for what is interactive (docs/rules/world.md R-WORLD-005, R-WORLD-021, R-WORLD-003;
// the maintainer): each thing shows a small still dot and no name; a tap on the dot is a tap on the thing;
// the nudge's thing pulses; a person shows their name only while they hold an ask or are the nudge's target; a place's
// first entry in a life shows every name, then they fade.
import { act, cleanup, render } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import parlourRaw from "../../../public/assets/places/home-family-house/place.json";
import { engineView } from "../../shared/testing/fixtures";
import { anchorFan } from "./fan/anchor";
import { Fan } from "./fan/Fan";
import { fanEntriesOf, fanModel } from "./fan/fanActs";
import { withMeetings } from "./meetings";
import { sceneWords } from "./scene.words";
import { isPerson, markNode, namedThings, showMark } from "./mark";
import { type PlaceFile, stageOf } from "./placeFile";

const things = stageOf(parlourRaw as unknown as PlaceFile).things ?? [];

function thingOf(id: string) {
  const thing = things.find((candidate) => candidate.id === id);
  if (thing === undefined) throw new Error(`No ${id}`);
  return thing;
}

describe("a thing's mark", () => {
  test("[R-WORLD-005] [R-WORLD-021] given a thing, when its mark is built, then it is a small dot with its name for a screen reader only, and a tap on it is a tap on the thing", () => {
    let tapped = 0;
    const node = markNode(thingOf("mattress"), () => (tapped += 1));
    showMark(node, { named: false, teaching: false, pulse: false });
    expect(node.dataset["thingMark"]).toBe("mattress");
    expect(node.getAttribute("aria-label")).toBe(sceneWords("city.thing.mattress"));
    expect(node.querySelector("[data-mark-dot]")?.className).toBe("mark-dot");
    expect(node.querySelector<HTMLElement>("[data-mark-name]")?.hidden).toBe(true);
    expect(node.hasAttribute("data-named")).toBe(false);
    node.click();
    expect(tapped).toBe(1);
  });

  test("[R-WORLD-005] [R-WORLD-003] given the nudge pointing at a thing, when its mark shows, then its dot pulses and no other does", () => {
    const pointed = markNode(thingOf("cooking"), () => undefined);
    const other = markNode(thingOf("drum"), () => undefined);
    showMark(pointed, { named: false, teaching: false, pulse: true });
    showMark(other, { named: false, teaching: false, pulse: false });
    expect(pointed.querySelector("[data-mark-dot]")?.classList.contains("mark-pulse")).toBe(true);
    expect(other.querySelector("[data-mark-dot]")?.classList.contains("mark-pulse")).toBe(false);
  });

  test("[R-WORLD-005] given a place's first entry in a life, when the marks teach, then every name shows and fades; named, it stays with its state beside it", () => {
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

  test("[R-WORLD-005] given the parlour, when the names are read, then Mama and Papa are people and a person keeps a name only while holding an ask or as the nudge's target", () => {
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
  test("[R-PEOPLE-054] [R-WORLD-005] given Tobi standing in the parlour, when his mark is built, then no name floats over him until a tap or a place's first entry, and then his name carries the computer tag, on his fan as on his mark", () => {
    const [tobi] = withMeetings(things, "place.family-house", [{ thing: "after-service", person: "person.tobi-bank" }]).filter((thing) => thing.id === "after-service");
    expect(tobi?.mark).toBe("computer");
    const node = markNode(tobi!, () => undefined);
    showMark(node, { named: false, teaching: false, pulse: false });
    const name = node.querySelector<HTMLElement>("[data-mark-name]");
    expect(name?.hidden).toBe(true);
    showMark(node, { named: false, teaching: true, pulse: false });
    expect(name?.hidden).toBe(false);
    expect(name?.textContent).toContain("Tobi");
    expect(name?.querySelector("[data-person-mark]")?.textContent).toBe(sceneWords("ui.people.mark.computer"));
    // His fan, which a tap opens since the chip went (R-WORLD-034), carries the same tag beside his name.
    render(<Fan thing={tobi!.id} title={sceneWords(tobi!.label)} mark={tobi!.mark} entries={fanModel(fanEntriesOf(tobi!), engineView("scenario.ada"), [])} onAct={vi.fn()} onFallback={vi.fn()} />);
    act(() => anchorFan(tobi!.id, { x: 90, y: 420 }));
    const title = document.querySelector(`[data-fan="${tobi!.id}"] [data-fan-title]`);
    expect(title?.textContent).toContain("Tobi");
    expect(title?.querySelector("[data-person-mark]")?.textContent).toBe(sceneWords("ui.people.mark.computer"));
    cleanup();
  });
});
