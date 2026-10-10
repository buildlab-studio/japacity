// The data page stays with the character (prologue.md R-PROLOGUE-009): the name over the age in the band opens it; it
// shows the age kept current, how ready they are and a stamp for each step taken toward leaving; a close returns.
import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { keepPerson } from "../../authority/person";
import { createGameStore, type GameStore } from "../../authority/store";
import { lookOf } from "../frontdoor/looks";
import { clockWords } from "../words/quality";
import { say } from "../words/text";
import { Band } from "../world/Band";
import { stampsOf } from "./stamps";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

afterEach(() => {
  localStorage.clear();
});

async function life(scenario: "scenario.ada" | "scenario.prologue", person: Parameters<typeof keepPerson>[0] | null): Promise<GameStore> {
  if (person !== null) keepPerson(person);
  const authority = localAuthority({ fastClock: true, storage: null, makeSeed: () => "page-seed", now: () => 0 });
  const store = createGameStore(authority, { life: authority, lifeAgain: true, choosingLife: true });
  await store.getState().chooseLife(scenario);
  return store;
}

function band(store: GameStore, when = "23 yrs 4 mo") {
  render(
    <GameProvider store={store}>
      <Band when={when} name="The family house" money={0} formatMoney={String} onEndMonth={() => undefined} />
    </GameProvider>,
  );
}

const opener = () => screen.getByRole("button", { name: say("prologue.page.open") });

describe("the page from the band", () => {
  test("[R-PROLOGUE-009] given a send-off card kept with its japa type, when the page opens, then the type stands on it by its name; before the send-off there is no such row (decision 0018)", async () => {
    const store = await life("scenario.ada", { look: "chr_kemi", name: "Morenike", archetype: null });
    const view = store.getState().view!;
    band(store, clockWords(view.qualities));
    fireEvent.click(opener());
    expect(document.querySelector("[data-page] [data-field='type']")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("prologue.page.close") }));
    // The gallery keeps the send-off card with the type read at the send-off (decision 0018).
    localStorage.setItem("japacity.cards", JSON.stringify([{ key: "send-off:1", scenario: "scenario.ada", card: { kind: "send-off", months: 1 }, type: "careful-saver" }]));
    fireEvent.click(opener());
    const field = document.querySelector("[data-page] [data-field='type']");
    expect(field?.textContent).toContain(say("prologue.page.type"));
    expect(field?.textContent).toContain(say("share.type.careful-saver.name"));
  });


  test("[R-PROLOGUE-009] given a life with its person kept, then the band shows the name over the age, and a tap opens the page with the name, the photo, the age now, what the life was and how ready", async () => {
    const store = await life("scenario.ada", { look: "chr_kemi", name: "Morenike", archetype: null });
    const view = store.getState().view!;
    band(store, clockWords(view.qualities));
    // The name over the age, as the design's bar has it.
    const person = document.querySelector<HTMLElement>("[data-band-person]")!;
    expect(person.textContent.indexOf("Morenike")).toBeGreaterThanOrEqual(0);
    expect(person.textContent.indexOf("Morenike")).toBeLessThan(person.textContent.indexOf(clockWords(view.qualities)));
    expect(opener().textContent).toBe(clockWords(view.qualities));
    // The place's name stays the band's heading, and a tap on it does nothing (R-WORLD-002).
    expect(screen.getByRole("heading", { name: "The family house" })).toBeDefined();
    fireEvent.click(opener());
    const sheet = screen.getByRole("dialog", { name: say("prologue.door.page.title") });
    const page = sheet.querySelector<HTMLElement>("[data-page]")!;
    expect(page.querySelector("[data-field='name']")?.textContent).toContain("Morenike");
    expect(page.querySelector("[data-field='age']")?.textContent).toContain(clockWords(view.qualities));
    expect(page.querySelector("[data-field='path']")?.textContent).toContain(say("scenario.ada.kind"));
    expect(page.querySelector("[data-field='ready']")?.textContent).toContain(say("prologue.page.ready.figure", { percent: view.japacity.percent ?? 0 }));
    expect(page.querySelector<HTMLImageElement>("[data-photo] img")?.getAttribute("src")).toBe(lookOf("chr_kemi")!.picture);
    // No step taken yet: no stamp, and the page says how one comes.
    expect(page.querySelector("[data-stamps]")).toBeNull();
    expect(sheet.textContent).toContain(say("prologue.page.stamps.none"));
    fireEvent.click(within(sheet).getByRole("button", { name: say("prologue.page.close") }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[R-PROLOGUE-009] given the view moving on, then the open page keeps the age current and stamps the steps the view shows", async () => {
    const store = await life("scenario.ada", { look: "chr_kemi", name: "Morenike", archetype: null });
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
    expect(page.querySelector("[data-field='age']")?.textContent).toContain(clockWords(older.qualities));
    const stamps = [...page.querySelectorAll("[data-stamps] [data-stamp]")].map((stamp) => stamp.textContent);
    expect(stamps).toEqual(stampsOf(older));
    expect(stamps).toContain(say("prologue.page.stamp.papers"));
    expect(page.textContent).toContain(say("prologue.page.stamps.some"));
  });

  test("[R-PROLOGUE-009] given a life from a tile, then the page says the tile's name as what the life was", async () => {
    const store = await life("scenario.prologue", { look: "chr_tobi", name: "Dayo", archetype: "trader" });
    band(store);
    fireEvent.click(opener());
    expect(screen.getByRole("dialog").querySelector("[data-field='path']")?.textContent).toContain(say("prologue.archetype.trader.name"));
  });

  test("[R-PROLOGUE-009] given no game around the band, then it shows the age alone, with nothing to open", () => {
    render(<Band when="Month 6" name="Home" money={0} formatMoney={String} onEndMonth={() => undefined} />);
    expect(screen.getByText("Month 6")).toBeDefined();
    expect(screen.queryByRole("button", { name: say("prologue.page.open") })).toBeNull();
  });
});
