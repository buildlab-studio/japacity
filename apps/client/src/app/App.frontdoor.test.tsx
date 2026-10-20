// The front door in the app, on the real content (prologue:front-door-builds-a-person, prologue:archetype-presets-answers, prologue:front-door-three-screens, prologue:printed-page-hands-over): a person built on the
// door's sky from a look, a name filled from the pool (a dice, or typed) and an archetype, never a
// named life picked; the preset played for the archetype with no card; the page as the handover saying who the person is; the
// look kept beside the save and drawn by the city and the rides.
import type { CounterRow } from "@japacity/api";
import { content, namePool, text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { savedCommands } from "@japacity/sim";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { App } from "./App";
import { bootGame } from "../authority/boot";
import { readPerson } from "../shared/frontdoor/person";
import type { GameStore } from "../authority/store";
import { countInto } from "../shared/analytics/start";
import { makeCounters } from "../shared/analytics/counters";
import { say, words } from "../shared/words/text";
import { ownFile } from "../features/city/City";
import { ROSTER } from "../shared/scene/roster";
import { ownLook } from "../features/map/Ride";
import { ARCHETYPES, archetypeOf, opensChips, savingsOf } from "../shared/frontdoor/archetypes";
import { formatMoney } from "../shared/words/format";
import { askReadyLives, begin, startArchetype, startReadyLife, toTheArchetypes } from "../shared/frontdoor/frontDoor.testing";
import { LOOKS, lookOf, namesFor, NAMES_SHOWN } from "../shared/frontdoor/looks";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";
import { FULL_PROLOGUE_KEY, PERSON_KEY, SAVE_KEY } from "../shared/kept/storage";
import { memoryStorage } from "../shared/testing/storage";

const FIXED = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);
/** The words a ready life's person would be named by: a ready life has none (scenario.md), so the door has none to offer. */
const NAMED = FIXED.flatMap((id) => [`${id}.name`, `share.first-name.${id}`]).filter((key) => key in text);

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

/** What the door's screen says under its head. */
function sheet(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-door-body]");
  if (found === null) throw new Error("No door screen.");
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
  test("[prologue:front-door-builds-a-person] [prologue:front-door-three-screens] given no save, when the game opens, then you stand whole on a photo card under the question who you are, with a name already filled from the pool and the look strip of every one of the city's passers-by on the same screen, and no named life anywhere", async () => {
    door();
    expect(await screen.findByRole("heading", { name: say("ui.life.title") }, { timeout: 10_000 })).toBeDefined();
    // Never a bare page: you stand whole on a photo card as a sticker, never on a turntable.
    expect(document.querySelector("[data-gate] [data-door-photo] [data-figure]")).not.toBeNull();
    expect(document.querySelector("[data-gate] [data-turntable], canvas")).toBeNull();
    // One strip of face stickers: every passer-by, both bodies, with no row of bodies.
    const shown = (): string[] => within(screen.getByRole("radiogroup", { name: say("ui.door.look") })).getAllByRole("radio").map((one) => one.getAttribute("data-look") ?? "");
    expect(shown()).toEqual(LOOKS.map((one) => one.id));
    expect(screen.queryByRole("button", { name: say("ui.door.body.f") })).toBeNull();
    expect(lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))).not.toBeNull();
    const passersBy = ROSTER.filter((person) => person.role === "passer-by").map((person) => person.file);
    expect(LOOKS.map((look) => look.file).sort()).toEqual([...passersBy].sort());
    for (const id of ["person_ada", "person_tunde", "person_zainab", "person_ngozi", "person_tobi", "person_femi", "person_kemi", "person_bisi"]) expect(LOOKS.some((look) => look.id === id)).toBe(true);
    for (const id of ["person_hawker_a", "person_corper", "person_chief", "person_rider", "person_iya"]) expect(LOOKS.some((look) => look.id === id)).toBe(false);
    // The name and the look share the first screen; the name is filled already, and no ready life has a person to offer.
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
    expect(box.value.length).toBeGreaterThan(1);
    expect(NAMED).toEqual([]);

    const said: string[] = [sheet().textContent];
    await toTheArchetypes();
    said.push(sheet().textContent);
    // The lives carry your face beside each life's thing.
    expect(document.querySelector("[data-gate] [data-archetype] [data-face-sticker]")).not.toBeNull();
    // No ready life's person is offered: none has one, and each is shown by its role alone.
    expect(NAMED).toEqual([]);
    expect(said.join(" ")).not.toContain(say("ui.life.start"));
  });

  test("[prologue:front-door-builds-a-person] [prologue:front-door-three-screens] given a look tapped, then the character at the gate wears it, and the name filled, and each name the dice gives, comes from the pool for that look's sex, with no ready life's person to give", async () => {
    expect(NAMED).toEqual([]);
    door();
    const box = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
    for (const look of [LOOKS.find((one) => one.sex === "m")!, LOOKS.find((one) => one.sex === "f")!]) {
      fireEvent.click(document.querySelector(`[role="radio"][data-look="${look.id}"]`)!);
      expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe(look.id);
      const names = [box().value];
      for (let roll = 0; roll < 6; roll += 1) {
        fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
        names.push(box().value);
      }
      expect(new Set(names).size).toBeGreaterThan(3);
      for (const name of names) {
        const sexes = sexOfName(name);
        expect(sexes.size).toBeGreaterThan(0);
        expect(sexes.has(look.sex) || sexes.has("either")).toBe(true);
      }
      await toTheArchetypes();
      expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe(look.id);
      fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    }
    expect(lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))?.sex).toBe("f");
  });

  test("[prologue:front-door-builds-a-person] given many rolls, then every name offered is a pool name that suits the look, and three differ each time", () => {
    for (let roll = 0; roll < 200; roll += 1) {
      for (const sex of ["f", "m"] as const) {
        const names = namesFor(sex, roll);
        expect(new Set(names).size).toBe(NAMES_SHOWN);
        for (const name of names) expect(sexOfName(name).has(sex) || sexOfName(name).has("either")).toBe(true);
      }
    }
  });

  test("[prologue:front-door-builds-a-person] given a look picked, a name typed and a ready life begun, then the person is kept beside the save under its one key, and the city and the rides draw that look", async () => {
    askReadyLives();
    const { store, storage } = door();
    // Settings' run opens on the ready lives; the look is a screen back.
    fireEvent.click(await screen.findByRole("button", { name: say("ui.door.back") }, { timeout: 10_000 }));
    const look = LOOKS.find((one) => one.id === "person_femi")!;
    fireEvent.click(document.querySelector(`[role="radio"][data-look="${look.id}"]`)!);
    await startReadyLife("scenario.nurse", "Obinna");
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.nurse"));
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(readPerson()).toEqual({ look: "person_femi", name: "Obinna", archetype: null });
    expect(localStorage.getItem(PERSON_KEY)).not.toBeNull();
    // A ready life has no person of its own (scenario.md): the city and the ride draw the look built at the door, and with
    // none kept, the city's own, never a look named for the life.
    expect(ownFile()).toBe(look.file);
    expect(ownLook()).toBe(look.file);
    expect(ownFile(null)).toBe("shared/person/person_tunde.glb");
    expect(ownLook(null)).toBe("shared/person/person_tunde.glb");
  });

  test("[prologue:front-door-three-screens] given a run Settings asked for, then it opens on the five fixed lives unnamed by their kind and blurb, each with Pick, and a pick goes on to Where you live, whose Begin starts that life", async () => {
    askReadyLives();
    const { store } = door();
    // It opens on the ready lives themselves.
    await screen.findByRole("heading", { name: say("ui.door.ready.title") }, { timeout: 10_000 });
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
    // No ready life's person is named on the list: each has its role and no name of its own.
    expect(NAMED).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: `${say("prologue.door.pick")}: ${say("scenario.banker.kind")}` }));
    await begin();
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.banker"));
    expect(store.getState().view?.prologue).toBeNull();
  });

  test("[prologue:archetype-presets-answers] [prologue:front-door-three-screens] given the seven archetypes, then each life's card says its tag, its name, the life in a few words, one line of what it was and its savings, the chosen one's routes stand as chips under the cards, and every card reads out its one line of what it opens; no more", async () => {
    door();
    await toTheArchetypes();
    const tiles = [...document.querySelectorAll<HTMLElement>("[data-archetype]")];
    expect(tiles.map((tile) => tile.dataset["archetype"])).toEqual(ARCHETYPES.map((archetype) => archetype.id));
    for (const tile of tiles) {
      const id = tile.dataset["archetype"]!;
      expect(tile.textContent).toBe(`${say(`ui.door.tag.${id}`)}${say(`prologue.archetype.${id}.name`)}${say(`prologue.archetype.${id}.life`)}${say(`prologue.archetype.${id}.was`)}${say("ui.door.tile.savings", { amount: formatMoney(savingsOf(archetypeOf(id)!), "NGN") })}`);
      expect(tile.getAttribute("aria-description")).toMatch(/^Opens: /);
    }
    const chosen = tiles.find((tile) => tile.getAttribute("aria-checked") === "true")!.dataset["archetype"]!;
    expect([...document.querySelectorAll("[data-tile-opens] [data-way]")].map((way) => way.textContent)).toEqual(opensChips(chosen));
  });
});

describe("a life from sixteen built from an archetype", () => {
  test("[prologue:archetype-presets-answers] [prologue:printed-page-hands-over] given the nurse's tile, when the prologue opens, then the client sends her preset at every step with no card, the page fills on the door's sky, and as the handover it names her and her archetype above the family, the years and the first step", async () => {
    const nurse = archetypeOf("nurse")!;
    const { store, storage } = door();
    await startArchetype("nurse");
    let card = false;
    await waitFor(
      () => {
        card ||= document.querySelector("[data-prologue-card]") !== null;
        if (store.getState().view?.prologue !== null || document.querySelector("[data-page-handover]") === null) throw new Error("The years are still going by.");
      },
      { timeout: 10_000, interval: 5 },
    );
    expect(card).toBe(false);
    // The page stands on the door's sky, no compound drawn behind it.
    expect(document.querySelector("[data-gate='handover'][data-door-frame]")).not.toBeNull();
    expect(document.querySelector("[data-gate] [data-front-scene]")).toBeNull();
    // Every step was sent with one of her answers, the exam, the strike, the send-off and the home included.
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { save: Parameters<typeof savedCommands>[0] };
    const chosen = savedCommands(raw.save).flatMap(({ command }) => (command.type === "prologue/choose" ? [command] : []));
    expect(chosen.filter(({ step, answer }) => nurse.preset[step] !== undefined && !(nurse.preset[step] ?? []).includes(answer))).toEqual([]);
    expect(chosen.map((command) => command.step)).toEqual(expect.arrayContaining(["subjects", "after-school", "exam", "course", "strike", "side-skill", "hustle", "service", "friend", "home"]));

    const person = readPerson()!;
    // The name prints on the data page itself, not as a heading in the sheet.
    expect((await screen.findAllByText(person.name)).length).toBeGreaterThan(0);
    // The page prints the path under PATH and SO FAR, not the sheet.
    expect(screen.getAllByText(say("prologue.archetype.nurse.name")).length).toBeGreaterThan(0);
    const at = (selector: string): number => {
      const found = document.querySelector(selector);
      if (found === null) throw new Error(`No ${selector}.`);
      return document.body.textContent.indexOf(found.textContent);
    };
    expect(at("[data-family]")).toBeLessThan(at("[data-years]"));
    expect(document.querySelector("[data-years] [data-fact='university']")?.textContent).toContain(words("prologue.course.answer.nursing"));
    expect(document.querySelector("[data-first-step]")).not.toBeNull();
    expect(document.querySelector("[data-page] [data-field='path']")?.textContent).toContain(say("prologue.archetype.nurse.name"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.prologue.start", { month: 1 }) }));
    await waitFor(() => expect(document.querySelector("[data-gate]")).toBeNull());
    expect(store.getState().view?.chapter.current).toBe("chapter.find-your-feet");
  });

  test("[prologue:archetype-presets-answers] given the setting prologue.full, when an archetype's tile is tapped, then every card shows from the opening draw, one answer each, with no preset sent", async () => {
    localStorage.setItem(FULL_PROLOGUE_KEY, "on");
    const { store } = door();
    await startArchetype("developer");
    expect(await screen.findByRole("heading", { name: words("prologue.draw.card") }, { timeout: 10_000 })).toBeDefined();
    fireEvent.click(within(document.querySelector<HTMLElement>("[data-prologue-card]")!).getByRole("button", { name: words("prologue.draw.answer.begin") }));
    expect(await screen.findByRole("heading", { name: words("prologue.subjects.card") }, { timeout: 10_000 })).toBeDefined();
    expect(store.getState().view?.prologue?.step).toBe("subjects");
  });

  test("[prologue:archetype-presets-answers] given every card and answer of the prologue, then a card is at most ten words and an answer at most four, with at most one hint line", () => {
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

  test("[prologue:front-door-builds-a-person] given the front door and then the prologue, when each opens, then each counts its screen once", async () => {
    door();
    await startArchetype("writer");
    await waitFor(() => expect(document.querySelector("[data-page-handover]")).not.toBeNull(), { timeout: 10_000 });
    restore();
    restore = () => undefined;
    const screens = rows.filter((row) => row.name === "screen/opened");
    expect(screens).toEqual(expect.arrayContaining([expect.objectContaining({ key: "scenario", count: 1 }), expect.objectContaining({ key: "prologue", count: 1 })]));
  });
});
