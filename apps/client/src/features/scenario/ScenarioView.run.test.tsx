// The front door in three screens with everything chosen (prologue.md R-PROLOGUE-009, 013): You (a name filled from the
// pool for the look's sex, a dice, the look strip), Your life so far (the tiles, the first chosen, with the age under
// them) and Your page (the travel data page with it all printed, the look as the photo). Next, Next, Begin starts a
// life; Skip goes to the page and Shuffle picks at random; a reload at any step comes back to that step.
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { readPerson } from "../../authority/person";
import { createGameStore, type GameStore } from "../../authority/store";
import { ageSteps, ageStepWords, stepsOpen } from "../../shared/datapage/age";
import { DOOR_KEY } from "../../shared/datapage/door";
import { aboutYears, middleMonths } from "../../shared/datapage/years";
import { archetypeOf } from "../../shared/frontdoor/archetypes";
import { problemWords } from "../../shared/datapage/name";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { askReadyLives } from "../../shared/frontdoor/ready";
import { ARCHETYPES, savingsOf } from "../../shared/frontdoor/archetypes";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { text } from "@japacity/content";
import { fitHome, pocketIn, ScenarioView } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

function door(): GameStore {
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "run-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  render(
    <GameProvider store={store}>
      <ScenarioView />
    </GameProvider>,
  );
  return store;
}

const stage = (): string | null => document.querySelector("[data-gate]")?.getAttribute("data-gate") ?? null;
const next = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
/** The roll the run kept, which picks the pool's names. */
const keptRoll = (): number => (JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}") as { roll?: number }).roll ?? -1;
const nameBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });

describe("the run through the front door", () => {
  test("[R-PROLOGUE-013] given a new player who changes nothing, when they press Next, Next and Begin, then the first screen has a name from the pool for the look's sex and the look strip, the second the first tile chosen with the age under it, the page prints them all, and Begin starts that tile's life", async () => {
    const store = door();
    expect(stage()).toBe("you");
    const look = lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))!;
    const filled = nameBox().value;
    expect(filled.length).toBeGreaterThan(1);
    expect(namesFor(look.sex, keptRoll())).toContain(filled);
    // Name and look on one screen; no tile yet.
    expect(document.querySelector("[data-looks]")).not.toBeNull();
    expect(document.querySelector("[data-archetypes]")).toBeNull();
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("life");
    const first = ARCHETYPES[0]!;
    expect(screen.getByRole("radio", { name: say(`prologue.archetype.${first.id}.name`) }).getAttribute("aria-checked")).toBe("true");
    expect(document.querySelectorAll("[data-archetypes] [aria-checked='true']")).toHaveLength(1);
    // The age sits under the tiles, at the tile's own.
    expect(document.querySelector("[data-archetypes]")!.compareDocumentPosition(document.querySelector("[data-door-age]")!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.querySelector("[data-age-years]")?.textContent).toBe(say("prologue.door.age.years", { years: aboutYears(middleMonths(first)) }));
    expect(document.querySelector("input")).toBeNull();
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("page");
    const page = document.querySelector<HTMLElement>("[data-page]")!;
    expect(page.querySelector("[data-field='name']")?.textContent).toContain(filled);
    expect(page.querySelector("[data-field='path']")?.textContent).toContain(say(`prologue.archetype.${first.id}.name`));
    expect(page.querySelector("[data-field='age']")?.textContent).toContain(say("prologue.page.age.about", { years: aboutYears(middleMonths(first)) }));
    expect(page.querySelector<HTMLImageElement>("[data-photo] img")?.getAttribute("src")).toBe(look.picture);
    // Nothing is begun before Begin: the person is kept only then.
    expect(readPerson()).toBeNull();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().choosingLife).toBe(false), { timeout: 4000 });
    expect(store.getState().view?.scenario).toBe("scenario.prologue");
    expect(readPerson()).toEqual({ look: look.id, name: filled, archetype: first.id });
  });

  test("[R-PROLOGUE-013] given the first screen, when a look of the other sex is tapped, the dice rolled or a name typed, then a filled name follows the look's sex, the dice gives another from the pool, typing keeps the name through a new look, and a name that fails the checks is refused in words", () => {
    door();
    const sexOf = (): "f" | "m" => lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))!.sex;
    const other = LOOKS.find((one) => one.sex !== sexOf())!;
    fireEvent.click(document.querySelector(`[role="radio"][data-look="${other.id}"]`)!);
    expect(sexOf()).toBe(other.sex);
    expect(nameBox().value).toBe(namesFor(other.sex, keptRoll())[0]);
    const before = nameBox().value;
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    expect(nameBox().value).toBe(namesFor(other.sex, keptRoll())[0]);
    expect(nameBox().value).not.toBe(before);
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    fireEvent.click(document.querySelector(`[role="radio"][data-look="${LOOKS.find((one) => one.sex !== other.sex)!.id}"]`)!);
    expect(nameBox().value).toBe("Ifeoma");

    fireEvent.change(nameBox(), { target: { value: "Ada1" } });
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("you");
    expect(screen.getByRole("alert").textContent).toBe(problemWords("letters"));
    fireEvent.change(nameBox(), { target: { value: "Japacity" } });
    expect(screen.getByRole("alert").textContent).toBe(problemWords("reserved"));
    fireEvent.change(nameBox(), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.skip") }));
    expect(stage()).toBe("you");
    expect(screen.getByRole("alert").textContent).toBe(problemWords("short"));
    fireEvent.change(nameBox(), { target: { value: "Tobi" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("life");
  });

  test("[R-PROLOGUE-013] given the first two screens, then Skip goes straight to the page with everything chosen, and Shuffle picks a look, a filled name and a tile; the page has neither", () => {
    door();
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.skip") }));
    expect(stage()).toBe("page");
    expect(document.querySelector("[data-page] [data-field='path']")?.textContent).toContain(say(`prologue.archetype.${ARCHETYPES[0]!.id}.name`));
    expect(screen.queryByRole("button", { name: say("ui.door.skip") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.door.shuffle.all") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("life");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.skip") }));
    expect(stage()).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    const seen = { looks: new Set<string>(), tiles: new Set<string>(), names: new Set<string>() };
    for (let at = 0; at < 30; at += 1) {
      fireEvent.click(screen.getByRole("button", { name: say("ui.door.shuffle.all") }));
      const kept = JSON.parse(localStorage.getItem(DOOR_KEY)!) as { look: string; archetype: string; name: string; roll: number; typed: boolean; age: number };
      seen.looks.add(kept.look);
      seen.tiles.add(kept.archetype);
      seen.names.add(kept.name);
      expect(kept.name).toBe(namesFor(lookOf(kept.look)!.sex, kept.roll)[0]);
      expect(kept.typed).toBe(false);
      expect(kept.age).toBe(0);
      expect(screen.getByRole("radio", { name: say(`prologue.archetype.${kept.archetype}.name`) }).getAttribute("aria-checked")).toBe("true");
    }
    expect(seen.looks.size).toBeGreaterThan(3);
    expect(seen.tiles.size).toBeGreaterThan(2);
    expect(seen.names.size).toBeGreaterThan(5);
  });

  test("[R-PROLOGUE-009] [R-PROLOGUE-013] given a reload at any screen, then the door comes back to that screen with what was answered", () => {
    door();
    fireEvent.click(document.querySelector(`[role="radio"][data-look="chr_femi"]`)!);
    fireEvent.change(nameBox(), { target: { value: "Emeka" } });
    cleanup();
    door();
    expect(stage()).toBe("you");
    expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe("chr_femi");
    expect(nameBox().value).toBe("Emeka");
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.trader.name") }));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    cleanup();
    door();
    expect(stage()).toBe("life");
    expect(screen.getByRole("radio", { name: say("prologue.archetype.trader.name") }).getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector("[data-age-years]")?.textContent).toBe(say("prologue.door.age.years", { years: aboutYears(middleMonths(archetypeOf("trader")!) + 12) }));
    fireEvent.click(next(say("ui.door.next")));
    cleanup();
    door();
    expect(stage()).toBe("page");
    expect(document.querySelector("[data-page] [data-field='name']")?.textContent).toContain("Emeka");
    expect(document.querySelector("[data-page] [data-field='path']")?.textContent).toContain(say("prologue.archetype.trader.name"));
    expect(localStorage.getItem(DOOR_KEY)).not.toBeNull();
  });

  test("[R-PROLOGUE-013] given the door, then no ready life is on it; given a run Settings asked for, then its second screen lists the ready lives, a pick goes to the page, and Begin stamps it and starts that life with its own age printed", async () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-ready], [data-ready-life]")).toBeNull();
    expect(screen.queryByText(say("ui.door.ready"))).toBeNull();
    cleanup();
    localStorage.clear();
    askReadyLives();
    const store = door();
    expect(stage()).toBe("you");
    fireEvent.change(nameBox(), { target: { value: "Bayo" } });
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("ready");
    expect(document.querySelector("[data-archetypes]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${say("prologue.door.pick")}: ${say("scenario.tunde.kind")}` }));
    expect(stage()).toBe("page");
    expect(document.querySelector("[data-page] [data-field='path']")?.textContent).toContain(say("scenario.tunde.kind"));
    expect(document.querySelector("[data-page] [data-field='age']")?.textContent).toContain(say("prologue.page.age.about", { years: 29 }));
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("prologue.page.stamp.ready"))).toBeDefined();
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.tunde"), { timeout: 4000 });
    expect(readPerson()?.name).toBe("Bayo");
    expect(readPerson()?.archetype).toBeNull();
  });

  test("[R-PROLOGUE-013] given a screen past the first, then a back button returns to the screen before with its answers kept", () => {
    door();
    fireEvent.change(nameBox(), { target: { value: "Kemi" } });
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.writer.name") }));
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("life");
    expect(screen.getByRole("radio", { name: say("prologue.archetype.writer.name") }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("you");
    expect(nameBox().value).toBe("Kemi");
    expect(screen.queryByRole("button", { name: say("ui.door.back") })).toBeNull();
  });

  test("[R-PROLOGUE-009] [R-PROLOGUE-013] given a tile, then the age under it is never typed: it starts at the tile's own, steps a year at a time within the steps the card keeps inside 18 to 29, says what each step does, and prints on the page", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.shop-worker.name") }));
    expect(document.querySelector("input")).toBeNull();
    const middle = middleMonths(archetypeOf("shop-worker")!);
    const years = () => document.querySelector("[data-age-years]")?.textContent;
    const does = () => document.querySelector("[data-age-does]")?.textContent;
    expect(years()).toBe(say("prologue.door.age.years", { years: aboutYears(middle) }));
    expect(does()).toBe(ageStepWords(0, middle));
    const younger = screen.getByRole<HTMLButtonElement>("button", { name: say("prologue.door.age.younger") });
    const older = screen.getByRole<HTMLButtonElement>("button", { name: say("prologue.door.age.older") });
    const open = stepsOpen(middle);
    for (let step = -1; step >= Math.min(...open); step -= 1) {
      fireEvent.click(younger);
      expect(years()).toBe(say("prologue.door.age.years", { years: aboutYears(middle + step * 12) }));
      expect(does()).toBe(ageStepWords(step, middle));
    }
    expect(younger.disabled).toBe(true);
    for (let step = Math.min(...open) + 1; step <= Math.max(...open); step += 1) fireEvent.click(older);
    expect(older.disabled).toBe(true);
    expect(does()).toBe(ageStepWords(Math.max(...open), middle));
    expect(does()).toContain("passport");
    // Another tile starts again at its own age.
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.writer.name") }));
    expect(years()).toBe(say("prologue.door.age.years", { years: aboutYears(middleMonths(archetypeOf("writer")!)) }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.shop-worker.name") }));
    for (let step = 0; step < Math.max(...open); step += 1) fireEvent.click(older);
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-page] [data-field='age']")?.textContent).toContain(say("prologue.page.age.about", { years: aboutYears(middle + Math.max(...open) * 12) }));
  });

  test("[R-PROLOGUE-009] given the first screen, then the hook asks what your japacity is over the figure on the plinth, from the first second and before the look; later screens drop it", () => {
    door();
    const hook = document.querySelector("[data-door-hook]");
    expect(hook?.textContent).toBe(say("prologue.door.hook"));
    expect(hook?.textContent).toBe("What's your japacity?");
    // Over the scene, above the sheet with the look.
    expect(document.querySelector("[data-gate] [data-front-scene]")).not.toBeNull();
    const looks = document.querySelector("[data-looks]")!;
    expect(hook!.compareDocumentPosition(looks) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-door-hook]")).toBeNull();
  });

  test("[R-PROLOGUE-013] given each tile, then under the age a row says where you live: the family house in Surulere and a room of your own in Ojuelegba for every tile, a room on the water in Makoko for the child of the water alone, one line each with its cost a month, the right one chosen for the tile, and the money left after moving in from the tile's savings, or for the room the figure still needed; then the self-contain, locked as a goal with its figure; a home picked is kept through another tile while it can be paid", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    const monthly = { "family-house": 9500000, "compound-room": 5000000, makoko: 2500000 } as const;
    // The room takes its year and the fees at once (R-HOME-010): ₦350,000 and a fifth of it.
    const now = { "family-house": 0, "compound-room": 42000000, makoko: 0 } as const;
    for (const tile of ARCHETYPES) {
      fireEvent.click(screen.getByRole("radio", { name: say(`prologue.archetype.${tile.id}.name`) }));
      const row = document.querySelector<HTMLElement>("[data-door-home]")!;
      expect(document.querySelector("[data-door-age]")!.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const homes = [...row.querySelectorAll<HTMLElement>("[data-home]")];
      const offered = tile.id === "water" ? ["family-house", "compound-room", "makoko"] : ["family-house", "compound-room"];
      expect(homes.map((home) => home.dataset["home"])).toEqual([...offered, "self-contain"]);
      expect(homes.filter((home) => home.getAttribute("aria-checked") === "true").map((home) => home.dataset["home"])).toEqual([tile.id === "water" ? "makoko" : "family-house"]);
      for (const home of homes.slice(0, -1)) {
        const id = home.dataset["home"] as keyof typeof monthly;
        expect(home.textContent).toContain(`${say(`ui.door.home.${id}`)} · ${say(`ui.door.home.where.${id}`)}`);
        expect(home.querySelector("[data-home-costs]")?.textContent).toBe(say(`ui.door.home.costs.${id}`, { amount: formatMoney(monthly[id], "NGN"), rent: formatMoney(40000000, "NGN") }));
        const left = savingsOf(tile) - now[id] - monthly[id];
        expect(pocketIn(tile, 0, id)).toBe(left);
        // Only the room may be out of reach at a tile's own age: what is left after its year and fees covers no month there.
        const open = left >= 0;
        expect({ id, reachable: open || id === "compound-room" }).toEqual({ id, reachable: true });
        const shown = open ? `${formatMoney(left, "NGN")}${say("ui.door.home.left")}` : `${formatMoney(-left, "NGN")}${say("ui.door.home.needed")}`;
        expect({ id, shown: home.querySelector("[data-home-left]")?.textContent, shut: home.hasAttribute("disabled") }).toEqual({ id, shown, shut: !open });
      }
      const goal = homes.at(-1)!;
      expect(goal.tagName).not.toBe("BUTTON");
      expect(goal.getAttribute("role")).toBeNull();
      expect(goal.textContent).toBe(`${say("ui.door.home.self-contain")} · ${say("ui.door.home.where.self-contain")}${say("ui.door.home.costs.self-contain", { amount: formatMoney(84000000, "NGN") })}${say("ui.door.home.goal")}`);
    }
    expect(say("ui.door.home.costs.family-house", { amount: "₦95,000" })).toBe("₦95,000 a month · family around");
    // A home picked is kept through another tile; a home left as it was follows the tile.
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.developer.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "developer", home: "family-house" });
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.water.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "water", home: "makoko" });
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.family-house") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.nurse.name") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.water.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "water", home: "family-house", homePicked: true });
    // An older step adds its saving to what is left.
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    const older = ageSteps().find((step) => step.years === 1)!;
    expect(document.querySelector("[data-home='family-house'] [data-home-left]")?.textContent).toBe(`${formatMoney(savingsOf(archetypeOf("water")!) + older.saved - monthly["family-house"], "NGN")}${say("ui.door.home.left")}`);
    // The room picked under the accountant, who holds its year and a month, is kept through the trader, who does too.
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.accountant.name") }));
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.trader.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "trader", home: "compound-room", homePicked: true });
  });

  test("[R-PROLOGUE-013] given the writer, whose savings at her own age cover the room's year, its fees and a month of living with a little to spare, then the room is open with what is left over \"left\", a year older leaves more, and the pick holds when she steps back to her own age", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.writer.name") }));
    const writer = archetypeOf("writer")!;
    // The year and the fees (R-HOME-010) and the first month of living in the room, from the tile's savings.
    const left = savingsOf(writer) - (42000000 + 5000000);
    expect(left).toBeGreaterThan(0);
    const room = () => document.querySelector<HTMLButtonElement>("[data-home='compound-room']")!;
    expect(room().disabled).toBe(false);
    expect(room().querySelector("[data-home-left]")?.getAttribute("data-home-left")).toBe("left");
    expect(room().querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(left, "NGN")}${say("ui.door.home.left")}`);
    expect(room().querySelector("svg")?.getAttribute("class")).not.toContain("lucide-lock");
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    const older = ageSteps().find((step) => step.years === 1)!;
    expect(room().querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(left + older.saved, "NGN")}${say("ui.door.home.left")}`);
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "writer", home: "compound-room", homePicked: true });
    // A step back to her own age keeps the room: it is still open there.
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.younger") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "writer", home: "compound-room", homePicked: true });
  });

  test("[R-PROLOGUE-013] given a tile whose savings cannot cover the family house, then that row says the shortfall over \"short\" with a lock and cannot be picked, the room says what is still needed, and the home goes to the one the life can pay for", () => {
    // Makoko is the child of the water's alone, so her tile carries the case.
    const key = "prologue.archetype.water.savings";
    const kept = text[key];
    text[key] = "50000";
    try {
      door();
      fireEvent.click(next(say("ui.door.next")));
      fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.water.name") }));
      const house = document.querySelector<HTMLButtonElement>("[data-home='family-house']")!;
      expect(house.disabled).toBe(true);
      expect(house.querySelector("[data-home-left]")?.getAttribute("data-home-left")).toBe("short");
      expect(house.querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(9500000 - 5000000, "NGN")}${say("ui.door.home.short")}`);
      expect(house.querySelector("svg")?.getAttribute("class")).toContain("lucide-lock");
      const room = document.querySelector<HTMLButtonElement>("[data-home='compound-room']")!;
      expect(room.disabled).toBe(true);
      expect(room.querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(42000000 + 5000000 - 5000000, "NGN")}${say("ui.door.home.needed")}`);
      const water = document.querySelector<HTMLButtonElement>("[data-home='makoko']")!;
      expect(water.disabled).toBe(false);
      expect(water.getAttribute("aria-checked")).toBe("true");
      expect(water.querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(5000000 - 2500000, "NGN")}${say("ui.door.home.left")}`);
      expect(fitHome(archetypeOf("water")!, 0, { home: "family-house", homePicked: true })).toBe("makoko");
      expect(pocketIn(archetypeOf("water")!, 0, "family-house")).toBe(5000000 - 9500000);
    } finally {
      if (kept === undefined) delete text[key];
      else text[key] = kept;
    }
  });
});
