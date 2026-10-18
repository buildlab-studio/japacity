// The front door in three screens with everything chosen (prologue:front-door-builds-a-person, prologue:front-door-three-screens), in its lively dress:
// You (a name filled from the pool for the look's sex, a dice, the look strip as face stickers), Your life so far (the
// lives as cards, the first chosen, with the age under them) and Where you live (the homes as postcards, with the strip
// of who you are so far at the top, the look as its face), then Begin; the page prints after Begin. Next, Next, Begin
// starts a life; Skip goes to Where you live and Shuffle picks at random; a reload at any step comes back to that step.
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { readPerson } from "../../shared/frontdoor/person";
import { createGameStore, type GameStore } from "../../authority/store";
import { ageStepWords, startYearFor, stepsOpen, yearsWorked } from "../../shared/datapage/age";
import { readyMonths, yearsOf } from "../../shared/datapage/years";
import { archetypeOf } from "../../shared/frontdoor/archetypes";
import { problemWords } from "../../shared/datapage/name";
import { LOOKS, lookOf, namesFor } from "../../shared/frontdoor/looks";
import { askReadyLives } from "../../shared/frontdoor/ready";
import { ARCHETYPES, moneyDrawn, savingsOf } from "../../shared/frontdoor/archetypes";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { content, text } from "@japacity/content";
import { fitHome, pocketIn, ScenarioView, selfContainReached, selfContainYear, startIn } from "./ScenarioView";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";
import { DOOR_KEY } from "../../shared/kept/storage";

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
/** The strip at the top of Where you live: the name, the path and the age as the page prints it. */
const board = (): string => document.querySelector("[data-door-board]")?.textContent ?? "";
/** A look in the strip, by its id. */
const lookButton = (id: string): HTMLElement => document.querySelector<HTMLElement>(`[role="radio"][data-look="${id}"]`)!;

describe("the run through the front door", () => {
  test("[prologue:front-door-three-screens] given a new player who changes nothing, when they press Next, Next and Begin, then the first screen has a name from the pool for the look's sex and the look strip, the second the first tile chosen with the age under it, the page prints them all, and Begin starts that tile's life", async () => {
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
    expect(document.querySelector("[data-age-years]")?.textContent).toBe(say("prologue.door.age.years", { years: startYearFor(first, 0) }));
    expect(document.querySelector("input")).toBeNull();
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("page");
    // Where you live heads itself with who you are so far: the name, the path and the age as the page will print them, and the look's face.
    expect(board()).toContain(filled);
    expect(board()).toContain(say(`prologue.archetype.${first.id}.name`));
    expect(board()).toContain(say("prologue.page.age.years", { years: startYearFor(first, 0) }));
    expect(document.querySelector("[data-door-board] [data-face-sticker]")?.getAttribute("data-face-sticker")).toBe(look.id);
    // Nothing is printed before it is true: the page prints after Begin (prologue:printed-page-hands-over).
    expect(document.querySelector("[data-page]")).toBeNull();
    // Nothing is begun before Begin: the person is kept only then.
    expect(readPerson()).toBeNull();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().choosingLife).toBe(false), { timeout: 4000 });
    expect(store.getState().view?.scenario).toBe("scenario.prologue");
    expect(readPerson()).toEqual({ look: look.id, name: filled, archetype: first.id });
  });

  test("[prologue:front-door-three-screens] given the first screen, when a look of the other sex is tapped, the dice rolled or a name typed, then a filled name follows the look's sex, the dice gives another from the pool, typing keeps the name through a new look, and a name that fails the checks is refused in words", () => {
    door();
    const sexOf = (): "f" | "m" => lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))!.sex;
    const mine = sexOf();
    const other = LOOKS.find((one) => one.sex !== mine)!;
    // No body row; the strip holds every look, both bodies, as face stickers, and a look of the other body is tapped in it.
    expect([...document.querySelectorAll<HTMLElement>("[data-looks] [data-look]")].map((one) => one.dataset["look"])).toEqual(LOOKS.map((one) => one.id));
    expect(new Set(LOOKS.map((one) => one.sex))).toEqual(new Set(["f", "m"]));
    expect(document.querySelectorAll("[data-looks] [data-face-sticker]")).toHaveLength(LOOKS.length);
    fireEvent.click(lookButton(other.id));
    expect(sexOf()).toBe(other.sex);
    expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe(other.id);
    expect(lookButton(other.id).getAttribute("aria-checked")).toBe("true");
    expect(nameBox().value).toBe(namesFor(other.sex, keptRoll())[0]);
    const before = nameBox().value;
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    expect(nameBox().value).toBe(namesFor(other.sex, keptRoll())[0]);
    expect(nameBox().value).not.toBe(before);
    fireEvent.change(nameBox(), { target: { value: "Ifeoma" } });
    fireEvent.click(lookButton(LOOKS.find((one) => one.sex === mine)!.id));
    expect(sexOf()).toBe(mine);
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

  test("[prologue:front-door-three-screens] given the first two screens, then Skip goes straight to Where you live with everything chosen, and Shuffle picks a look, a filled name and a tile; Where you live has neither", () => {
    door();
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.skip") }));
    expect(stage()).toBe("page");
    expect(board()).toContain(say(`prologue.archetype.${ARCHETYPES[0]!.id}.name`));
    expect(document.querySelector("[data-door-home]")).not.toBeNull();
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

  test("[prologue:front-door-builds-a-person] [prologue:front-door-three-screens] given a reload at any screen, then the door comes back to that screen with what was answered", () => {
    door();
    fireEvent.click(lookButton("person_femi"));
    fireEvent.change(nameBox(), { target: { value: "Emeka" } });
    cleanup();
    door();
    expect(stage()).toBe("you");
    expect(document.querySelector("[data-gate]")?.getAttribute("data-look")).toBe("person_femi");
    expect(nameBox().value).toBe("Emeka");
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.trader.name") }));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    cleanup();
    door();
    expect(stage()).toBe("life");
    expect(screen.getByRole("radio", { name: say("prologue.archetype.trader.name") }).getAttribute("aria-checked")).toBe("true");
    expect(document.querySelector("[data-age-years]")?.textContent).toBe(say("prologue.door.age.years", { years: startYearFor(archetypeOf("trader")!, 1) }));
    fireEvent.click(next(say("ui.door.next")));
    cleanup();
    door();
    expect(stage()).toBe("page");
    expect(board()).toContain("Emeka");
    expect(board()).toContain(say("prologue.archetype.trader.name"));
    expect(board()).toContain(say("prologue.page.age.years", { years: startYearFor(archetypeOf("trader")!, 1) }));
    expect(localStorage.getItem(DOOR_KEY)).not.toBeNull();
  });

  test("[prologue:front-door-three-screens] given the door, then no ready life is on it; given a run Settings asked for, then it opens on the ready lives, the name a screen back, a pick goes to Where you live, and Begin starts that life, stamping nothing, with its own age printed", async () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-ready], [data-ready-life]")).toBeNull();
    expect(screen.queryByText(say("ui.door.ready"))).toBeNull();
    cleanup();
    localStorage.clear();
    askReadyLives();
    const store = door();
    // Settings' run opens on the ready lives themselves; Back reaches the name, Next comes back.
    expect(stage()).toBe("ready");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("you");
    fireEvent.change(nameBox(), { target: { value: "Bayo" } });
    fireEvent.click(next(say("ui.door.next")));
    expect(stage()).toBe("ready");
    expect(document.querySelector("[data-archetypes]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${say("prologue.door.pick")}: ${say("scenario.tunde.kind")}` }));
    expect(stage()).toBe("page");
    expect(board()).toContain(say("scenario.tunde.kind"));
    // A true number: the birthdays passed, 28 and some months.
    expect(board()).toContain(say("prologue.page.age.years", { years: yearsOf(readyMonths("scenario.tunde")) }));
    expect(yearsOf(readyMonths("scenario.tunde"))).toBe(28);
    fireEvent.click(next(say("ui.door.begin")));
    // Begin stamps nothing: the page takes no stamp before a visa (prologue:printed-page-hands-over).
    expect(document.querySelector("[data-stamp]")).toBeNull();
    await waitFor(() => expect(store.getState().view?.scenario).toBe("scenario.tunde"), { timeout: 4000 });
    expect(readPerson()?.name).toBe("Bayo");
    expect(readPerson()?.archetype).toBeNull();
  });

  // Nothing such as "Funmi, The developer · 23 years old" stands over the ready lives before a pick, and a ready life's
  // page strip names its district, never "<<28Y<<<" alone.
  test("[prologue:front-door-three-screens] [prologue:front-door-builds-a-person] given a run Settings asked for, then the ready lives name nothing beside the name before a pick, and a ready life's Where you live names its home and district, as a tile's does", () => {
    askReadyLives();
    door();
    expect(stage()).toBe("ready");
    // No path and no age beside the name: neither the first tile's nor any ready life's.
    expect(document.body.textContent).not.toMatch(/years old|\d+ yrs/);
    expect(document.body.textContent).not.toContain(" · ");
    fireEvent.click(screen.getByRole("button", { name: `${say("prologue.door.pick")}: ${say("scenario.tunde.kind")}` }));
    expect(stage()).toBe("page");
    // Every ready life starts in the family house, so its Where you live shows that home alone and names Surulere.
    expect(document.querySelector("[data-page-home]")?.getAttribute("data-page-home")).toBe("family-house");
    expect(document.querySelector("[data-page-home]")?.textContent).toBe(say("ui.page.home.family-house"));
    expect(document.querySelector("[data-home-stack] [data-front] [data-home-name]")?.textContent).toBe(`${say("ui.door.home.family-house")} · ${say("ui.door.home.where.family-house")}`);
    expect(board()).toContain("28 yrs");
    // Back to the ready lives with one picked, the pick's line stands beside the name.
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    expect(stage()).toBe("ready");
    expect(board()).toContain(say("scenario.tunde.kind"));
    expect(board()).toMatch(/28 yrs/);
  });

  test("[prologue:front-door-three-screens] given a screen past the first, then a back button returns to the screen before with its answers kept", () => {
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

  test("[prologue:age-advances-with-steps] [prologue:front-door-builds-a-person] [prologue:front-door-three-screens] given a tile, then the age under it is never typed: it starts at the year its path reaches, steps a year at a time up to three older inside 18 to 29, says what each step does, names Canada's age points only for a tile whose ways out count them, and Where you live says it as the page prints it", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.shop-worker.name") }));
    expect(document.querySelector("input")).toBeNull();
    const shop = archetypeOf("shop-worker")!;
    const lowest = startYearFor(shop, 0);
    const years = () => document.querySelector("[data-age-years]")?.textContent;
    const does = () => document.querySelector("[data-age-does]")?.textContent;
    expect(years()).toBe(say("prologue.door.age.years", { years: lowest }));
    // The shop worker's ways out count no age in points, so her own age says nothing of Canada.
    expect(does()).toBeUndefined();
    expect(ageStepWords(0, lowest, false)).toBe("");
    const younger = screen.getByRole<HTMLButtonElement>("button", { name: say("prologue.door.age.younger") });
    const older = screen.getByRole<HTMLButtonElement>("button", { name: say("prologue.door.age.older") });
    // Never below the year its path reaches.
    expect(younger.disabled).toBe(true);
    const open = stepsOpen(shop);
    for (let step = 1; step <= Math.max(...open); step += 1) {
      fireEvent.click(older);
      expect(years()).toBe(say("prologue.door.age.years", { years: lowest + step }));
      expect(does()).toBe(ageStepWords(step, lowest));
    }
    expect(older.disabled).toBe(true);
    expect(does()).toContain("passport");
    for (let step = Math.max(...open) - 1; step >= 0; step -= 1) {
      fireEvent.click(younger);
      expect(years()).toBe(say("prologue.door.age.years", { years: lowest + step }));
    }
    expect(younger.disabled).toBe(true);
    // Another tile starts again at its own age; the writer's ways out count age in Canada's points, so she is told how long is left.
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.writer.name") }));
    expect(years()).toBe(say("prologue.door.age.years", { years: startYearFor(archetypeOf("writer")!, 0) }));
    expect(does()).toBe(ageStepWords(0, startYearFor(archetypeOf("writer")!, 0)));
    expect(does()).toContain("Canada");
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.shop-worker.name") }));
    for (let step = 0; step < Math.max(...open); step += 1) fireEvent.click(older);
    fireEvent.click(next(say("ui.door.next")));
    expect(board()).toContain(say("prologue.page.age.years", { years: lowest + Math.max(...open) }));
  });

  test("[prologue:front-door-builds-a-person] [prologue:front-door-three-screens] given the door's screens, then you stand whole on a photo card as a sticker with your name stuck on it, never on a turntable, the lives carry your face, Where you live heads itself with it, and no scene is drawn behind any of them", () => {
    door();
    const name = nameBox().value;
    const look = document.querySelector("[data-gate]")?.getAttribute("data-look") ?? "";
    // The sky, not the band; the figure is the shooter's still of the look, never a canvas.
    expect(document.querySelector("[data-gate]")?.className).toContain("door-sky");
    expect(document.querySelector("[data-door-photo] [data-figure]")?.getAttribute("data-figure")).toBe(look);
    expect(document.querySelector("[data-door-name-chip]")?.textContent).toBe(name);
    for (const gone of ["canvas", "[data-turntable]", "[data-front-scene]", "[data-backdrop]", "[data-scrim]", "[data-stand-drag]"]) expect({ gone, there: document.querySelector(gone) !== null }).toEqual({ gone, there: false });
    expect(screen.queryByText(say("prologue.door.drag"))).toBeNull();
    // The question is the screen's one heading. Offline the screen opens with the start screen's hook and three steps
    // under it, a line and not a second heading, and no sentence about the game (text:hook-not-explanation).
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(say("ui.life.title"));
    expect(document.querySelector("[data-door-intro] p[data-start-hook]")).not.toBeNull();
    expect(document.querySelector("[data-door-intro] [data-start-steps]")).not.toBeNull();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    fireEvent.click(next(say("ui.door.next")));
    // Each life's card carries your own face beside its thing.
    expect(document.querySelectorAll(`[data-archetypes] [data-archetype] [data-face-sticker="${look}"]`)).toHaveLength(ARCHETYPES.length);
    expect(document.querySelectorAll("[data-archetypes] [data-archetype] [data-model]")).toHaveLength(ARCHETYPES.length);
    expect(document.querySelector("canvas")).toBeNull();
    fireEvent.click(next(say("ui.door.next")));
    expect(document.querySelector("[data-door-board] [data-face-sticker]")?.getAttribute("data-face-sticker")).toBe(look);
    expect(document.querySelector("canvas, [data-front-scene]")).toBeNull();
  });

  test("[prologue:front-door-three-screens] given each tile, then Where you live after the age offers a room of your own in Ojuelegba, a hostel room in Yaba and the family house in Surulere, in that order, for every tile, a room on the water in Makoko for the child of the water alone, each with the money the life starts with after moving in, as the band will show it, \"about\" where it is drawn, or for the room the figure still needed; the one picked in front as a postcard naming it and its place, with its line and its costs a month under it; the right one chosen for the tile; then the self-contain, always on the row, locked as the goal with its figure, saying \"reached\" beside the lock for a tile whose savings already reach it and never leaving; a home picked is kept through another tile while it can be paid", () => {
    const monthly = { "family-house": 9500000, "compound-room": 5000000, "hostel-room": 0, makoko: 2500000 } as const;
    // The room takes its year and the fees at once (home:compound-room-is-a-home): ₦350,000 and a fifth of it; the hostel nothing, as Makoko.
    const now = { "family-house": 0, "compound-room": 42000000, "hostel-room": 0, makoko: 0 } as const;
    const rent = { "family-house": 0, "compound-room": content.tuning.home.compound.rentYear, "hostel-room": content.tuning.home.hostelRentKobo, makoko: 0 } as const;
    const costsOf = (id: keyof typeof monthly): string => say(`ui.door.home.costs.${id}`, { amount: formatMoney(monthly[id], "NGN"), rent: formatMoney(rent[id], "NGN"), movein: formatMoney(now[id], "NGN") });
    for (const tile of ARCHETYPES) {
      // Each tile on a run of its own, so a home tried under one is never the pick the next one keeps.
      cleanup();
      localStorage.clear();
      door();
      fireEvent.click(next(say("ui.door.next")));
      fireEvent.click(screen.getByRole("radio", { name: say(`prologue.archetype.${tile.id}.name`) }));
      // Where you live is the screen after the age.
      expect(document.querySelector("[data-door-age]")).not.toBeNull();
      fireEvent.click(next(say("ui.door.next")));
      expect(stage()).toBe("page");
      const row = document.querySelector<HTMLElement>("[data-door-home]")!;
      const homes = [...row.querySelectorAll<HTMLElement>("[data-home]")];
      // Offered in this order: your own room, the hostel room, the family house last; Makoko for the child of the water.
      const offered = tile.id === "water" ? ["compound-room", "hostel-room", "family-house", "makoko"] : ["compound-room", "hostel-room", "family-house"];
      // The self-contain stands as the goal on every tile; one whose savings already reach its year and fees (the trader's,
      // the accountant's) says "reached" beside the lock, and the row stays.
      const reached = savingsOf(tile) >= selfContainYear();
      expect(selfContainReached(tile, 0)).toBe(reached);
      expect(homes.map((home) => home.dataset["home"])).toEqual([...offered, "self-contain"]);
      const own = tile.id === "water" ? "makoko" : "family-house";
      expect(homes.filter((home) => home.getAttribute("aria-checked") === "true").map((home) => home.dataset["home"])).toEqual([own]);
      // The home picked stands in front as a postcard naming it and its place, the others stacked behind it.
      expect(row.querySelector("[data-home-stack]")?.getAttribute("data-home-stack")).toBe(own);
      for (const home of homes.filter((one) => one.dataset["home"] !== "self-contain")) {
        const id = home.dataset["home"] as keyof typeof monthly;
        expect(home.textContent).toContain(say(`ui.door.home.${id}`));
        const left = savingsOf(tile) - now[id] - monthly[id];
        expect(pocketIn(tile, 0, id)).toBe(left);
        // What the band shows at Begin: the savings less the move-in, the month's living named apart.
        const start = savingsOf(tile) - now[id];
        expect(startIn(tile, 0, id)).toBe(start);
        // Only the room may be out of reach at a tile's own age: what is left after its year and fees covers no month there.
        const open = left >= 0;
        expect({ id, reachable: open || id === "compound-room" }).toEqual({ id, reachable: true });
        const figure = moneyDrawn(tile) ? say("ui.door.home.about", { amount: formatMoney(start, "NGN") }) : formatMoney(start, "NGN");
        const shown = open ? `${figure}${say("ui.door.home.start")}` : `${formatMoney(-left, "NGN")}${say("ui.door.home.needed")}`;
        expect({ id, shown: home.querySelector("[data-home-left]")?.textContent, shut: home.hasAttribute("disabled") }).toEqual({ id, shown, shut: !open });
        // A home reads out what the life starts with there, or for a shut one what is still needed, and its month's living;
        // a shut home's line and costs show once it can be picked.
        expect(home.getAttribute("aria-description")).toBe(say(open ? "ui.door.home.said.start" : "ui.door.home.said.needed", { amount: open ? figure : formatMoney(-left, "NGN"), monthly: formatMoney(monthly[id], "NGN") }));
        if (!open) continue;
        // Picked, it stands in front: its name and place on the postcard, its line in its own words and its costs with
        // the room's move-in, as chips (prologue:front-door-three-screens).
        fireEvent.click(home);
        expect(row.querySelector("[data-home-stack] [data-front] [data-home-name]")?.textContent).toBe(`${say(`ui.door.home.${id}`)} · ${say(`ui.door.home.where.${id}`)}`);
        expect(row.querySelector(`[data-home-detail='${id}'] [data-home-line]`)?.textContent).toBe(say(`ui.door.home.line.${id}`));
        const costs = row.querySelector(`[data-home-detail='${id}'] [data-home-costs]`);
        expect(costs?.getAttribute("aria-label")).toBe(costsOf(id));
        expect([...(costs?.querySelectorAll("[data-sticker-chip]") ?? [])].map((chip) => chip.textContent)).toEqual(costsOf(id).split(" · ").map((part) => part.charAt(0).toUpperCase() + part.slice(1)));
        // The postage stamp in front carries the same money to start.
        expect(row.querySelector("[data-home-stamp]")?.textContent).toBe(`${figure}${say("ui.door.home.start")}`);
      }
      const goal = homes.at(-1)!;
      expect(goal.tagName).not.toBe("BUTTON");
      expect(goal.getAttribute("role")).toBeNull();
      expect(goal.getAttribute("aria-disabled")).toBe("true");
      expect(goal.querySelector("svg.lucide-lock")).not.toBeNull();
      expect(goal.textContent).toBe(`${say("ui.door.home.self-contain")} · ${say("ui.door.home.where.self-contain")}${say("ui.door.home.costs.self-contain", { amount: formatMoney(84000000, "NGN") })}${say("ui.door.home.goal")}${reached ? say("ui.door.home.reached") : ""}`);
      expect(goal.querySelector("[data-home-reached]") !== null).toBe(reached);
    }
    cleanup();
    localStorage.clear();
    door();
    fireEvent.click(next(say("ui.door.next")));
    expect(say("ui.door.home.costs.family-house", { amount: "₦95,000" })).toBe("Your share about ₦95,000 a month, as you go · family around");
    expect(ARCHETYPES.filter((tile) => selfContainReached(tile, 0)).map((tile) => tile.id)).toEqual(["accountant", "trader"]);
    // The room's ₦50,000 is living costs, its rent a year's apart. The door says what moving in takes with the agent's and the agreement's fees, as Bills does,
    // then the year's rent after it.
    const { rentYear, feesBp, upkeep } = content.tuning.home.compound;
    expect(costsOf("compound-room")).toBe(`${formatMoney(rentYear + Math.floor((rentYear * feesBp) / 10000), "NGN")} to move in, then ${formatMoney(rentYear, "NGN")} a year · living ${formatMoney(upkeep, "NGN")} a month`);
    // The trade's settlement is drawn, so its figure is "about"; no other tile's is.
    expect(ARCHETYPES.filter((tile) => moneyDrawn(tile)).map((tile) => tile.id)).toEqual(["trader"]);
    // A home picked is kept through another tile; a home left as it was follows the tile.
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.developer.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "developer", home: "family-house" });
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.water.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "water", home: "makoko" });
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.family-house") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.nurse.name") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.water.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "water", home: "family-house", homePicked: true });
    // An older step adds its saving to what the life starts with.
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    fireEvent.click(next(say("ui.door.next")));
    const older = yearsWorked(1);
    expect(document.querySelector("[data-home='family-house'] [data-home-left]")?.textContent).toBe(`${formatMoney(savingsOf(archetypeOf("water")!) + older.saved, "NGN")}${say("ui.door.home.start")}`);
    // The room picked under the accountant, who holds its year and a month, is kept through the trader, who does too.
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.accountant.name") }));
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.trader.name") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "trader", home: "compound-room", homePicked: true });
  });

  test("[prologue:front-door-three-screens] given the writer, whose savings at her own age cover the room's year, its fees and a month of living with a little to spare, then the room is open with what she starts with over \"to start\", a year older starts with more, and the pick holds when she steps back to her own age", () => {
    door();
    fireEvent.click(next(say("ui.door.next")));
    fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.writer.name") }));
    fireEvent.click(next(say("ui.door.next")));
    const writer = archetypeOf("writer")!;
    // The year and the fees (home:compound-room-is-a-home) and the first month of living in the room, from the tile's savings.
    const left = savingsOf(writer) - (42000000 + 5000000);
    expect(left).toBeGreaterThan(0);
    const room = () => document.querySelector<HTMLButtonElement>("[data-home='compound-room']")!;
    expect(room().disabled).toBe(false);
    expect(room().querySelector("[data-home-left]")?.getAttribute("data-home-left")).toBe("start");
    // What she holds at Begin: the savings less the year and the fees; the month's living is said apart.
    expect(room().querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(left + 5000000, "NGN")}${say("ui.door.home.start")}`);
    expect(room().querySelector(".lucide-lock")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.older") }));
    fireEvent.click(next(say("ui.door.next")));
    const older = yearsWorked(1);
    expect(room().querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(left + 5000000 + older.saved, "NGN")}${say("ui.door.home.start")}`);
    fireEvent.click(screen.getByRole("radio", { name: say("ui.door.home.compound-room") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "writer", home: "compound-room", homePicked: true });
    // A step back to her own age keeps the room: it is still open there.
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.back") }));
    fireEvent.click(screen.getByRole("button", { name: say("prologue.door.age.younger") }));
    expect(JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}")).toMatchObject({ archetype: "writer", home: "compound-room", homePicked: true });
  });

  test("[prologue:front-door-three-screens] given a tile whose savings cannot cover the family house, then that home says the shortfall over \"short\" with a lock and cannot be picked, the room says what is still needed, and the home goes to the one the life can pay for", () => {
    // Makoko is the child of the water's alone, so her tile carries the case.
    const key = "prologue.archetype.water.savings";
    const kept = text[key];
    text[key] = "50000";
    try {
      door();
      fireEvent.click(next(say("ui.door.next")));
      fireEvent.click(screen.getByRole("radio", { name: say("prologue.archetype.water.name") }));
      fireEvent.click(next(say("ui.door.next")));
      const house = document.querySelector<HTMLButtonElement>("[data-home='family-house']")!;
      expect(house.disabled).toBe(true);
      expect(house.querySelector("[data-home-left]")?.getAttribute("data-home-left")).toBe("short");
      expect(house.querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(9500000 - 5000000, "NGN")}${say("ui.door.home.short")}`);
      expect(house.querySelector(".lucide-lock")).not.toBeNull();
      const room = document.querySelector<HTMLButtonElement>("[data-home='compound-room']")!;
      expect(room.disabled).toBe(true);
      expect(room.querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(42000000 + 5000000 - 5000000, "NGN")}${say("ui.door.home.needed")}`);
      const water = document.querySelector<HTMLButtonElement>("[data-home='makoko']")!;
      expect(water.disabled).toBe(false);
      expect(water.getAttribute("aria-checked")).toBe("true");
      expect(water.querySelector("[data-home-left]")?.textContent).toBe(`${formatMoney(5000000, "NGN")}${say("ui.door.home.start")}`);
      expect(water.querySelector(".lucide-lock")).toBeNull();
      expect(fitHome(archetypeOf("water")!, 0, { home: "family-house", homePicked: true })).toBe("makoko");
      expect(pocketIn(archetypeOf("water")!, 0, "family-house")).toBe(5000000 - 9500000);
    } finally {
      if (kept === undefined) delete text[key];
      else text[key] = kept;
    }
  });
});
