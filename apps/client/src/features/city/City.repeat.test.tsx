// An act that repeats, at its thing (docs/rules/activity.md R-ACTIVITY-019, R-ACTIVITY-018; world.md R-WORLD-005;
// decision 0035): time with Mama answers at once each time it is asked for. Her sheet's button does it now, and it never
// says it counts when the month ends or is ongoing; asked again, it is done again, and each time her words land over her
// head. The place file is the one
// the game ships; the scene is a stand-in that hands the city the taps a player makes.
import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/people";
import { say, words } from "../../shared/words/text";
import { hush, linesNow, resetLines } from "../../shared/world/Lines";
import type { Act, Thing } from "../../shared/world/contract";
import { City } from "./City";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

vi.mock("./CityScene", () => ({
  default: ({ things, onPick }: { things?: Thing[]; onPick: (pick: Pick) => void }) => (
    <div data-stand-in-scene>
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
  window.localStorage.clear();
  Reflect.deleteProperty(window, "WebGL2RenderingContext");
});

function found(selector: string): HTMLElement {
  const one = document.querySelector<HTMLElement>(selector);
  if (one === null) throw new Error(`Nothing at ${selector}.`);
  return one;
}

const FAMILY = "activity.family-time";

describe("an act that repeats, at its thing", () => {
  test("[R-ACTIVITY-019] [R-ACTIVITY-018] [R-WORLD-005] given time with Mama, when her sheet opens twice, then each time the button does it now, the sheet says no time taken, it never counts at the month's end nor says Ongoing, each press is sent at once, and each time her words land over her head, not in the corner nor on a card", async () => {
    resetLines();
    const game = newGame("scenario.ada");
    const { authority, store } = await renderWithGame(<City world results={() => <p />} />, game);
    fireEvent.click(await waitFor(() => found('[data-stand-in-act="house:enter"]')));
    await waitFor(() => found('[data-stand-in-act="mama:family-time"]'), { timeout: 3000 });
    for (let time = 1; time <= 2; time += 1) {
      fireEvent.click(found('[data-stand-in-act="mama:family-time"]'));
      const main = await waitFor(() => found("[data-ask-main]"));
      // Gist takes no time (R-ACTIVITY-020: halfDays 0), so the sheet names none; what it does stands instead.
      expect(document.querySelector("[data-ask-time]")).toBeNull();
      expect(found("[data-ask-does]").textContent).toBe(`${say("ui.world.does")}Lifts you`);
      expect(main.hasAttribute("disabled")).toBe(false);
      expect(main.textContent).toContain(say("ui.world.now"));
      expect(main.textContent).not.toContain(say("ui.world.counts-at-end"));
      expect(main.textContent).not.toContain(say("ui.activity.planned"));
      act(() => hush());
      fireEvent.click(main);
      await waitFor(() => expect(authority.sent.filter((command) => command.type === "activity/now" && command.activity === FAMILY)).toHaveLength(time));
      // Her words land over her head, every time, and the sheet goes: no answer card with Done (R-WORLD-005).
      await waitFor(() => expect(linesNow().speech).toMatchObject({ who: "mama", text: "You have eaten? Sit small." }));
      expect(linesNow().speech?.name).toBeTruthy();
      await waitFor(() => expect(document.querySelector("[data-ask-form]")).toBeNull());
      expect(linesNow().lines.map((line) => line.text)).not.toContain(words("line.activity.family-time.now"));
    }
    expect(store.getState().plan.some((pick) => pick !== null)).toBe(false);
  });
});
