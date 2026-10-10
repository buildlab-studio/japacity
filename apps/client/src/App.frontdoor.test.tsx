// The front door in the app, on the real content (prologue.md R-PROLOGUE-009, 010): a person built over the family
// compound from a look, a typed name with three from the pool and an archetype, never a named life picked; the preset
// played for the archetype and only its open cards shown; the handover saying who the person is; the
// look kept beside the save and drawn by the city and the rides.
import { content, namePool, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { savedCommands } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "./authority/boot";
import { SAVE_KEY } from "./authority/local";
import { PERSON_KEY, readPerson } from "./authority/person";
import type { GameStore } from "./authority/store";
import { countInto } from "./shared/analytics/start";
import { type CounterRow, makeCounters } from "./shared/analytics/counters";
import { say, words } from "./shared/words/text";
import { ownFile } from "./features/city/City";
import { ROSTER } from "./features/city/roster";
import { ownLook } from "./features/map/Ride";
import { answersInOrder, ARCHETYPES, archetypeOf, FULL_PROLOGUE_KEY } from "./shared/frontdoor/archetypes";
import { nameAndBegin, startArchetype, startReadyLife, toTheArchetypes } from "./shared/frontdoor/frontDoor.testing";
import { LOOKS, namesFor, NAMES_SHOWN } from "./shared/frontdoor/looks";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";

const FIXED = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** Every starting life's person's name, first names included: none may be offered at the door. */
const NAMED = FIXED.flatMap((id) => (text[`${id}.name`] ?? "").split(/[\s,"]+/).filter((word) => word.length > 2));

function memoryStorage() {
  const items = new Map<string, string>();
  return { getItem: (key: string) => items.get(key) ?? null, setItem: (key: string, value: string) => void items.set(key, value) };
}

function seeds(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `front-door-${String(next)}`;
  };
}

function door(): { store: GameStore; storage: ReturnType<typeof memoryStorage> } {
  const storage = memoryStorage();
  const store = bootGame({ storage, fastClock: true, makeSeed: seeds() });
  render(<App store={store} />);
  return { store, storage };
}

function sheet(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-gate-sheet]");
  if (found === null) throw new Error("No sheet over the gate.");
  return found;
}

function sexOfName(name: string): Set<string> {
  const entries = namePool.filter((entry) => text[`person.name.${String(entry.n)}`] === name);
  return new Set(entries.map((entry) => entry.sex));
}

let rows: CounterRow[] = [];
let restore: () => void = () => undefined;

beforeEach(() => {
  rows = [];
  const counters = makeCounters({ send: (body) => rows.push(...(JSON.parse(body) as { rows: CounterRow[] }).rows) });
  const undo = countInto(counters);
  restore = () => {
    counters.flush();
    undo();
  };
});

afterEach(() => {
  restore();
  localStorage.clear();
});

describe("the front door", () => {
  test("[R-PROLOGUE-009] given no save, when the game opens, then the family compound stands under a sheet that asks who you are, with the look strip in two rows of the city's passers-by, the name typed on a screen of its own under three names, and no named life anywhere", async () => {
    door();
    expect(await screen.findByRole("heading", { name: say("ui.life.title") }, { timeout: 10_000 })).toBeDefined();
    // Never a bare page: the compound is under every sheet of the door.
    expect(document.querySelector("[data-gate] [data-front-scene]")).not.toBeNull();
    const looks = within(screen.getByRole("radiogroup", { name: say("ui.door.look") })).getAllByRole("radio");
    expect(looks).toHaveLength(LOOKS.length);
    expect(LOOKS.length % 2).toBe(0);
    expect(document.querySelector("[data-looks]")?.className).toContain("grid-rows-2");
    const passersBy = ROSTER.filter((person) => person.role === "passer-by").map((person) => person.file);
    expect(LOOKS.map((look) => look.file).sort()).toEqual([...passersBy].sort());
    for (const id of ["chr_ada", "chr_tunde", "chr_zainab", "chr_ngozi", "chr_tobi", "chr_femi", "chr_kemi", "chr_bisi"]) expect(LOOKS.some((look) => look.id === id)).toBe(true);
    for (const id of ["chr_hawker_a", "chr_corper", "chr_chief", "chr_rider", "chr_iya"]) expect(LOOKS.some((look) => look.id === id)).toBe(false);
    // One question a screen: the look's sheet holds no name.
    expect(document.querySelector("input")).toBeNull();

    const said: string[] = [sheet().textContent];
    await toTheArchetypes();
    said.push(sheet().textContent);
    expect(document.querySelector("[data-gate] [data-front-scene]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.ready")}`) }));
    said.push(sheet().textContent);
    expect(document.querySelector("[data-gate] [data-front-scene]")).not.toBeNull();
    // No starting life's person is offered: not by full name, and no name to take is one of theirs.
    const fullNames = FIXED.map((id) => text[`${id}.name`] ?? "");
    expect(said.filter((words) => fullNames.some((name) => words.includes(name)))).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.archetype.writer.name") }));
    // The name is typed (the review), with three names from the pool under the box.
    expect(screen.getByRole("textbox", { name: say("prologue.door.name.title") })).toBeDefined();
    const offered = within(screen.getByRole("group", { name: say("prologue.door.name.suggested") })).getAllByRole("button").map((button) => button.textContent);
    expect(offered).toHaveLength(NAMES_SHOWN);
    expect(offered.filter((name) => NAMED.includes(name))).toEqual([]);
    said.push(sheet().textContent);
    expect(said.join(" ")).not.toContain(say("ui.life.start"));
  });

  test("[R-PROLOGUE-009] given a look tapped, then the character at the gate wears it, and the three names under the name box, and three more on a reroll, come from the pool for that look's sex", async () => {
    door();
    for (const look of [LOOKS.find((one) => one.sex === "m")!, LOOKS.find((one) => one.sex === "f")!]) {
      fireEvent.click(document.querySelector(`[role="radio"][data-look="${look.id}"]`)!);
      expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe(look.id);
      await toTheArchetypes();
      fireEvent.click(screen.getByRole("button", { name: say("prologue.archetype.writer.name") }));
      expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe(look.id);
      const shown = () => within(screen.getByRole("group", { name: say("prologue.door.name.suggested") })).getAllByRole("button").map((button) => button.textContent);
      const first = shown();
      fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
      const second = shown();
      expect(second).not.toEqual(first);
      for (const name of [...first, ...second]) {
        const sexes = sexOfName(name);
        expect(sexes.size).toBeGreaterThan(0);
        expect(sexes.has(look.sex) || sexes.has("either")).toBe(true);
        expect(NAMED).not.toContain(name);
      }
      expect(new Set(first).size).toBe(NAMES_SHOWN);
      fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
      fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    }
  });

  test("[R-PROLOGUE-009] given many rolls, then every name offered is a pool name that suits the look, and three differ each time", () => {
    for (let roll = 0; roll < 200; roll += 1) {
      for (const sex of ["f", "m"] as const) {
        const names = namesFor(sex, roll);
        expect(new Set(names).size).toBe(NAMES_SHOWN);
        for (const name of names) expect(sexOfName(name).has(sex) || sexOfName(name).has("either")).toBe(true);
      }
    }
  });

  test("[R-PROLOGUE-009] given a look picked, a name typed and a ready life begun, then the person is kept beside the save under its one key, and the city and the rides draw that look", async () => {
    const { store, storage } = door();
    const look = LOOKS.find((one) => one.id === "chr_femi")!;
    fireEvent.click(document.querySelector(`[role="radio"][data-look="${look.id}"]`)!);
    await startReadyLife("scenario.ngozi", "Obinna");
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.ngozi"));
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(readPerson()).toEqual({ look: "chr_femi", name: "Obinna", archetype: null });
    expect(localStorage.getItem(PERSON_KEY)).not.toBeNull();
    // The life's own person was Ngozi; the city and the ride draw the look built at the door.
    expect(ownFile("scenario.ngozi")).toBe(look.file);
    expect(ownLook("scenario.ngozi")).toBe(look.file);
    expect(ownFile("scenario.ngozi", null)).toBe("shared/chr/chr_ngozi.glb");
  });

  test("[R-PROLOGUE-009] given the ready lives' card, then the five fixed lives show unnamed by their kind and blurb, each with Pick, and a pick goes on to the name and the page, whose Begin starts that life", async () => {
    const { store } = door();
    await toTheArchetypes();
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${say("ui.door.ready")}`) }));
    const lives = [...document.querySelectorAll<HTMLElement>("[data-ready-life]")];
    expect(lives.map((life) => life.dataset["readyLife"])).toEqual(FIXED);
    expect(FIXED).toHaveLength(5);
    expect(lives.map((life) => within(life).getByRole("heading").textContent)).toEqual(["The graduate", "The banker", "The developer", "The nurse", "The teacher"]);
    for (const life of lives) {
      const id = life.dataset["readyLife"]!;
      expect(life.textContent).toContain(text[`${id}.blurb`]);
      expect(within(life).getByRole("button", { name: `${say("prologue.door.pick")}: ${say(`${id}.kind`)}` })).toBeDefined();
      for (const word of [" he ", " she ", " his ", " her ", " him "]) expect(` ${text[`${id}.blurb`] ?? ""} `.toLowerCase()).not.toContain(word);
    }
    fireEvent.click(screen.getByRole("button", { name: `${say("prologue.door.pick")}: ${say("scenario.tunde.kind")}` }));
    await nameAndBegin();
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.tunde"));
    expect(store.getState().view?.prologue).toBeNull();
  });

  test("[R-PROLOGUE-009] given the six archetypes, then each tile says its name, one line of what it was and one line of what it opens, and no more", async () => {
    door();
    await toTheArchetypes();
    const tiles = [...document.querySelectorAll<HTMLElement>("[data-archetype]")];
    expect(tiles.map((tile) => tile.dataset["archetype"])).toEqual(ARCHETYPES.map((archetype) => archetype.id));
    for (const tile of tiles) {
      const id = tile.dataset["archetype"]!;
      const lines = [...tile.children].map((line) => line.textContent);
      expect(lines).toEqual([say(`prologue.archetype.${id}.name`), say(`prologue.archetype.${id}.was`), say(`prologue.archetype.${id}.opens`)]);
      expect(lines[2]).toMatch(/^Opens: /);
    }
  });
});

describe("a life from sixteen built from an archetype", () => {
  test("[R-PROLOGUE-010] given the nurse's tile, when the prologue opens, then the client sends the preset for her, the cards she leaves open show over the compound with a short beat, and the handover names her and her archetype above the home and the first step", async () => {
    const nurse = archetypeOf("nurse")!;
    const { store, storage } = door();
    await startArchetype("nurse");
    const shown: string[] = [];
    let beat = false;
    for (let guard = 0; guard < 40; guard += 1) {
      await waitFor(() => {
        const view = store.getState().view;
        if (view?.prologue === null) return;
        if (document.querySelector("[data-prologue-card]") === null) throw new Error("No card yet.");
      });
      const view = store.getState().view!;
      if (view.prologue === null) break;
      const prologue = view.prologue;
      shown.push(prologue.step);
      expect(document.querySelector("[data-gate] [data-front-scene]")).not.toBeNull();
      expect(screen.getByRole("heading", { name: words(`prologue.${prologue.step}.card`) })).toBeDefined();
      beat ||= document.querySelector("[data-beat]") !== null;
      const answer = answersInOrder(nurse, prologue.step, prologue.answers).find((one) => one.allowed)!;
      const card = document.querySelector<HTMLElement>("[data-prologue-card]")!;
      const v = view.v;
      fireEvent.click(within(card).getByRole("button", { name: words(`prologue.${prologue.step}.answer.${answer.id}`) }));
      await waitFor(() => expect(store.getState().view?.v).toBeGreaterThan(v));
    }
    expect(store.getState().view?.prologue).toBeNull();
    // Only the cards the nurse leaves open: the exam's way (and a retake), the strike, the send-off, where to sleep.
    expect(shown.filter((step) => !["exam", "retake", "strike", "friend", "home"].includes(step))).toEqual([]);
    expect(shown).toContain("exam");
    expect(shown.at(-1)).toBe("home");
    expect(beat).toBe(true);
    // Every step the nurse names was sent with her answer.
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { save: Parameters<typeof savedCommands>[0] };
    const chosen = savedCommands(raw.save).flatMap(({ command }) => (command.type === "prologue/choose" ? [command] : []));
    expect(chosen.filter(({ step, answer }) => nurse.preset[step] !== undefined && !(nurse.preset[step] ?? []).includes(answer))).toEqual([]);
    expect(chosen.map((command) => command.step)).toEqual(expect.arrayContaining(["subjects", "after-school", "course", "side-skill", "hustle", "service"]));

    const person = readPerson()!;
    const handover = await screen.findByRole("heading", { name: person.name }, { timeout: 10_000 });
    expect(handover).toBeDefined();
    const archetypeLine = document.querySelector("[data-handover-archetype]")?.textContent;
    expect(archetypeLine).toBe("The nurse. Science, then nursing school.");
    const story = document.querySelector("[data-handover-story]")!;
    expect(archetypeLine === undefined ? -1 : document.body.textContent.indexOf(archetypeLine)).toBeLessThan(document.body.textContent.indexOf(story.textContent));
    expect(document.querySelector("[data-first-step]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    await waitFor(() => expect(document.querySelector("[data-gate]")).toBeNull());
    expect(store.getState().view?.chapter.current).toBe("chapter.find-your-feet");
  });

  test("[R-PROLOGUE-010] given the setting prologue.full, when an archetype's tile is tapped, then every card shows from the opening draw, one answer each, with no preset sent", async () => {
    localStorage.setItem(FULL_PROLOGUE_KEY, "on");
    const { store } = door();
    await startArchetype("developer");
    expect(await screen.findByRole("heading", { name: words("prologue.draw.card") }, { timeout: 10_000 })).toBeDefined();
    fireEvent.click(within(document.querySelector<HTMLElement>("[data-prologue-card]")!).getByRole("button", { name: words("prologue.draw.answer.begin") }));
    expect(await screen.findByRole("heading", { name: words("prologue.subjects.card") }, { timeout: 10_000 })).toBeDefined();
    expect(store.getState().view?.prologue?.step).toBe("subjects");
  });

  test("[R-PROLOGUE-010] given every card and answer of the prologue, then a card is at most ten words and an answer at most four, with at most one hint line", () => {
    const count = (said: string) => said.split(/\s+/).filter((word) => /[A-Za-z0-9]/.test(word)).length;
    const long: string[] = [];
    for (const step of Object.values(content.prologue)) {
      if (count(words(`prologue.${step.id}.card`)) > 10) long.push(`prologue.${step.id}.card`);
      for (const answer of step.answers) {
        const key = `prologue.${step.id}.answer.${answer.id}`;
        if (count(words(key)) > 4) long.push(key);
        if ((text[`${key}.hint`] ?? "").includes("\n")) long.push(`${key}.hint`);
      }
    }
    expect(long).toEqual([]);
  });

  test("[R-PROLOGUE-009] given the front door and then the prologue, when each opens, then each counts its screen once", async () => {
    door();
    await startArchetype("writer");
    await waitFor(() => expect(document.querySelector("[data-prologue-card]")).not.toBeNull());
    restore();
    restore = () => undefined;
    const screens = rows.filter((row) => row.name === "screen/opened");
    expect(screens).toEqual(expect.arrayContaining([expect.objectContaining({ key: "scenario", count: 1 }), expect.objectContaining({ key: "prologue", count: 1 })]));
  });
});
