// world:lazy-part-fails-softly: a part loaded on first use that fails to load leaves the world up and shows the connection card with
// Retry, which loads that part again; a part fetched ahead is not fetched twice; and when the connection comes back a request that
// failed for it is tried again once.
import type { PlayerView } from "@japacity/sim";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, Suspense } from "react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { CountedBoundary } from "../analytics/CountedBoundary";
import { engineView } from "../testing/fixtures";
import { TroubleCard } from "../ui/Trouble";
import { say } from "../words/text";
import { requestFailure } from "./http";
import { HoldParts, softLazy, type SoftPart } from "./parts";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

/** A loader that fails `failures` times as a lost connection fails a dynamic import, then gives the part. */
function flaky(failures: number) {
  let calls = 0;
  const load = () => {
    calls += 1;
    if (calls <= failures) return Promise.reject(new TypeError("Failed to fetch dynamically imported module"));
    return Promise.resolve({ default: () => <p data-part>The map</p> });
  };
  return { load, calls: () => calls };
}

function world(Part: SoftPart<() => ReactNode>) {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("not sent")) });
  render(
    <GameProvider store={store}>
      <HoldParts />
      <CountedBoundary>
        <p data-world>The world</p>
        <Suspense fallback={<p data-waiting />}>
          <Part />
        </Suspense>
      </CountedBoundary>
      <TroubleCard />
    </GameProvider>,
  );
  return store;
}

describe("a part loaded on first use (world:lazy-part-fails-softly)", () => {
  test("[world:lazy-part-fails-softly] given the part fails to load, when it is opened, then the world stays and the connection card shows with Retry, never the broken screen", async () => {
    const part = flaky(1);
    world(softLazy(part.load));
    await waitFor(() => expect(document.querySelector("[data-trouble]")).not.toBeNull());
    const card = document.querySelector("[data-trouble]");
    expect(card?.getAttribute("data-trouble")).toBe("network");
    expect(card?.getAttribute("data-trouble-during")).toBe("part");
    expect(document.querySelector("[data-broken]")).toBeNull();
    expect(document.querySelector("[data-world]")).not.toBeNull();
    expect(screen.getByRole("button", { name: say("ui.trouble.retry") })).toBeTruthy();
  });

  test("[world:lazy-part-fails-softly] given the card after a failed load, when Retry is tapped, then the part is loaded again and drawn and the card goes", async () => {
    const part = flaky(1);
    world(softLazy(part.load));
    const retry = await screen.findByRole("button", { name: say("ui.trouble.retry") });
    fireEvent.click(retry);
    await waitFor(() => expect(document.querySelector("[data-part]")).not.toBeNull());
    expect(part.calls()).toBe(2);
    expect(document.querySelector("[data-trouble]")).toBeNull();
    expect(document.querySelector("[data-broken]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given Retry fails again, then the card shows again and the next Retry loads it", async () => {
    const part = flaky(2);
    world(softLazy(part.load));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.trouble.retry") }));
    await waitFor(() => expect(part.calls()).toBe(2));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.trouble.retry") }));
    await waitFor(() => expect(document.querySelector("[data-part]")).not.toBeNull());
    expect(document.querySelector("[data-broken]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given the part was fetched ahead, when it is opened, then it is drawn without a second fetch", async () => {
    const part = flaky(0);
    const Part = softLazy(part.load);
    await Part.ahead();
    world(Part);
    await waitFor(() => expect(document.querySelector("[data-part]")).not.toBeNull());
    expect(part.calls()).toBe(1);
  });

  test("[world:lazy-part-fails-softly] given fetching ahead failed, then nothing shows, and opening the part fetches it again", async () => {
    const part = flaky(1);
    const Part = softLazy(part.load);
    await Part.ahead();
    world(Part);
    await waitFor(() => expect(document.querySelector("[data-part]")).not.toBeNull());
    expect(part.calls()).toBe(2);
    expect(document.querySelector("[data-trouble]")).toBeNull();
  });
});

describe("the connection coming back (world:lazy-part-fails-softly)", () => {
  const at = (v: number): PlayerView => ({ ...engineView(), v });

  function failingViews(answers: (PlayerView | Error)[]) {
    let asked = 0;
    const store = createGameStore(
      {
        view: () => {
          asked += 1;
          const answer = answers.length > 1 ? answers.shift() : answers[0];
          return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer as PlayerView);
        },
        send: () => Promise.reject(new Error("not sent")),
      },
      { wait: () => Promise.resolve() },
    );
    return { store, asked: () => asked };
  }

  test("[world:lazy-part-fails-softly] given a request failed for the connection, when the connection comes back, then it is tried again once and the card goes", async () => {
    const lost = requestFailure("network", "Load failed");
    const { store, asked } = failingViews([lost, lost, lost, at(4)]);
    await store.getState().refresh();
    expect(store.getState().trouble).toEqual({ kind: "network", during: "view" });
    const before = asked();
    await store.getState().backOnline();
    expect(asked()).toBe(before + 1);
    expect(store.getState().trouble).toBeNull();
    expect(store.getState().view?.v).toBe(4);
  });

  test("[world:lazy-part-fails-softly] given the request fails again when the connection comes back, then the card stays and nothing more is sent than one Retry sends", async () => {
    const lost = requestFailure("network", "Load failed");
    const byHand = failingViews([lost]);
    await byHand.store.getState().refresh();
    const beforeHand = byHand.asked();
    await byHand.store.getState().retry();
    const oneRetry = byHand.asked() - beforeHand;

    const { store, asked } = failingViews([lost]);
    await store.getState().refresh();
    const before = asked();
    await store.getState().backOnline();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(asked() - before).toBe(oneRetry);
    expect(store.getState().trouble?.kind).toBe("network");
  });

  test("[world:lazy-part-fails-softly] given a part failed for the connection while the world is up, when the browser says it is online again, then the part is fetched again and drawn", async () => {
    const part = flaky(1);
    world(softLazy(part.load));
    await screen.findByRole("button", { name: say("ui.trouble.retry") });
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(document.querySelector("[data-part]")).not.toBeNull());
    expect(part.calls()).toBe(2);
    expect(document.querySelector("[data-trouble]")).toBeNull();
  });

  test("[world:lazy-part-fails-softly] given the server failed rather than the connection, when the connection comes back, then nothing is sent again by itself", async () => {
    const down = requestFailure("server", "500");
    const { store, asked } = failingViews([down]);
    await store.getState().refresh();
    const before = asked();
    await store.getState().backOnline();
    expect(asked()).toBe(before);
    expect(store.getState().trouble?.kind).toBe("server");
  });
});
