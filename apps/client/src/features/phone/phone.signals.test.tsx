// The month's lines on the phone (docs/rules/world.md R-WORLD-030): a planned course tells of itself
// as a notification once the character is home, never on the street; the Phone button's dot shows
// them waiting; nothing in the simulation changes for any of it.
import { content, text } from "@japacity/content";
import type { Command, Id } from "@japacity/sim";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore, type GameStore } from "../../authority/store";
import { forgetDays } from "../../shared/days/days.store";
import { CITY_LAST_KEY } from "../../shared/days/standing";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { PhoneApps, usePhoneWaiting } from "./PhoneApps";
import { APP_IDS, markSeen, marksOf, reloadSeen } from "./seen";

const COURSE = "activity.learn-tech" as Id<"activity">;
/** The course's first line, from content. */
const LINE = text["activity.learn-tech.signal.1"] ?? "missing";
const NOON = () => new Date(2026, 9, 8, 12, 5);

/** Every command the store sends, in order. */
let sent: Command["type"][] = [];

async function adaStore(): Promise<GameStore> {
  const authority = localAuthority({ fastClock: true, storage: null, scenario: "scenario.ada", makeSeed: () => "month-signals", now: () => 0 });
  const store = createGameStore({
    view: () => authority.view(),
    send: (command) => {
      sent.push(command.type);
      return authority.send(command);
    },
  });
  await store.getState().refresh();
  return store;
}

/** The Phone button's dot, as the shell reads it. */
function Dot() {
  return <span data-phone-dot={usePhoneWaiting()} />;
}

function dot(): boolean {
  return document.querySelector("[data-phone-dot]")?.getAttribute("data-phone-dot") === "true";
}

function stand(place: string): void {
  localStorage.setItem(CITY_LAST_KEY, JSON.stringify([place]));
}

/** Ada plans a coding course and rides out, so its first line is due, with the phone put away. */
async function courseDue(): Promise<{ store: GameStore; open: () => void; close: () => void }> {
  const store = await adaStore();
  let shown = false;
  const ui = () => (
    <GameProvider store={store}>
      <Dot />
      {shown ? <PhoneApps onClose={() => undefined} area="Here" now={NOON} /> : null}
    </GameProvider>
  );
  const view = render(ui());
  act(() => {
    store.getState().addToPlan({ activity: COURSE, param: null });
  });
  const other = Object.values(content.place).find((place) => place.where === "home" && place.id !== "place.family-house");
  if (other === undefined) throw new Error("No place to ride to.");
  await act(async () => {
    await store.getState().send({ type: "place/ride", from: "place.family-house", to: other.id, way: "danfo" });
  });
  // Everything in the apps seen, so the dot is the month's lines alone.
  const marks = marksOf(store.getState().view!);
  act(() => {
    for (const id of APP_IDS) markSeen(id, marks[id]);
  });
  return {
    store,
    open: () => {
      shown = true;
      view.rerender(ui());
    },
    close: () => {
      shown = false;
      view.rerender(ui());
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
  forgetDays();
  sent = [];
});
afterEach(() => {
  forgetDays();
});

describe("the month's lines on the phone", () => {
  test("[R-WORLD-030] given a coding course planned and a day gone, when the phone opens at home, then the course's line shows as a notification and the dot goes", async () => {
    const { open, close } = await courseDue();
    stand("place.family-house");
    expect(dot()).toBe(true);
    open();
    expect(screen.getByText(LINE)).toBeTruthy();
    expect(document.querySelector("[data-phone-notices]")).not.toBeNull();
    close();
    expect(dot()).toBe(false);
    // Read once, it stays on the phone for the month without the dot.
    open();
    expect(screen.getByText(LINE)).toBeTruthy();
    expect(dot()).toBe(false);
  });

  test("[R-WORLD-030] given the course's line due, when the phone opens on the street, then the line is not shown, the wallpaper says something waits at home, and the dot stays", async () => {
    const { open, close } = await courseDue();
    stand("place.ojuelegba");
    expect(dot()).toBe(true);
    open();
    expect(screen.queryByText(LINE)).toBeNull();
    expect(screen.getByText(say("ui.days.away.one"))).toBeTruthy();
    expect(say("ui.days.away.one")).toBe("Something to read at home.");
    close();
    expect(dot()).toBe(true);
    // Home again, the line is told.
    stand("place.family-house");
    open();
    expect(screen.getByText(LINE)).toBeTruthy();
    close();
    expect(dot()).toBe(false);
  });

  test("[R-WORLD-030] given nothing planned and no job, when the phone opens at home, then no notification shows and no dot is lit for them", async () => {
    const store = await adaStore();
    render(
      <GameProvider store={store}>
        <Dot />
        <PhoneApps onClose={() => undefined} area="Here" now={NOON} />
      </GameProvider>,
    );
    expect(document.querySelector("[data-phone-notices]")).toBeNull();
    expect(screen.queryByText(say("ui.days.away.one"))).toBeNull();
  });

  test("[R-WORLD-030] given the lines told and the phone opened at home and on the street, when the view is read, then it is the very same view and the phone sent nothing", async () => {
    const { store, open, close } = await courseDue();
    expect(sent).toEqual(["place/ride"]);
    const before = store.getState().view;
    const json = JSON.stringify(before);
    stand("place.ojuelegba");
    open();
    close();
    stand("place.family-house");
    open();
    fireEvent.click(document.querySelector("[data-home-bar]")!);
    close();
    expect(store.getState().view).toBe(before);
    expect(JSON.stringify(store.getState().view)).toBe(json);
    expect(sent).toEqual(["place/ride"]);
  });
});
