// Their room in the world, dressed for the person whose room it is (world:nobody-picked-from-list; city:set-piece-shown-where-staged,
// city:places-change-no-state; person:time-together-is-an-act, person:computer-mark-is-quiet): with Tobi's bond courting, the city draws his room
// with his props and him standing in it, a thing with his name and the computer mark and no act, and the visit stays on
// the chair. The place file is the one the game ships; the scene is a stand-in that shows what the city hands it.
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import theirRoom from "../../../public/assets/places/their-room/place.json";
import { courted, peopleGame, renderWithGame, TOBI } from "../../shared/testing/person";
import { nameOf, say } from "../../shared/words/text";
import type { Thing } from "../../shared/world/contract";
import { City } from "./City";
import { anchorFan } from "./fan/anchor";
import { Fan } from "./fan/Fan";
import { fanEntriesOf } from "./fan/fanActs";
import { standingAsThemselves, THEIR_ROOM } from "./meetings";
import { dressPlace, type PlaceFile, stageOf } from "../../shared/scene/placeFile";
import { stubWebGL, unstubWebGL } from "../../shared/testing/webgl";
import { found } from "../../shared/testing/render";

vi.mock("./scene/CityScene", () => ({
  default: ({ file, people, things, onPick }: { file: PlaceFile; people: unknown[]; things?: Thing[]; onPick: (pick: { kind: "thing"; thing: Thing }) => void }) => (
    <div data-stand-in-scene data-crowd={people.length}>
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
vi.mock("../../shared/three/manifest", async (original) => (await import("../../shared/testing/manifest")).fromDisk(original));

const ROOM = theirRoom as unknown as PlaceFile;

beforeEach(() => {
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  stubWebGL();
  window.localStorage.setItem("japacity.city.last", JSON.stringify([THEIR_ROOM]));
});

afterEach(() => {
  vi.restoreAllMocks();
  unstubWebGL();
  window.localStorage.clear();
});

describe("their room in the world", () => {
  test("[world:nobody-picked-from-list] [city:set-piece-shown-where-staged] [person:computer-mark-is-quiet] [city:places-change-no-state] given Tobi's bond courting, when their room is drawn, then it is dressed for Tobi: his props stand in it, his figure stands alone as a thing named by him with the computer mark and no act, no stranger in the room, the visit stays on the chair, and a tap on him sends nothing", async () => {
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
    // Nobody but Tobi stands here: no stranger of the crowd either.
    expect(document.querySelectorAll("[data-stand-in-stander]")).toHaveLength(1);
    expect(found("[data-stand-in-scene]").dataset.crowd).toBe("0");
    const before = authority.sent.length;
    fireEvent.click(thing);
    expect(authority.sent).toHaveLength(before);
  });

  test("[world:nobody-picked-from-list] given no bond courting, when their room is drawn, then it is the plain room with nobody standing in it", async () => {
    const game = peopleGame();
    game.grant(1);
    game.endTurn([]);
    await renderWithGame(<City world results={() => <p />} />, game);
    await waitFor(() => found('[data-stand-in-thing="door"]'));
    expect(document.querySelector("[data-stand-in-stander]")).toBeNull();
    expect(document.querySelector('[data-stand-in-thing="partner"]')).toBeNull();
    expect([...document.querySelectorAll<HTMLElement>("[data-stand-in-model]")].map((one) => one.dataset.standInModel)).toEqual(ROOM.stage?.models.map((model) => model.file));
  });

  test("[person:computer-mark-is-quiet] [world:nobody-picked-from-list] given Tobi standing in his room, when he is tapped, then his fan shows his name with the computer tag and no act, since the bond's choices live in Chats and the visit on the chair", () => {
    const [tobi] = standingAsThemselves(stageOf(dressPlace(ROOM, [], TOBI).file));
    expect(tobi).toBeDefined();
    expect(fanEntriesOf(tobi!)).toEqual([]);
    const onFallback = vi.fn();
    render(<Fan thing={tobi!.id} title={nameOf(TOBI)} mark={tobi!.mark} entries={[]} onAct={vi.fn()} onFallback={onFallback} />);
    act(() => anchorFan(tobi!.id, { x: 195, y: 420 }));
    const fan = found(`[data-fan="${tobi!.id}"]`);
    expect(fan.querySelector("[data-fan-title]")?.textContent).toBe(`${nameOf(TOBI)}${say("ui.people.mark.computer")}`);
    expect(fan.querySelector('[data-person-mark="computer"]')).not.toBeNull();
    expect(fan.querySelectorAll("button")).toHaveLength(0);
    expect(onFallback).not.toHaveBeenCalled();
  });
});
