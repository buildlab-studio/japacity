// The data page stays with the character (prologue:front-door-builds-a-person): the name over the age in the band opens it; it
// shows the age kept current, how ready they are and a stamp for each step taken toward leaving; a close returns.
import type { PlayerView } from "@japacity/sim";
import { qualityIn } from "@japacity/sim";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { keepPerson } from "../front-door/person";
import { createGameStore, type GameStore } from "../../authority/store";
import { lookOf } from "../front-door/looks";
import { AGE, clockWords, yearsOf } from "../words/quality";
import { readyWords } from "../words/ready";
import { say } from "../words/text";
import { TopBand } from "../world/TopBand";
import { stripLines } from "./DataPage";
import { familyCard } from "./family";
import { stampsOf } from "./stamps";
// Registers Testing Library's cleanup for this file.
import "../testing/render";
import { TRAIL_KEY } from "../kept/storage";

/** The age in months the view holds. */
function ageOf(view: Pick<PlayerView, "qualities">): number {
  return qualityIn(view, AGE);
}

afterEach(() => {
  localStorage.clear();
});

async function life(scenario: "scenario.graduate" | "scenario.prologue", person: Parameters<typeof keepPerson>[0] | null): Promise<GameStore> {
  if (person !== null) keepPerson(person);
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "page-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  await store.getState().chooseLife(scenario);
  return store;
}

function band(store: GameStore, when = "23 yrs 4 mo") {
  render(
    <GameProvider store={store}>
      <TopBand when={when} name="The family house" money={0} formatMoney={String} />
    </GameProvider>,
  );
}

const opener = () => screen.getByRole("button", { name: say("prologue.page.open") });

describe("the page from the band", () => {
  test("[prologue:front-door-builds-a-person] given a send-off card kept with its japa type, when the page opens, then the type stands on it by its name; before the send-off there is no such row (decision 0024)", async () => {
    const store = await life("scenario.graduate", { look: "person_kemi", name: "Morenike", archetype: null });
    const view = store.getState().view!;
    band(store, clockWords(view.qualities));
    fireEvent.click(opener());
    expect(document.querySelector("[data-page] [data-field='type']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("prologue.page.close") }));
    // The gallery keeps the send-off card with the type read at the send-off (decision 0024).
    localStorage.setItem("japacity.cards", JSON.stringify([{ key: "send-off:1", scenario: "scenario.graduate", card: { kind: "send-off", months: 1 }, type: "careful-saver" }]));
    fireEvent.click(opener());
    const field = document.querySelector("[data-page] [data-field='type']");
    expect(field?.textContent).toContain(say("prologue.page.type"));
    expect(field?.textContent).toContain(say("share.type.careful-saver.name"));
  });


  test("[prologue:front-door-builds-a-person] given a life with its person kept, then the band shows the name over the age, and a tap opens the page with the name, the photo, the age now, what the life was and how ready", async () => {
    const store = await life("scenario.graduate", { look: "person_kemi", name: "Morenike", archetype: null });
    const view = store.getState().view!;
    band(store, clockWords(view.qualities));
    // The name over the age.
    const person = document.querySelector<HTMLElement>("[data-band-person]")!;
    expect(person.textContent.indexOf("Morenike")).toBeGreaterThanOrEqual(0);
    expect(person.textContent.indexOf("Morenike")).toBeLessThan(person.textContent.indexOf(clockWords(view.qualities)));
    expect(opener().textContent).toBe(clockWords(view.qualities));
    // The place's name stays the band's heading, and a tap on it does nothing (world:top-band-is-lively-pill).
    expect(screen.getByRole("heading", { name: "The family house" })).toBeDefined();
    fireEvent.click(opener());
    const sheet = screen.getByRole("dialog", { name: say("prologue.door.page.title") });
    const page = sheet.querySelector<HTMLElement>("[data-page]")!;
    expect(page.querySelector("[data-field='name']")?.textContent).toContain("Morenike");
    // The page's age is the years with their word; the band keeps years and months.
    expect(page.querySelector("[data-field='age']")?.textContent).toBe(`${say("prologue.page.age")}${say("prologue.page.age.years", { years: yearsOf(ageOf(view)) })}`);
    expect(page.querySelector("[data-field='age']")?.textContent).not.toContain(clockWords(view.qualities));
    expect(page.querySelector("[data-field='path']")?.textContent).toContain(say("scenario.graduate.kind"));
    expect(page.querySelector("[data-field='ready']")?.textContent).toContain(readyWords(view.japacity.percent ?? 0));
    expect(page.querySelector("[data-field='ready']")?.textContent).not.toContain("%");
    expect(page.querySelector<HTMLImageElement>("[data-photo] img")?.getAttribute("src")).toBe(lookOf("person_kemi")!.picture);
    // No visa yet: no stamp, and the page says the visa's is the first.
    expect(page.querySelector("[data-stamp]")).toBeNull();
    expect(sheet.textContent).toContain(say("ui.page.stamps.none"));
    fireEvent.click(within(sheet).getByRole("button", { name: say("prologue.page.close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[account:person-kept-with-character] given a ready life with no person kept on this phone, then the band says You over the age, and the page's name says You", async () => {
    const store = await life("scenario.graduate", null);
    const view = store.getState().view!;
    band(store, clockWords(view.qualities));
    const person = document.querySelector<HTMLElement>("[data-band-person]")!;
    const you = say("prologue.page.you");
    expect(you).toBe("You");
    expect(person.textContent.indexOf(you)).toBe(0);
    expect(person.textContent.indexOf(you)).toBeLessThan(person.textContent.indexOf(clockWords(view.qualities)));
    fireEvent.click(opener());
    const page = screen.getByRole("dialog", { name: say("prologue.door.page.title") }).querySelector<HTMLElement>("[data-page]")!;
    expect(page.querySelector("[data-field='name']")?.textContent).toContain(you);
  });

  test("[prologue:front-door-builds-a-person] given the view moving on, then the open page keeps the age current, takes no stamp for the passport, and the visa's round stamp once it is granted", async () => {
    const store = await life("scenario.graduate", { look: "person_kemi", name: "Morenike", archetype: null });
    band(store);
    fireEvent.click(opener());
    const view = store.getState().view!;
    const older: PlayerView = {
      ...view,
      qualities: view.qualities.map((quality) => (quality.id === "quality.age-months" ? { ...quality, value: quality.value + 3 } : quality)),
      documents: [{ id: "document.passport", state: "held", readyMonth: null, expiresMonth: 70, value: null, onItsWay: null }],
    };
    store.setState({ view: older });
    const page = await screen.findByRole("dialog");
    expect(page.querySelector("[data-field='age']")?.textContent).toBe(`${say("prologue.page.age")}${say("prologue.page.age.years", { years: yearsOf(ageOf(older)) })}`);
    // The passport is a step before the visa: it stamps nothing.
    expect(page.querySelector("[data-stamp]")).toBeNull();
    const route = "route.uk-care" as const;
    const granted: PlayerView = { ...older, routes: older.routes.map((one) => (one.id === route ? { ...one, state: "granted" } : one)), plan: { route, ways: [{ route, percent: 100 }] } };
    store.setState({ view: granted });
    const visa = await screen.findByText(say("prologue.page.stamp.granted"));
    expect(visa.closest("[data-stamp-visa]")).not.toBeNull();
    expect(visa.closest("[data-stamp-round]")?.textContent).toBe(`${say("prologue.page.stamp.granted")}${say(`prologue.page.way.${route}`)}`);
    expect(stampsOf(granted)).toHaveLength(1);
    expect(page.textContent).toContain(say("ui.page.stamps.some"));
  });

  test("[prologue:front-door-builds-a-person] given a life from a tile, then the page says the tile's name as the path and its one line as what the life was so far", async () => {
    const store = await life("scenario.prologue", { look: "person_tobi", name: "Dayo", archetype: "trader" });
    band(store);
    fireEvent.click(opener());
    expect(screen.getByRole("dialog").querySelector("[data-field='path']")?.textContent).toContain(say("prologue.archetype.trader.name"));
    expect(screen.getByRole("dialog").querySelector("[data-field='was']")?.textContent).toContain(say("prologue.archetype.trader.was"));
  });

  test("[prologue:front-door-builds-a-person] given the family the prologue drew kept on the device, then the band's page prints its means on the FAMILY line and the strip carries the name, the home's district, the age and how ready", async () => {
    localStorage.setItem(TRAIL_KEY, JSON.stringify({ draw: { familyMeans: 50, town: "city", siblings: 2, parentsEducated: true }, steps: [] }));
    const store = await life("scenario.graduate", { look: "person_kemi", name: "Morenike", archetype: null });
    band(store);
    fireEvent.click(opener());
    const view = store.getState().view!;
    const page = screen.getByRole("dialog").querySelector<HTMLElement>("[data-page]")!;
    // prologue:front-door-builds-a-person: the card's title says where the family is; the FAMILY line keeps its means.
    expect(page.querySelector("[data-field='family']")?.textContent).toContain(familyCard({ familyMeans: 50, town: "city", siblings: 2, parentsEducated: true }, false).means);
    const months = qualityIn(view, "quality.age-months");
    const lines = stripLines("Morenike", { district: say("ui.door.home.where.family-house"), years: yearsOf(months), percent: view.japacity.percent ?? 0 });
    expect(view.home.place).toBe("place.family-house");
    expect(page.querySelector("[data-page-strip]")?.textContent).toBe(lines.join(""));
    expect(lines[1]).toMatch(/^SURULERE<</);
  });

  test("[prologue:front-door-builds-a-person] [prologue:family-draw-on-first-answer] given a ready life from Enugu, when its page opens from the band, then FROM prints Enugu before FAMILY, as a passport names a place of birth", async () => {
    const store = await life("scenario.graduate", { look: "person_kemi", name: "Morenike", archetype: null });
    expect(store.getState().view?.hometown).toBe("hometown.enugu");
    band(store);
    fireEvent.click(opener());
    const page = screen.getByRole("dialog").querySelector<HTMLElement>("[data-page]")!;
    expect(page.querySelector("[data-field='from']")?.textContent).toBe(`${say("ui.page.field.from")}Enugu`);
    expect(say("ui.page.field.from")).toBe("From");
  });

  test("[prologue:front-door-builds-a-person] given no game around the band, then it shows the age alone, with nothing to open", () => {
    render(<TopBand when="Month 6" name="Home" money={0} formatMoney={String} />);
    expect(screen.getByText("Month 6")).toBeDefined();
    expect(screen.queryByRole("button", { name: say("prologue.page.open") })).toBeNull();
  });
});
