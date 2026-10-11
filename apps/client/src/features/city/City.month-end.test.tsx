// The bed's month end, the player's own figure and a thing's chip over the world (docs/rules/world.md R-WORLD-025,
// R-WORLD-008, R-WORLD-005, R-WORLD-003, R-WORLD-014). The bed's Next month
// ends the month as the band's does: the lock screen's lines are a preview, and putting the phone away opens the
// results. A tap on your own figure opens nothing. A chip hides the nudge only while it is open: a tap anywhere
// outside it, Escape or its sheet's close puts it away and the nudge comes back by itself; a person's or a shopfront's
// card does the same and sits at the foot of the screen. A reload opens inside the house when the player last stopped
// there. The place file is the one
// the game ships; the scene is a stand-in that hands the city the taps a player makes.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/people";
import { plannable } from "../../shared/words/acts";
import { say } from "../../shared/words/text";
import type { Act, Thing } from "../../shared/world/contract";
import { FLIP_MS } from "../../shared/world/MonthCount";
import { City } from "./City";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act } | { kind: "own" } | { kind: "person"; slot: number } | { kind: "model"; file: string; signs: string[] };

vi.mock("./CityScene", () => ({
  default: ({ things, onPick }: { things?: Thing[]; onPick: (pick: Pick) => void }) => (
    <div data-stand-in-scene>
      <button type="button" data-stand-in-own onClick={() => onPick({ kind: "own" })} />
      <button type="button" data-stand-in-person onClick={() => onPick({ kind: "person", slot: 0 })} />
      <button type="button" data-stand-in-shopfront onClick={() => onPick({ kind: "model", file: "shopfront.glb", signs: ["place.bode-thomas.sign.1"] })} />
      {(things ?? []).map((thing) => (
        <span key={thing.id}>
          <button type="button" data-stand-in-thing={thing.id} onClick={() => onPick({ kind: "thing", thing })} />
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
  // The city draws its place only where the device can (City.tsx canDraw); the scene itself is the stand-in above.
  Object.defineProperty(window, "WebGL2RenderingContext", { value: class {}, configurable: true });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({}) as never);
  window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
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

/** Ada at home with a month behind her and something planned, so Next month turns the page rather than open the Calendar. */
async function adaAtHome(extra: Partial<Parameters<typeof City>[0]> = {}, goIn = true) {
  // In the yard unless the test keeps the player inside (R-WORLD-014: the game opens where the player last stopped).
  if (goIn) window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
  const game = newGame("scenario.ada");
  game.endTurn();
  const rendered = await renderWithGame(
    <City world results={(place) => <p data-results-for={place} />} phone={(close) => <button type="button" data-stand-in-phone onClick={close} />} {...extra} />,
    game,
  );
  // The compound first; the house's Go in cuts to the parlour (R-WORLD-013).
  if (goIn) fireEvent.click(await waitFor(() => found('[data-stand-in-act="house:enter"]')));
  await waitFor(() => found('[data-stand-in-thing="bed"]'), { timeout: 3000 });
  const pick = game.view().activities.find((option) => option.allowed && option.affordable && option.id !== "activity.job-hunt" && option.params === null && plannable(option.id));
  if (pick === undefined) throw new Error("Nothing Ada can plan.");
  act(() => {
    rendered.store.getState().addToPlan({ activity: pick.id, param: null });
  });
  expect(rendered.store.getState().plan.some((one) => one !== null)).toBe(true);
  return rendered;
}

const nudge = (): Element | null => document.querySelector("[data-nudge]");

describe("the bed's month end", () => {
  test("[R-WORLD-025] [R-WORLD-008] given the month's lines waiting at home, when the bed's Next month is tapped and the phone is put away, then the lock screen comes first with nothing sent, and putting it away ends the month and opens the results sheet, the same sheet over the same place as the band's Next month", async () => {
    const bed = await adaAtHome({ signalsWaiting: true });
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    // The lock screen's lines are a preview: the month has not turned.
    expect(document.querySelector("[data-stand-in-phone]")).not.toBeNull();
    expect(bed.authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(0);
    const slots = bed.store.getState().plan.filter((one) => one !== null);
    fireEvent.click(found("[data-stand-in-phone]"));
    await waitFor(() => expect(bed.authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(1));
    expect(bed.authority.sent.find((command) => command.type === "turn/end")).toMatchObject({ type: "turn/end", slots });
    expect(document.querySelector("[data-stand-in-phone]")).toBeNull();
    await waitFor(() => expect(bed.store.getState().reportOpen).toBe(true));
    const fromBed = await waitFor(() => found("[data-results-for]"), { timeout: FLIP_MS + 1500 });
    const bedPlace = fromBed.dataset.resultsFor;
    expect(bedPlace).toBeTruthy();
    // The band's Next month from the same place: the same command and the same sheet.
    document.body.innerHTML = "";
    const band = await adaAtHome({ signalsWaiting: true });
    fireEvent.click(found(`[aria-label="${say("ui.world.end-month")}"]`));
    await waitFor(() => expect(band.authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(1));
    const fromBand = await waitFor(() => found("[data-results-for]"), { timeout: FLIP_MS + 1500 });
    expect(fromBand.dataset.resultsFor).toBe(bedPlace);
  });

  test("[R-WORLD-025] given nothing waiting on the phone, when the bed's Next month is tapped, then the month ends at once as the band's does and the results follow", async () => {
    const { authority } = await adaAtHome({ signalsWaiting: false });
    fireEvent.click(found('[data-stand-in-act="bed:end-month"]'));
    expect(document.querySelector("[data-stand-in-phone]")).toBeNull();
    await waitFor(() => expect(authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(1));
    await waitFor(() => found("[data-results-for]"), { timeout: FLIP_MS + 1500 });
  });
});

describe("the player's own figure", () => {
  test("[R-WORLD-005] [R-WORLD-003] given the world, when the player's own figure is tapped, then nothing opens, no card and no dialog, nothing is sent and the nudge stays", async () => {
    const { authority } = await adaAtHome();
    expect(nudge()).not.toBeNull();
    const before = authority.sent.length;
    fireEvent.click(found("[data-stand-in-own]"));
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(document.querySelector("[role=dialog]")).toBeNull();
    expect(authority.sent).toHaveLength(before);
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-005] [R-WORLD-003] given a thing's chip open, when the player's own figure is tapped, then the chip goes and the nudge comes back", async () => {
    await adaAtHome();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    expect(nudge()).toBeNull();
    fireEvent.click(found("[data-stand-in-own]"));
    expect(nudge()).not.toBeNull();
  });
});

describe("a thing's chip and the nudge", () => {
  test("[R-WORLD-003] given a thing's chip open, when a tap lands anywhere outside it, then the chip goes and the nudge comes back by itself, with no tap on the floor", async () => {
    await adaAtHome();
    expect(nudge()).not.toBeNull();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    // The nudge hides while the chip is open.
    expect(nudge()).toBeNull();
    // A tap on the band, outside the chip.
    fireEvent.pointerDown(found("[data-band]"));
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-003] given a thing's chip open, when Escape (Back) is pressed, then the chip goes and the nudge comes back; a tap inside the chip keeps it", async () => {
    await adaAtHome();
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    expect(nudge()).toBeNull();
    // A tap on the chip itself keeps it open.
    const chip = document.createElement("div");
    chip.dataset.thingChip = "mama";
    const inside = document.createElement("button");
    chip.append(inside);
    document.body.append(chip);
    fireEvent.pointerDown(inside);
    expect(nudge()).toBeNull();
    chip.remove();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-003] given a thing's act that opens its sheet, when the sheet is closed, then the nudge comes back by itself", async () => {
    await adaAtHome();
    const mama = document.querySelector<HTMLElement>('[data-stand-in-act^="mama:"]');
    if (mama === null) throw new Error("Mama has no act.");
    fireEvent.click(found('[data-stand-in-thing="mama"]'));
    fireEvent.click(mama);
    expect(nudge()).toBeNull();
    const sheet = await waitFor(() => found("[role=dialog]"));
    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => expect(document.querySelector("[role=dialog]")).toBeNull());
    expect(nudge()).not.toBeNull();
  });
});

describe("a person's or a shopfront's card", () => {
  test("[R-WORLD-005] [R-WORLD-003] given a shopfront's card open, when it shows, then it sits at the foot of the screen as the sheets do, never under the band; a tap anywhere outside it closes it and the nudge comes back", async () => {
    await adaAtHome();
    fireEvent.click(found("[data-stand-in-shopfront]"));
    const card = found("[data-card]");
    expect(card.closest("[data-card-dock]")).not.toBeNull();
    expect(card.closest("[data-band]")).toBeNull();
    expect(found("[data-card-dock]").className).toContain("bottom-0");
    expect(nudge()).toBeNull();
    // A tap inside the card keeps it.
    fireEvent.pointerDown(card);
    expect(document.querySelector("[data-card]")).not.toBeNull();
    fireEvent.pointerDown(found("[data-band]"));
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(nudge()).not.toBeNull();
  });

  test("[R-WORLD-005] [R-WORLD-003] given a person's card open, when Escape (Back) is pressed, then it closes and the nudge comes back", async () => {
    await adaAtHome();
    fireEvent.click(found("[data-stand-in-person]"));
    expect(found("[data-card]").closest("[data-card-dock]")).not.toBeNull();
    expect(nudge()).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelector("[data-card]")).toBeNull();
    expect(nudge()).not.toBeNull();
  });
});

describe("where the game opens", () => {
  test("[R-WORLD-014] given the player last stopped inside the family house, when the world opens again, then it opens inside, in the parlour with the bed, not in the yard", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house", "inside"]));
    await adaAtHome({}, false);
    expect(document.querySelector('[data-stand-in-thing="house"]')).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("japacity.city.last") ?? "[]")).toEqual(["place.family-house", "inside"]);
  });

  test("[R-WORLD-014] given the player last stopped in the yard, when the world opens again, then it opens in the yard", async () => {
    window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
    const game = newGame("scenario.ada");
    game.endTurn();
    await renderWithGame(<City world results={() => <p />} />, game);
    await waitFor(() => found('[data-stand-in-thing="house"]'));
    expect(document.querySelector('[data-stand-in-thing="bed"]')).toBeNull();
  });
});
