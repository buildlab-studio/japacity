// engine:browser-authority-for-dev-only: the online authority's failures, as the store keeps them for the card: what went wrong by its kind,
// what it was for, and Retry sending the same again.
import type { ServerRejection } from "@japacity/api";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { Command, PlayerView, Reply } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { requestFailure } from "../shared/net/http";
import { engineView } from "../shared/testing/fixtures";
import { say } from "../shared/words/text";
import { createGameStore, VIEW_RETRY_MS } from "./store";

const at = (v: number): PlayerView => ({ ...engineView(), v });
const loadFailed = () => requestFailure("network", "Load failed");

/** A store on a scripted authority: each call takes the next answer, a value or an error; every command is kept. */
function scripted(views: (PlayerView | Error)[], replies: (Reply | ServerRejection | Error)[] = []) {
  const waits: number[] = [];
  const sent: Command[] = [];
  const next = <T>(queue: (T | Error)[]): Promise<T> => {
    const answer = queue.length > 1 ? queue.shift() : queue[0];
    if (answer === undefined) return Promise.reject(new Error("no answer scripted"));
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  };
  const store = createGameStore(
    {
      view: () => next(views),
      send: (command) => {
        sent.push(command);
        return next(replies);
      },
    },
    {
      wait: (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    },
  );
  return { store, waits, sent };
}

describe("the store when a request brings no answer (engine:browser-authority-for-dev-only)", () => {
  test("[engine:browser-authority-for-dev-only] given the view fails three times, then it is asked for again twice with a pause, then the card shows with the kind and never the browser's words", async () => {
    const { store, waits } = scripted([loadFailed()]);
    await store.getState().refresh();
    expect(waits).toEqual([...VIEW_RETRY_MS]);
    expect(store.getState().trouble).toEqual({ kind: "network", during: "view" });
    expect(store.getState().failed).toBeNull();
    expect(JSON.stringify(store.getState())).not.toContain("Load failed");
  });

  test("[engine:browser-authority-for-dev-only] given the view fails once and then answers, then no card shows", async () => {
    const { store, waits } = scripted([loadFailed(), at(3)]);
    await store.getState().refresh();
    expect(waits).toEqual([VIEW_RETRY_MS[0]]);
    expect(store.getState().trouble).toBeNull();
    expect(store.getState().view?.v).toBe(3);
  });

  test("[engine:browser-authority-for-dev-only] [account:session-is-secure-cookie] given a wall in front of the view, then the card says the session ended, and Retry once it is passed brings the view and closes the card", async () => {
    const wall = requestFailure("wall", "redirected (0)");
    const { store } = scripted([wall, wall, wall, at(5)]);
    await store.getState().refresh();
    expect(store.getState().trouble).toEqual({ kind: "wall", during: "view" });
    expect(say(`ui.trouble.${store.getState().trouble?.kind ?? ""}`)).toBe("Your session ended");
    await store.getState().retry();
    expect(store.getState().trouble).toBeNull();
    expect(store.getState().view?.v).toBe(5);
  });

  test("[account:session-is-secure-cookie] given a wall the page is already reloading for, then no card flashes and the view is not asked again: the login comes next", async () => {
    const { store, waits } = scripted([requestFailure("wall", "an opaque redirect", true)]);
    await store.getState().refresh();
    expect(waits).toEqual([]);
    expect(store.getState().trouble).toBeNull();
    expect(store.getState().failed).toBeNull();
  });

  test("[engine:browser-authority-for-dev-only] given a focus, a page shown again and a nudge at once, then one request reads the view", async () => {
    let asked = 0;
    const store = createGameStore({
      view: () => {
        asked += 1;
        return Promise.resolve(at(2));
      },
      send: () => Promise.reject(new Error("unused")),
    });
    await Promise.all([store.getState().refresh(), store.getState().refresh(), store.getState().refresh()]);
    expect(asked).toBe(1);
  });

  test("[engine:browser-authority-for-dev-only] given a command that brings no answer, then the card shows over the sheet, the plan is kept, and Retry sends the same command on the same version and hands its answer to the first sender", async () => {
    const { store, sent } = scripted([at(3)], [loadFailed(), { ok: true, view: at(4), lines: [] }]);
    await store.getState().refresh();
    store.getState().setSlot(0, { activity: "activity.learn-tech", param: null });
    const plan = store.getState().plan;
    const sending = store.getState().send({ type: "turn/end", slots: [] });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().trouble).toEqual({ kind: "network", during: "command" });
    expect(store.getState().busy).toBe(false);
    expect(store.getState().plan).toBe(plan);
    expect(store.getState().view?.v).toBe(3);
    await store.getState().retry();
    const reply = await sending;
    expect(reply?.ok).toBe(true);
    expect(sent.map((command) => command.basedOn)).toEqual([3, 3]);
    expect(store.getState().trouble).toBeNull();
    expect(store.getState().view?.v).toBe(4);
  });

  test("[engine:browser-authority-for-dev-only] given a retried command comes back stale, then it most likely landed the first time: the latest view shows and nothing is refused", async () => {
    const stale: ServerRejection = { ok: false, code: "stale", detail: "moved on" };
    const { store } = scripted([at(3), at(4)], [requestFailure("server", "502"), stale]);
    await store.getState().refresh();
    const sending = store.getState().send({ type: "turn/end", slots: [] });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().trouble).toEqual({ kind: "server", during: "command" });
    await store.getState().retry();
    await sending;
    expect(store.getState().rejection).toBeNull();
    expect(store.getState().view?.v).toBe(4);
  });

  test("[engine:browser-authority-for-dev-only] given Begin brings no answer, then the card shows for the life, Begin waits, and Retry starts the life", async () => {
    let tries = 0;
    const store = createGameStore(
      { view: () => Promise.resolve(at(1)), send: () => Promise.reject(new Error("unused")) },
      {
        choosingLife: true,
        life: {
          newLife: () => {
            tries += 1;
            return tries === 1 ? Promise.reject(requestFailure("network", "no answer in 15000 ms")) : Promise.resolve(at(1));
          },
        },
      },
    );
    let begun = false;
    const beginning = store
      .getState()
      .chooseLife("scenario.prologue")
      .then(() => {
        begun = true;
      });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(store.getState().trouble).toEqual({ kind: "network", during: "life" });
    expect(store.getState().choosingLife).toBe(true);
    expect(begun).toBe(false);
    await store.getState().retry();
    await beginning;
    expect(begun).toBe(true);
    expect(store.getState().choosingLife).toBe(false);
    expect(store.getState().view?.v).toBe(1);
  });

  test("[engine:browser-authority-for-dev-only] given a fault that is no request's, then the game could not start keeps it as ours by its kind, never the error's own text", async () => {
    const { store } = scripted([new Error("Cannot read properties of undefined (reading 'v')")]);
    await store.getState().refresh();
    expect(store.getState().failed).toBe("server");
    expect(say("ui.failed")).toBe("The game could not start");
    expect(say(`ui.failed.${store.getState().failed ?? ""}.detail`)).toBe("Something went wrong on our side. Reload in a moment.");
  });

  test("[engine:browser-authority-for-dev-only] [world:lazy-part-fails-softly] the card's headline, by kind, says what happened in a few plain words with no full stop, and its detail says what to do", () => {
    expect([say("ui.trouble.network"), say("ui.trouble.wall"), say("ui.trouble.server"), say("ui.trouble.retry"), say("ui.trouble.reload"), say("ui.loading.slow")]).toEqual([
      "Could not connect",
      "Your session ended",
      "Something went wrong on our side",
      "Retry",
      "Reload",
      "Still opening...",
    ]);
    expect([say("ui.trouble.network.detail"), say("ui.trouble.wall.detail"), say("ui.trouble.server.detail")]).toEqual([
      "Check your connection, then try again.",
      "Reload, then sign in if the game asks.",
      "It is not your connection. Try again in a moment.",
    ]);
  });

  test("[engine:browser-authority-for-dev-only] the game could not start, by kind, says what to do under one headline", () => {
    expect([say("ui.failed.network.detail"), say("ui.failed.wall.detail"), say("ui.failed.server.detail")]).toEqual([
      "Check your connection, then reload.",
      "Your session ended. Reload, then sign in if the game asks.",
      "Something went wrong on our side. Reload in a moment.",
    ]);
  });

  test("[engine:browser-authority-for-dev-only] no catch in the authority is empty: each says what follows the failure", () => {
    const folder = import.meta.dirname;
    const files = readdirSync(folder).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));
    const empty: string[] = [];
    for (const name of files) {
      const source = readFileSync(join(folder, name), "utf8");
      // A catch whose block holds nothing but comments and blank lines.
      for (const match of source.matchAll(/catch\s*(\([^)]*\))?\s*\{((?:\s|\/\/[^\n]*)*)\}/g)) empty.push(`${name}: ${match[0].slice(0, 60)}`);
    }
    expect(files).toContain("online.ts");
    expect(empty).toEqual([]);
  });
});
