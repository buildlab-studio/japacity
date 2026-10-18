// The send-off as a scene on the real engine (chapter:send-off-scene-in-beats): Ada's recorded life one command
// before the flight, granted, and the six beats played by their buttons. Beats 1 and 2 send nothing; Board the plane
// sends `route/depart` once; the plane's cut, the landing at each country's hub, the first ride with the family's first
// messages, and Ring the bell into the room abroad. The map's own cut is a stand-in here (world:plane-cut-at-send-off is
// tested beside the map, PlaneCut.test.tsx).
import { content, text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";

import { GameProvider, useGame, useView } from "../../../authority/GameProvider";
import { createGameStore } from "../../../authority/store";
import { fakeAuthority, gameAuthority, recordedGame } from "../../../shared/testing/fixtures";
import { found } from "../../../shared/testing/render";
import { Rejection } from "../../../shared/ui/Rejection";
import { sendOff } from "../../../shared/world/sendOff";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { sendOffWords } from "../sendOff.words";
import { firstPings, GATE_LINE, landingOf, PLANE_MS } from "./plan";
import SendOffScene from "./SendOffScene";

// The stickers' pictures are read from the publish manifest; here there is none, and the scene stands without them.
vi.mock("../../../shared/three/manifest", async (original) => (await import("../../../shared/testing/manifest")).emptyManifest(original));

afterEach(() => {
  act(() => sendOff.getState().close());
  localStorage.clear();
});

const AIRPORT = "place.airport-lagos";

/** The scene as the city hands it the game: the view, busy, send and the rejection's words. */
function Harness() {
  const view = useView();
  const busy = useGame((state) => state.busy);
  const send = useGame((state) => state.send);
  return (
    <SendOffScene
      you={{ name: text[`${view.scenario}.name`] ?? "Ada", first: "Ada", look: "chr_ada", figure: <img alt="" data-figure="chr_ada" /> }}
      game={{ view, busy, send: (command) => send(command).then((reply) => reply?.ok === true), rejection: <Rejection /> }}
      planeCut={(slot) => <div data-cut={slot.city} data-cut-ms={slot.ms} data-cut-country={slot.country} />}
    />
  );
}

/** The scene over a store whose authority is `authority`, opened for the view's granted route. */
async function openScene(authority: Parameters<typeof createGameStore>[0]) {
  const store = createGameStore(authority);
  await store.getState().refresh();
  const view = store.getState().view!;
  const route = view.routes.find((each) => each.state === "granted")?.id;
  if (route === undefined) throw new Error("No granted route.");
  const country = content.route[route]!.country!;
  render(
    <GameProvider store={store}>
      <Harness />
    </GameProvider>,
  );
  act(() => sendOff.getState().open({ route, country }));
  return { store, route, country };
}

/** Ada's life one command before the flight, on the real engine. */
async function adaAtTheGate() {
  const game = recordedGame("ada-careful", 1);
  const authority = gameAuthority(game);
  const opened = await openScene(authority);
  return { ...opened, authority, game };
}

const beat = () => document.querySelector("[data-send-off]")?.getAttribute("data-send-off") ?? null;
const said = (who: string) => document.querySelector(`[data-so-said='${who}']`)?.textContent ?? "";
const departs = (sent: { type: string }[]) => sent.filter((command) => command.type === "route/depart").length;

/** Through beats 1 and 2 to the gate. */
async function toTheGate(): Promise<void> {
  for (let tap = 0; tap < 3; tap += 1) fireEvent.click(found("[data-so-go='step']"));
  await waitFor(() => expect(beat()).toBe("counter"), { timeout: 4000 });
  fireEvent.click(found("[data-so-go='take']"));
  expect(beat()).toBe("gate");
}

describe("the send-off as a scene", () => {
  test("[chapter:send-off-scene-in-beats] given a granted life, when the scene opens, then Departures has two ahead and Mama's line, each of three taps moves the queue a place and a line of the airport's own is said, the character's last, then the counter, and nothing is sent", async () => {
    const { authority } = await adaAtTheGate();
    expect(beat()).toBe("departures");
    expect(found("[data-so-marker]").textContent).toBe(sendOffWords("sendoff.queue.ahead", { count: 2 }));
    expect(said("mum")).toContain(text[`${AIRPORT}.overheard.1`]);
    expect(said("mum")).toContain(text["chats.from.mum"]);
    const step = found("[data-so-go='step']");
    expect(step.textContent).toBe("Step forward");
    fireEvent.click(step);
    expect(found("[data-so-marker]").textContent).toBe(sendOffWords("sendoff.queue.ahead", { count: 1 }));
    expect(said("cousin")).toContain(text[`${AIRPORT}.overheard.2`]);
    fireEvent.click(step);
    expect(found("[data-so-marker]").textContent).toBe(sendOffWords("sendoff.queue.next"));
    expect(said("dad")).toContain(text[`${AIRPORT}.overheard.4`]);
    fireEvent.click(step);
    expect(said("you")).toContain(text[`${AIRPORT}.overheard.5`]);
    // A fourth tap does nothing: the queue is at the counter and the character's line stands.
    fireEvent.click(step);
    expect(found("[data-so-beat='departures']").getAttribute("data-so-step")).toBe("3");
    await waitFor(() => expect(beat()).toBe("counter"), { timeout: 4000 });
    expect(authority.sent).toEqual([]);
  });

  test("[chapter:send-off-scene-in-beats] given the counter, then the passport and the stub slide across, the flight chip shows the tuning's flight figure, Window or aisle changes the stub's seat and nothing else, and nothing is sent", async () => {
    const { authority, store } = await adaAtTheGate();
    for (let tap = 0; tap < 3; tap += 1) fireEvent.click(found("[data-so-go='step']"));
    await waitFor(() => expect(beat()).toBe("counter"), { timeout: 4000 });
    expect(found("[data-so-passport]")).toBeDefined();
    const flight = content.tuning.route.flight;
    expect(found("[data-so-flight]").textContent).toContain(formatMoney(flight.amount as number, flight.currency));
    expect(found("[data-so-stub]").textContent).toContain(text["share.stub.seat.window"]);
    const before = store.getState().view;
    fireEvent.click(found("[data-so-seat-chip='aisle']"));
    expect(found("[data-so-stub]").textContent).toContain(text["share.stub.seat.aisle"]);
    expect(found("[data-so-seat-chip='aisle']").getAttribute("aria-pressed")).toBe("true");
    expect(sendOff.getState().seat).toBe("aisle");
    expect(store.getState().view).toBe(before);
    fireEvent.click(found("[data-so-go='take']"));
    expect(beat()).toBe("gate");
    expect(authority.sent).toEqual([]);
  });

  test("[chapter:send-off-scene-in-beats] given the scene left before the gate's button, then it closes, nothing was sent, and the life is still at the airport", async () => {
    const { authority, store } = await adaAtTheGate();
    const before = store.getState().view;
    fireEvent.click(found("[data-so-go='step']"));
    fireEvent.click(found("[data-so-leave]"));
    expect(sendOff.getState().scene).toBeNull();
    expect(document.querySelector("[data-send-off]")).toBeNull();
    expect(authority.sent).toEqual([]);
    expect(store.getState().view).toBe(before);
  });

  test("[chapter:send-off-scene-in-beats] given the gate, then Papa says the airport's sixth line named as content names him, Board the plane sends route/depart once however often it is tapped, and the plane follows", async () => {
    const { authority, route } = await adaAtTheGate();
    await toTheGate();
    expect(text[`${GATE_LINE}.by`]).toBe("Papa");
    expect(said("dad")).toContain(text[GATE_LINE]);
    expect(said("dad")).toContain("Papa");
    const board = found("[data-so-go='board']");
    expect(board.textContent).toBe(say("ui.route.depart"));
    fireEvent.click(board);
    fireEvent.click(board);
    await waitFor(() => expect(beat()).toBe("plane"));
    expect(authority.sent.filter((command) => command.type === "route/depart")).toEqual([expect.objectContaining({ type: "route/depart", route })]);
    expect(departs(authority.sent)).toBe(1);
  });

  test("[chapter:send-off-scene-in-beats] given held funds still open, then the gate says what stops the flight and Board the plane is shut", async () => {
    const view = recordedGame("ada-careful", 1).view();
    const owed = view.obligations[0];
    if (owed === undefined) throw new Error("Ada's life owes nothing to copy.");
    const held: PlayerView = { ...view, obligations: [...view.obligations, { ...owed, id: "held-1", entry: "obligation.held-funds", outstanding: 100 }] };
    const authority = fakeAuthority(held);
    await openScene(authority);
    await toTheGate();
    expect(found("[data-so-blocked]").textContent).toBe(say("ui.world.depart-held"));
    expect((found("[data-so-go='board']") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(found("[data-so-go='board']"));
    expect(authority.sent).toEqual([]);
  });

  test("[chapter:send-off-scene-in-beats] [world:plane-cut-at-send-off] given the plane boarded, then the map's cut shows for about three seconds with the hub's city, then the landing", async () => {
    await adaAtTheGate();
    await toTheGate();
    fireEvent.click(found("[data-so-go='board']"));
    await waitFor(() => expect(beat()).toBe("plane"));
    const shownAt = Date.now();
    const cut = found("[data-cut]");
    expect(cut.getAttribute("data-cut")).toBe("London");
    expect(cut.getAttribute("data-cut-country")).toBe("country.uk");
    expect(Number(cut.getAttribute("data-cut-ms"))).toBe(PLANE_MS);
    expect(PLANE_MS).toBeGreaterThanOrEqual(2500);
    expect(PLANE_MS).toBeLessThanOrEqual(3500);
    await new Promise((done) => setTimeout(done, PLANE_MS - 800));
    expect(beat()).toBe("plane");
    await waitFor(() => expect(beat()).toBe("landing"), { timeout: 2000 });
    expect(Date.now() - shownAt).toBeGreaterThanOrEqual(PLANE_MS - 50);
  }, 15_000);

  test("[chapter:send-off-scene-in-beats] given a granted life played through every beat, when the bell is rung, then the scene closes, the flight was sent once, and the life stands abroad", async () => {
    const { authority, store } = await adaAtTheGate();
    await toTheGate();
    fireEvent.click(found("[data-so-go='board']"));
    await waitFor(() => expect(beat()).toBe("landing"), { timeout: 6000 });
    expect(store.getState().view?.place.where).toBe("abroad");
    fireEvent.click(found("[data-so-go='ride']"));
    expect(beat()).toBe("ride");
    fireEvent.click(found("[data-so-go='ring']"));
    expect(sendOff.getState().scene).toBeNull();
    expect(document.querySelector("[data-send-off]")).toBeNull();
    expect(departs(authority.sent)).toBe(1);
    expect(store.getState().view?.place.country).toBe("country.uk");
  }, 15_000);

  test.each(["country.uk", "country.canada", "country.uae", "country.italy"] as const)("[chapter:send-off-scene-in-beats] given a landing in %s, then it is the country's hub in content with its staple, its weather, the hub's first overheard line at the stop and the staple's button", async (country) => {
    await adaAtTheGate();
    const landing = landingOf(country)!;
    act(() => {
      sendOff.getState().open({ route: "route.uk-masters", country });
      sendOff.getState().to("landing");
    });
    const hubs: Record<string, string> = { "country.uk": "place.peckham", "country.canada": "place.calgary-north-east", "country.uae": "place.deira", "country.italy": "place.castel-volturno" };
    const staples: Record<string, string> = { "country.uk": "double-decker", "country.canada": "pickup", "country.uae": "taxi", "country.italy": "domitiana-bus" };
    const buttons: Record<string, string> = { "country.uk": "Get on the bus", "country.canada": "Get in the truck", "country.uae": "Get in the taxi", "country.italy": "Get on the bus" };
    expect(landing.hub).toBe(hubs[country]);
    expect(content.place[landing.hub]?.hub).toBe(true);
    expect(found("[data-so-beat='landing']").getAttribute("data-so-hub")).toBe(hubs[country]);
    expect(said("stop")).toContain(text[`${hubs[country]}.overheard.1`]);
    expect(found("[data-so-weather]").textContent).toBe(sendOffWords(`sendoff.landing.weather.${country}`));
    expect(found("[data-so-go='ride']").textContent).toBe(buttons[country]);
    expect(found(`[data-so-staple='${staples[country]}']`)).toBeDefined();
    // The hub's name on London's blind and the Domitiana on Italy's; Calgary at minus twenty in the snow, breath in the cold.
    const blinds: Record<string, string | null> = { "country.uk": "12 · PECKHAM", "country.canada": null, "country.uae": null, "country.italy": "VIA DOMITIANA" };
    expect(document.querySelector("[data-so-blind]")?.textContent ?? null).toBe(blinds[country]);
    expect(/^Minus twenty/.test(found("[data-so-weather]").textContent ?? "")).toBe(country === "country.canada");
    expect(document.querySelector("[data-so-snow]") !== null).toBe(country === "country.canada");
    expect(document.querySelector("[data-so-breath]") !== null).toBe(country === "country.canada" || country === "country.uk");
  });

  test("[chapter:send-off-scene-in-beats] [share:send-off-card-kept] given the first ride, then So this is it., the family's first messages in content from the senders the game has, the card saved with a tick, and the Phone's badge counting the messages", async () => {
    const { store } = await adaAtTheGate();
    act(() => {
      sendOff.getState().to("ride");
    });
    expect(said("you")).toContain("So this is it.");
    const pings = firstPings(store.getState().view!.scenario);
    expect(pings.map((ping) => ping.key)).toEqual(["chats.mum.landed.text", "family.size-44.text", "chats.friend.landed.text"]);
    expect(text["chats.mum.landed.text"]).toBe("You have landed? Have you eaten? Is it cold? Call me.");
    const shown = [...document.querySelectorAll("[data-so-ping]")].map((item) => item.textContent);
    expect(shown).toEqual(pings.map((ping) => `${ping.from}${text[ping.key] ?? ""}`));
    expect(pings[0]?.from).toBe(text["chats.from.mum"]);
    expect(found("[data-so-saved]").textContent).toContain("Send-off card saved");
    expect(found("[data-so-badge]").getAttribute("data-so-badge")).toBe(String(pings.length));
    expect(sendOff.getState().saved).toBe(true);
    expect(screen.getByRole("button", { name: "Ring the bell" })).toBeDefined();
  });

  test("[chapter:send-off-scene-in-beats] given every beat's motion, then it moves by transform and opacity alone, under half a second, and stands still under reduced motion", () => {
    const css = readFileSync(join(import.meta.dirname, "sendoff.css"), "utf8");
    const frames = [...css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)];
    expect(frames.length).toBeGreaterThan(5);
    for (const [, name, body] of frames) {
      const properties = [...(body ?? "").matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]);
      expect([name, properties.filter((property) => property !== "transform" && property !== "opacity")]).toEqual([name, []]);
    }
    for (const [, duration] of css.matchAll(/animation:\s*[\w-]+\s+([\d.]+)s/g)) expect(Number(duration)).toBeLessThan(0.5);
    const transitions = [...css.matchAll(/transition:\s*([^;]+);/g)].map((match) => (match[1] ?? "").replace(/\([^)]*\)/g, ""));
    expect(transitions.length).toBeGreaterThan(0);
    for (const transition of transitions) {
      for (const part of transition.split(",")) {
        const [property, duration] = part.trim().split(/\s+/);
        // Under reduced motion the transition is none.
        if (property === "none") continue;
        expect([transition, property]).toEqual([transition, expect.stringMatching(/^(?:transform|opacity)$/)]);
        expect(Number.parseFloat(duration ?? "1")).toBeLessThan(0.5);
      }
    }
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    const animated = [...css.matchAll(/\.(so-[\w-]+)\s*\{[^}]*animation:/g)].map((match) => match[1]);
    for (const name of animated) expect([name, reduced.includes(`.${name ?? ""}`)]).toEqual([name, true]);
  });
});
