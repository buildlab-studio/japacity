// An act that repeats, at its thing (docs/rules/activity.md R-ACTIVITY-019, R-ACTIVITY-018; decision 0035): time with
// Mama answers at once each time it is asked for. Her sheet, which holds her shop beside it (R-WORLD-005: a third act goes
// on a sheet), does it now with its card's button, the card says the time in words, and it never says it counts when the
// month ends or is ongoing; asked again, it is done again. The place file is the one the game ships; the scene is a
// stand-in that hands the city the taps a player makes, and the sheet lists the cards as the game's own picker does.
import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { newGame } from "../../shared/testing/fixtures";
import { renderWithGame } from "../../shared/testing/people";
import { nameOf, say } from "../../shared/words/text";
import { ActivityPicker } from "../activity/ActivityView";
import type { Act, Thing } from "../../shared/world/contract";
import { City } from "./City";

type Pick = { kind: "thing"; thing: Thing } | { kind: "act"; thing: Thing; act: Act };

vi.mock("./CityScene", () => ({
  default: ({ things, onPick, acted }: { things?: Thing[]; onPick: (pick: Pick) => void; acted?: { activity: string; at: number } | null }) => (
    <div data-stand-in-scene data-stand-in-acted={acted?.activity ?? ""}>
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
const COOK = "activity.cook-at-home";

describe("an act that repeats, at its thing", () => {
  test("[R-ACTIVITY-019] [R-ACTIVITY-018] [R-WORLD-005] given time with Mama, when her sheet opens twice, then each time its card's button does it now, the card says a morning, it never counts at the month's end nor says Ongoing, and each press is sent at once", async () => {
    const game = newGame("scenario.ada");
    const { authority, store } = await renderWithGame(<City world results={() => <p />} actions={(ids) => <ActivityPicker only={ids} />} />, game);
    fireEvent.click(await waitFor(() => found('[data-stand-in-act="house:enter"]')));
    await waitFor(() => found('[data-stand-in-act="mama:family-time"]'), { timeout: 3000 });
    for (let time = 1; time <= 2; time += 1) {
      fireEvent.click(found('[data-stand-in-act="mama:family-time"]'));
      const picker = await waitFor(() => found("[data-activity-picker]"));
      // Her sheet holds her shop beside the gist.
      expect(picker.querySelector(`button[aria-label="${nameOf("activity.help-shop")}"]`)).not.toBeNull();
      const card = picker.querySelector<HTMLButtonElement>(`button[aria-label="${nameOf(FAMILY)}"]`)?.closest("li");
      const main = card?.querySelector<HTMLButtonElement>("button");
      if (card === null || card === undefined || main === null || main === undefined) throw new Error("No card for time with Mama.");
      expect(card.querySelector("[data-time]")?.textContent).toBe(say("ui.world.time.morning"));
      expect(say("ui.world.time.morning")).toBe("A morning");
      expect(main.hasAttribute("disabled")).toBe(false);
      expect(card.textContent).not.toContain(say("ui.world.counts-at-end"));
      expect(card.textContent).not.toContain(say("ui.activity.planned"));
      expect(card.textContent).not.toContain(say("ui.activity.uses-free"));
      fireEvent.click(main);
      await waitFor(() => expect(authority.sent.filter((command) => command.type === "activity/now" && command.activity === FAMILY)).toHaveLength(time));
      // The place answers in the same sheet, with Done to close it.
      fireEvent.click(await waitFor(() => found("[data-ask-main]")));
      await waitFor(() => expect(document.querySelector("[data-ask-form]")).toBeNull());
    }
    expect(store.getState().plan.some((pick) => pick !== null)).toBe(false);
  });
});

describe("an act the scene shows, from its sheet", () => {
  test("[R-WORLD-005] [R-ACTIVITY-019] given the cooking corner's sheet with both meals, when Indomie and egg is cooked from its card, then it is sent at once, no card answers it, the sheet closes so the pot is seen, and the scene is handed the act to show where it was done", async () => {
    const game = newGame("scenario.ada");
    const { authority } = await renderWithGame(<City world results={() => <p />} actions={(ids) => <ActivityPicker only={ids} />} />, game);
    fireEvent.click(await waitFor(() => found('[data-stand-in-act="house:enter"]')));
    fireEvent.click(await waitFor(() => found('[data-stand-in-act="cooking:cook"]'), { timeout: 3000 }));
    const picker = await waitFor(() => found("[data-activity-picker]"));
    const cook = picker.querySelector<HTMLButtonElement>(`button[aria-label="${nameOf(COOK)}"]`);
    if (cook === null) throw new Error("No card for Indomie and egg.");
    expect(nameOf(COOK)).toBe("Indomie and egg");
    fireEvent.click(cook);
    await waitFor(() => expect(authority.sent.filter((command) => command.type === "activity/now" && command.activity === COOK)).toHaveLength(1));
    await waitFor(() => expect(document.querySelector("[data-activity-picker]")).toBeNull());
    expect(document.querySelector("[data-ask-form]")).toBeNull();
    expect(found("[data-stand-in-scene]").dataset.standInActed).toBe(COOK);
  });
});
