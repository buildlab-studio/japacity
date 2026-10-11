// Their room in the world, dressed for the person whose room it is (docs/rules/world.md R-WORLD-020; city.md R-CITY-011,
// R-CITY-001; people.md R-PEOPLE-014, R-PEOPLE-054): with Tobi's bond courting, the city draws his room
// with his props and him standing in it, a thing with his name and the computer mark and no act, and the visit stays on
// the chair. The place file is the one the game ships; the scene is a stand-in that shows what the city hands it.
import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import theirRoom from "../../../public/assets/places/their-room/place.json";
import { courted, peopleGame, renderWithGame, TOBI } from "../../shared/testing/people";
import { nameOf, say } from "../../shared/words/text";
import type { Thing } from "../../shared/world/contract";
import { chipNode } from "./chip";
import { City } from "./City";
import { standingAsThemselves, THEIR_ROOM } from "./meetings";
import { dressPlace, type PlaceFile, stageOf } from "./placeFile";

vi.mock("./CityScene", () => ({
  default: ({ file, things, onPick }: { file: PlaceFile; things?: Thing[]; onPick: (pick: { kind: "thing"; thing: Thing }) => void }) => (
    <div data-stand-in-scene>
      {(file.stage?.models ?? []).map((model) => (
        <span key={model.file} data-stand-in-model={model.file} />
      ))}
      {(file.stage?.standing ?? []).map((one) => (
        <span key={`${one.thing}:${one.file}`} data-stand-in-stander={one.thing} data-person={one.person} data-file={one.file} />
      ))}
      {(things ?? []).map((thing) => (
        <button key={thing.id} type="button" data-stand-in-thing={thing.id} data-label={thing.label} data-mark={thing.mark ?? ""} data-acts={thing.acts.map((one) => one.stages ?? one.kind).join("|")} onClick={() => onPick({ kind: "thing", thing })} />
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

const ROOM = theirRoom as unknown as PlaceFile;

beforeEach(() => {
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify([THEIR_ROOM]));
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

describe("their room in the world", () => {
  test("[R-WORLD-020] [R-CITY-011] [R-PEOPLE-054] [R-CITY-001] given Tobi's bond courting, when their room is drawn, then it is dressed for Tobi: his props stand in it, his figure stands as a thing named by him with the computer mark and no act, the visit stays on the chair, and a tap on him sends nothing", async () => {
    const game = peopleGame();
    game.grant(1);
    game.endTurn([]);
    courted(game, TOBI);
    const { authority } = await renderWithGame(<City world results={() => <p />} />, game);
    const tobi = await waitFor(() => found('[data-stand-in-stander="partner"]'));
    const dressing = ROOM.stage?.dressings?.find((one) => one.person === TOBI);
    expect(tobi.dataset.person).toBe(TOBI);
    expect(tobi.dataset.file).toBe(dressing?.standing?.[0]?.file);
    for (const model of dressing?.models ?? []) expect(document.querySelector(`[data-stand-in-model="${model.file}"]`)).not.toBeNull();
    const thing = found('[data-stand-in-thing="partner"]');
    expect([thing.dataset.label, thing.dataset.mark, thing.dataset.acts]).toEqual([`${TOBI}.name`, "computer", ""]);
    expect(found('[data-stand-in-thing="time-together"]').dataset.acts).toBe("activity.see-someone");
    expect(found('[data-stand-in-thing="door"]').dataset.acts).toBe("out");
    // Nobody but Tobi stands here.
    expect(document.querySelectorAll("[data-stand-in-stander]")).toHaveLength(1);
    const before = authority.sent.length;
    fireEvent.click(thing);
    expect(authority.sent).toHaveLength(before);
  });

  test("[R-WORLD-020] given no bond courting, when their room is drawn, then it is the plain room with nobody standing in it", async () => {
    const game = peopleGame();
    game.grant(1);
    game.endTurn([]);
    await renderWithGame(<City world results={() => <p />} />, game);
    await waitFor(() => found('[data-stand-in-thing="door"]'));
    expect(document.querySelector("[data-stand-in-stander]")).toBeNull();
    expect(document.querySelector('[data-stand-in-thing="partner"]')).toBeNull();
    expect([...document.querySelectorAll<HTMLElement>("[data-stand-in-model]")].map((one) => one.dataset.standInModel)).toEqual(ROOM.stage?.models.map((model) => model.file));
  });

  test("[R-PEOPLE-054] [R-WORLD-020] given Tobi standing in his room, when he is tapped, then his chip shows his name with the computer tag and no act, since the bond's choices live in Chats and the visit on the chair", () => {
    const [tobi] = standingAsThemselves(stageOf(dressPlace(ROOM, [], TOBI).file));
    expect(tobi).toBeDefined();
    const chip = chipNode(tobi!, () => undefined);
    expect(chip.querySelector("p")?.textContent).toBe(`${nameOf(TOBI)}${say("ui.people.mark.computer")}`);
    expect(chip.querySelector('[data-person-mark="computer"]')).not.toBeNull();
    expect(chip.querySelectorAll("button")).toHaveLength(0);
  });
});
