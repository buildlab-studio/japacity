// The morning on the lock screen (docs/rules/clock.md R-CLOCK-032; docs/design/12-the-lived-month-and-the-files.md,
// section 2, point 5): a result real life makes you wait for is sealed until seven the next morning in Lagos. While it
// is sealed, Papers says when it comes; once its morning has come the store learns it from the authority, and the lock
// screen tells it first, as a notice from its office, once. Its line joins the month's lines.
import type { Command, Envelope, Id, PlayerView } from "@japacity/sim";
import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { localAuthority } from "../../authority/local";
import { createGameStore, type GameStore } from "../../authority/store";
import "../../shared/testing/render";
import { formatBand } from "../../shared/words/format";
import { say } from "../../shared/words/text";
import { PhoneApps } from "./PhoneApps";
import { reloadSeen } from "./seen";

const ENGLISH: Id<"document"> = "document.english-test";
const NOON = () => new Date(2026, 9, 12, 7, 5);

/** A moment in Lagos (UTC+1) on a day of October 2026. */
const lagos = (day: number, hour: number, minute = 0) => Date.UTC(2026, 9, day, hour - 1, minute);

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
    removeItem: (key: string) => {
      items.delete(key);
    },
  };
}

const seeds = () => {
  let n = 0;
  return () => `morning-${String((n += 1))}`;
};

type Loose = Command extends infer C ? (C extends unknown ? Omit<C, "basedOn"> : never) : never;

/** Ngozi, who holds a passport, sits the English test and ends the month at nine in the evening. */
async function testSat(at: { now: number }) {
  const authority = localAuthority({ fastClock: true, storage: memoryStorage(), makeSeed: seeds(), now: () => at.now, scenario: "scenario.ngozi" });
  await authority.newLife("scenario.ngozi");
  const send = async (command: Loose) => {
    const view = await authority.view();
    const reply = await authority.send({ ...command, basedOn: view.v });
    if (!reply.ok) throw new Error(`${command.type} was rejected: ${reply.code}`);
  };
  await send({ type: "activity/now", activity: "activity.sit-english-test", param: null });
  await send({ type: "turn/end", slots: [] });
  return authority;
}

/** The store over the local authority, with the morning it keeps. */
async function storeOver(authority: ReturnType<typeof localAuthority>): Promise<GameStore> {
  const store = createGameStore({ view: () => authority.view(), send: (command) => authority.send(command), morning: () => authority.morning() });
  await store.getState().refresh();
  return store;
}

function english(view: PlayerView | null) {
  return view?.documents.find((entry) => entry.id === ENGLISH);
}

function bandOf(envelope: Envelope | undefined): number {
  const band = envelope?.held.find((line) => typeof line.params.band === "number")?.params.band;
  if (typeof band !== "number") throw new Error("The envelope holds no band.");
  return band;
}

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

describe("the result sealed until the morning", () => {
  test("[R-CLOCK-032] given the English test sat and the month ended in the evening, when Papers opens, then the result's card says it comes tomorrow at seven and names no band", async () => {
    const at = { now: lagos(11, 21) };
    const store = await storeOver(await testSat(at));
    expect(english(store.getState().view)).toMatchObject({ state: "pending", readyMonth: store.getState().view?.month });
    expect(store.getState().opened).toEqual([]);
    render(
      <GameProvider store={store}>
        <PhoneApps onClose={() => undefined} area="Home" now={NOON} />
      </GameProvider>,
    );
    expect(document.querySelector("[data-envelope]")).toBeNull();
    // Nothing on the lock screen tells the band early either.
    expect(document.querySelector(`[data-paper-notice="issued-band.${ENGLISH}"]`)).toBeNull();
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
    const card = document.querySelector<HTMLElement>(`[data-paper="${ENGLISH}"]`);
    expect(card?.querySelector("[data-paper-state]")?.textContent).toBe("Comes tomorrow, 7am");
    expect(card?.textContent).not.toMatch(/band/i);
  });
});

describe("the morning on the lock screen", () => {
  test("[R-CLOCK-032] given the English result's morning has come, when the store loads and the phone opens, then the test centre's notice shows first with the band, once, and its line joins the month's lines", async () => {
    const at = { now: lagos(11, 21) };
    const authority = await testSat(at);
    at.now = lagos(12, 7, 1);
    const store = await storeOver(authority);
    const [opened] = store.getState().opened;
    expect(store.getState().opened).toHaveLength(1);
    expect(opened).toMatchObject({ kind: "document", id: ENGLISH });
    const band = bandOf(opened);

    let shown = true;
    const ui = () => <GameProvider store={store}>{shown ? <PhoneApps onClose={() => undefined} area="Home" now={NOON} /> : null}</GameProvider>;
    const view = render(ui());
    const home = document.querySelector<HTMLElement>("[data-phone-home]");
    const notice = home?.querySelector<HTMLElement>("[data-envelope]");
    expect(notice?.getAttribute("data-envelope")).toBe(ENGLISH);
    expect(notice?.textContent).toContain("The test centre");
    expect(notice?.textContent).toContain(`Your result is in: band ${formatBand(band)}.`);
    // First: above every other line the wallpaper tells.
    const told = [...(home?.querySelectorAll("[data-envelope], [data-paper-notice], [data-notice]") ?? [])];
    expect(told[0]).toBe(notice);

    // Shown once: the store lets it go, and its line stays with the month's.
    expect(store.getState().opened).toEqual([]);
    expect(store.getState().monthLines).toEqual(expect.arrayContaining(opened?.held ?? []));

    // Put away and opened again, and asked again on a focus: it is not told twice.
    shown = false;
    view.rerender(ui());
    await act(async () => {
      await store.getState().refresh();
    });
    shown = true;
    view.rerender(ui());
    expect(document.querySelector("[data-envelope]")).toBeNull();
    expect(document.querySelector(`[data-paper-notice="issued-band.${ENGLISH}"]`)).toBeNull();
    expect(say("ui.wait.morning")).toBe("Comes tomorrow, 7am");
  });
});
