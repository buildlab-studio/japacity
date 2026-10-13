// The way home by choice in the world (docs/rules/return.md R-RETURN-002, R-RETURN-006; place.md R-PLACE-011): the room
// abroad's bag carries Go home, its card says the shape the return would take today in one line, what ends and what waits
// as chips, the fare on the one yellow button, and the button sends `return/home`. Nothing else in the world sends it. The
// scene is a stand-in that hands the city the taps a player makes; the place file is the one the game ships.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { PlayerView } from "@japacity/sim";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import raw from "../../../public/assets/places/the-room/place.json";
import { abroadGame, setPockets } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/people";
import { formatMoney } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import type { Act, Thing } from "../../shared/world/contract";
import { City } from "./City";
import { goHomeAsk, goHomeOffered } from "./goHome";
import { type PlaceFile, stageOf } from "./placeFile";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

vi.mock("./CityScene", () => ({
  default: ({ things, onPick }: { things?: Thing[]; onPick: (pick: Pick) => void }) => (
    <div data-stand-in-scene>
      {(things ?? []).map((thing) => (
        <span key={thing.id}>
          {thing.acts.map((one) => (
            <button key={one.id} type="button" data-stand-in-act={`${thing.id}:${one.id}`} onClick={() => onPick({ kind: "act", thing, act: one })} />
          ))}
        </span>
      ))}
    </div>
  ),
}));

// The place files the game ships, read from the disk in place of the server.
vi.mock("../../shared/three/manifest", async (original) => {
  const real = await original<typeof import("../../shared/three/manifest")>();
  const fs = await import("node:fs");
  const path = await import("node:path");
  const assets = path.join(import.meta.dirname, "..", "..", "..", "public", "assets");
  return {
    ...real,
    loadManifest: () => Promise.resolve({ files: {} }),
    loadJson: (_manifest: unknown, under: string) => {
      const file = path.join(assets, under);
      return Promise.resolve(fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as unknown) : null);
    },
  };
});

beforeEach(() => {
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.the-room"]));
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

const hands = { who: "The shared room", go: () => undefined, dismiss: () => undefined };

/** A landed life's place with its way home set as the engine would forecast it. */
function withWay(way: Partial<NonNullable<PlayerView["place"]["wayHome"]>>): PlayerView {
  const view = abroadGame().view();
  const home = view.place.wayHome;
  if (home === null) throw new Error("Ada abroad has no way home");
  return { ...view, place: { ...view.place, wayHome: { ...home, ...way } } };
}

describe("the bag's Go home", () => {
  test("[R-RETURN-006] [R-PLACE-011] given the room abroad's place file, when the bag's acts are read, then it packs for the next flight and goes home, and Go home sends return/home and nothing else in the world does", () => {
    const stage = stageOf(raw as unknown as PlaceFile);
    const bag = (stage.things ?? []).find((thing) => thing.id === "bag");
    expect(bag?.acts.map((act) => [act.id, act.kind, act.command])).toEqual([
      ["pack", "command", "route/depart"],
      ["go-home", "command", "return/home"],
    ]);
    const others = (stage.things ?? []).flatMap((thing) => thing.acts.filter((act) => act.command === "return/home").map(() => thing.id));
    expect(others).toEqual(["bag"]);
  });

  test("[R-RETURN-002] [R-RETURN-006] given Ada landed in London with the fare in pounds, when the bag's Go home is tapped, then the card says the return in one line, what ends and what waits as chips, the fare on the one button, and the button sends return/home", async () => {
    const game = abroadGame();
    setPockets(game, { GBP: 400_000 });
    const way = game.view().place.wayHome;
    if (way === null || way.shape === null) throw new Error("Ada abroad has no way home today");
    const { authority } = await renderWithGame(<City world />, game);
    fireEvent.click(await waitFor(() => found('[data-stand-in-act="bag:go-home"]'), { timeout: 3000 }));
    const card = await screen.findByRole("dialog");
    expect(within(card).getByRole("heading").textContent).toBe(say("ui.world.go-home"));
    expect(card.textContent).toContain(say(`ui.world.go-home.line.${way.shape}`));
    const facts = [...card.querySelectorAll("[data-ask-facts] [data-sticker-chip]")].map((chip) => chip.textContent);
    expect(facts.slice(0, 2)).toEqual([say("ui.world.go-home.status"), say("ui.world.go-home.family")]);
    const main = found("[data-ask-main]");
    expect(main.textContent).toContain(formatMoney(way.fare.amount, way.fare.currency));
    expect(card.querySelectorAll("[data-ask-main]")).toHaveLength(1);
    // R-RETURN-006: the bills abroad close on the way home, so the button warns of no dues there.
    expect(main.querySelector("[data-ask-warn]")).toBeNull();
    fireEvent.click(main);
    await waitFor(() => expect(authority.sent.map((command) => command.type)).toContain("return/home"));
  });

  test("[R-RETURN-002] given the standing the shape brings, when the card is drawn, then it says the move in words and never the figure", () => {
    for (const [standing, key] of [
      [10, "ui.world.go-home.standing.up"],
      [0, "ui.world.go-home.standing.same"],
      [-8, "ui.world.go-home.standing.down"],
    ] as const) {
      const ask = goHomeAsk(withWay({ shape: "by-choice", standing, paidFrom: "local" }), hands);
      expect(ask?.facts).toContain(say(key));
      expect((ask?.facts ?? []).join(" ")).not.toMatch(/\d/);
    }
  });

  test("[R-PLACE-011] [R-RETURN-002] given the assisted ticket, a fare out of reach and no way at all, when the card is drawn, then the agency's ticket costs nothing, the short fare shuts the button, and no way says so with no chips", () => {
    const assisted = goHomeAsk(withWay({ shape: "assisted", paidFrom: null }), hands);
    expect([assisted?.title, assisted?.button, assisted?.cost, assisted?.blocked]).toEqual([say("ui.world.go-home.title.assisted"), say("ui.world.go-home.button.assisted"), null, undefined]);
    const short = goHomeAsk(withWay({ shape: "broke", paidFrom: null }), hands);
    expect(short?.blocked).toBe(say("ui.world.go-home.short"));
    const none = goHomeAsk(withWay({ shape: null }), hands);
    expect([none?.blocked, none?.line, none?.facts]).toEqual([say("ui.world.go-home.none"), say("ui.world.go-home.line.none"), undefined]);
    const naira = goHomeAsk(withWay({ shape: "by-choice", paidFrom: "naira", naira: 1_200_000_00 }), hands);
    expect(naira?.cost).toEqual({ amount: 1_200_000_00, currency: "NGN" });
  });

  test("[R-PLACE-011] given a life at home or one that has ended, then the bag offers no Go home", () => {
    const view = abroadGame().view();
    expect(goHomeOffered(view)).toBe(true);
    expect(goHomeOffered({ ...view, ended: true })).toBe(false);
    expect(goHomeOffered({ ...view, place: { ...view.place, where: "home", wayHome: null } })).toBe(false);
  });
});
