// An interview holds the month in the world (docs/rules/interview.md R-INTERVIEW-004; world.md R-WORLD-025, R-WORLD-006): while
// a question waits, the nudge says something waits and opens the asks with the interview, and the bed's sleep turns no month
// (the corner says why); once the last answer is in, the sleep ends the month as ever. Moved from the old month page's End
// month button and its marked month tab. The scene is a stand-in that hands the city the taps a player makes.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { PlayerView } from "@japacity/sim";

import { optionWords } from "../../shared/sim/people";
import { engineView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { interviewGame, renderWithGame } from "../../shared/testing/people";
import { nameOf, say, words } from "../../shared/words/text";
import type { Act, Thing } from "../../shared/world/contract";
import { InterviewView } from "../interview/InterviewView";
import { DECEMBER } from "../setpiece/DecemberScene";
import { City } from "./City";
import { SLEEP_MS } from "./sleep";

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
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
  window.localStorage.clear();
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

describe("the interview holds the month in the world", () => {
  test("[R-INTERVIEW-004] given an interview open, then the month cannot end and the nudge marks what waits, until the last answer is in", async () => {
    const game = interviewGame();
    const { authority } = await renderWithGame(
      <City world results={(place) => <p data-results-for={place} />} asks={[<InterviewView key="interview" />]} asksAt={[null]} phone={(close) => <button type="button" data-stand-in-phone onClick={close} />} />,
      game,
    );
    await waitFor(() => found('[data-stand-in-act="mattress:end-month"]'), { timeout: 3000 });
    // The mark: the nudge says something waits and opens the asks with the interview's question.
    const mark = await waitFor(() => found("[data-nudge] [data-nudge-open]"));
    expect(mark.querySelector(".bg-signal")).not.toBeNull();
    fireEvent.click(mark);
    const region = await screen.findByRole("region", { name: nameOf("interview.genuineness") });
    expect(region).toBeDefined();

    // The month cannot end: with the asks put away, the bed's sleep is held, the corner says why, and nothing is sent.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("region", { name: nameOf("interview.genuineness") })).toBeNull());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    fireEvent.click(found('[data-stand-in-act="mattress:end-month"]'));
    // A life's first night is told once first (R-WORLD-025); its Sleep is the bed's.
    fireEvent.click(found("[data-night-teach-ok]"));
    expect([...document.querySelectorAll("[data-corner]")].map((line) => line.textContent)).toContain(words("reject.setpiece-open"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLEEP_MS + 100);
    });
    expect(authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(0);
    vi.useRealTimers();
    fireEvent.click(found("[data-nudge] [data-nudge-open]"));
    const asked = await screen.findByRole("region", { name: nameOf("interview.genuineness") });

    // The last answer in, the sleep ends the month.
    fireEvent.click(within(asked).getByRole("button", { name: optionWords("times-met", "four-to-eight") }));
    fireEvent.click(await screen.findByRole("button", { name: optionWords("partner-home", "city") }));
    await screen.findByText(say("ui.interview.waiting"));
    await waitFor(() => expect(game.view().interview?.question ?? null).toBeNull());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
    fireEvent.click(found('[data-stand-in-act="mattress:end-month"]'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SLEEP_MS + 100);
    });
    expect(authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(1);
  });

  // Moved from the old month bar (shared/words/plain.test.tsx): a set piece open holds the month in the engine's words.
  test("[R-SETPIECE-002] given the December visit or the road's night open, when the bed's sleep is tapped, then the corner says the engine's words and no month turns", async () => {
    for (const entry of [DECEMBER, "setpiece.road-night"] as const) {
      window.localStorage.setItem("japacity.city.last", JSON.stringify(["place.family-house"]));
      const base = engineView();
      const view: PlayerView = { ...base, month: Math.max(1, base.month), setpiece: { entry, asked: 0, total: 1, question: null } };
      const { authority } = await renderWithView(<City world results={(place) => <p data-results-for={place} />} />, view);
      fireEvent.click(await waitFor(() => found('[data-stand-in-act="mattress:end-month"]'), { timeout: 3000 }));
      expect([...document.querySelectorAll("[data-corner]")].map((line) => line.textContent)).toContain(words("reject.setpiece-open"));
      expect(authority.sent.filter((command) => command.type === "turn/end")).toHaveLength(0);
      cleanup();
    }
  });
});
