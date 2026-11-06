// An act done at once starts at the tap (world:things-are-tappable-models, activity:now-acts-and-month-acts): its sheet
// closes and a toast says it in a few words, its name and when an answer comes; the place's own line is kept in News.
// Only an answer the player must see to choose stands as its sheet. Played on the real content through the engine.
import { content } from "@japacity/content";
import type { Id, ReportLine } from "@japacity/sim";
import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../../authority/store";
import { gameAuthority, newGame } from "../../../shared/testing/fixtures";
import { handBrief } from "../../../shared/world/briefHanded";
import { markTaught } from "../../../shared/world/taught";
import "../../../shared/testing/render";
import { actOnCard, nowLineIn } from "../../../shared/words/acts";
import { hasWords, inMonths, nameOf, say, words } from "../../../shared/words/text";
import { newsLines } from "../../../shared/words/told";
import { actNameOf, actToast, answerStays } from "./acts";
import { City } from "../City";

const HUNT = "activity.job-hunt" as Id<"activity">;
const PASSPORT = "activity.get-passport" as Id<"activity">;
const PAGE = "activity.look-into-route" as Id<"activity">;
const ASK_AROUND = "activity.ask-around" as Id<"activity">;
const RACKS = "activity.job-fish-racks";

async function played(): Promise<{ store: GameStore; game: ReturnType<typeof newGame> }> {
  const game = newGame("scenario.graduate");
  const store = createGameStore(gameAuthority(game));
  await store.getState().refresh();
  return { store, game };
}

function inWorld(store: GameStore): void {
  render(
    <GameProvider store={store}>
      <City world results={() => <p />} />
    </GameProvider>,
  );
}

function nowLine(key: string, params: ReportLine["params"]): ReportLine {
  return { key, params, tone: "plain", attention: false, counts: [] };
}

describe("an act's toast", () => {
  test("[world:things-are-tappable-models] given the job hunt sent at the clinic, when its toast is read, then it says the act's name and that the answer comes at the month's end, in a few words", () => {
    const toast = actToast(nowLine("line.activity.job-hunt.now", { activity: HUNT, param: "activity.job-nurse" }), 3);
    expect(toast).toEqual({ activity: HUNT, name: nameOf(HUNT), tag: say("ui.act.toast.month") });
    expect(`${toast.name} ${toast.tag ?? ""}`.split(/\s+/).length).toBeLessThanOrEqual(10);
  });

  test("[world:things-are-tappable-models] given a paper asked for that comes in some months, when its toast is read, then the tag says when it comes, never a month's number", () => {
    const toast = actToast(nowLine("line.activity.get-passport.now", { activity: PASSPORT, month: 6 }), 3);
    expect(toast.tag).toBe(say("ui.act.toast.comes", { when: inMonths(6, 3) }));
    expect(toast.tag).not.toMatch(/\b6\b/);
  });

  test("[world:things-are-tappable-models] given an act with no answer to come (the official page read), when its toast is read, then it says only the act's name", () => {
    expect(actToast(nowLine("line.activity.look-into-route.now", { activity: PAGE, param: "route.uk-care" }), 3)).toEqual({ activity: PAGE, name: nameOf(PAGE), tag: null });
  });

  test("[world:things-are-tappable-models] given the hunt sent at the racks, whose card says Work the fish racks and whose button says Start work, when its toast is read, then it names the work as the card does, with the racks' picture, never Look for a job", () => {
    const toast = actToast(nowLine("line.activity.job-hunt.now", { activity: HUNT, param: RACKS }), 3);
    expect(toast).toEqual({ activity: HUNT, name: say(`${RACKS}.act`), tag: say("ui.act.toast.month"), picture: RACKS });
    expect(toast.name).not.toBe(nameOf(HUNT));
    expect(toast.name).toBe(actNameOf(HUNT, RACKS));
  });

  test("[world:things-are-tappable-models] given every act whose button starts work (a job a board names by its own button words, an act done at once that starts a job), when its toast is read, then it names the act as its card does, a job's own act words where it has them", () => {
    const boards = Object.values(content.activity).filter((entry) => entry !== undefined && (entry.slot === "main" || entry.slot === "side") && hasWords(`${entry.id}.button`));
    const starts = Object.values(content.activity).filter((entry) => entry !== undefined && entry.when === "now" && entry.effects.some((effect) => effect.type === "activity/start-job"));
    expect(boards.length).toBeGreaterThan(0);
    expect(starts.length).toBeGreaterThan(0);
    for (const job of boards) {
      // A job whose own button says it starts the work names that work in its own words, on the card and the toast alike.
      expect({ job: job.id, act: hasWords(`${job.id}.act`) }).toEqual({ job: job.id, act: true });
      const toast = actToast(nowLine("line.activity.job-hunt.now", { activity: HUNT, param: job.id }), 3);
      expect({ job: job.id, name: toast.name }).toEqual({ job: job.id, name: actNameOf(HUNT, job.id) });
    }
    for (const entry of starts) {
      const toast = actToast(nowLine(`line.activity.${entry.id.replace(/^activity\./, "")}.now`, { activity: entry.id }), 3);
      expect({ act: entry.id, name: toast.name }).toEqual({ act: entry.id, name: actNameOf(entry.id, null) });
    }
  });

  test("[world:things-are-tappable-models] given every act done at once that is not repeated, when its answer is placed, then only the kiosk's ticket, the bet slip, the driver's answer and the grant made at once stand as a sheet", () => {
    const staying = Object.values(content.activity)
      .filter((entry) => entry !== undefined && entry.when === "now" && entry.repeat !== true && answerStays(entry.id))
      .map((entry) => entry?.id)
      .sort();
    expect(staying).toEqual(["activity.apply-graduate", "activity.ask-around", "activity.bet-slip", "activity.play-lotto"]);
  });
});

describe("an act started at the tap", () => {
  test("[world:things-are-tappable-models] [activity:now-acts-and-month-acts] given the graduate in the world, when the job hunt is sent, then no sheet answers it, the toast stands under the band with its name and goes by itself, and the place's line is kept in News", async () => {
    const { store } = await played();
    const job = store.getState().view!.activities.find((option) => option.id === HUNT)?.params?.[0];
    if (job === undefined) throw new Error("The graduate has no job to hunt.");
    // The opening card is passed and the first brief carried, as after its Let's go, so the band's toasts are not held behind the card.
    const { scenario, chapter } = store.getState().view!;
    markTaught("title", scenario);
    if (chapter.current !== null) handBrief(scenario, chapter.current);
    inWorld(store);
    await act(async () => {
      expect(await actOnCard({ activity: HUNT, param: job }, store.getState())).toBe("answered");
    });
    const toast = await waitFor(() => {
      const shown = document.querySelector<HTMLElement>(`[data-act-toast="${HUNT}"]`);
      if (shown === null) throw new Error("No toast for the hunt.");
      return shown;
    });
    expect(toast.textContent).toContain(nameOf(HUNT));
    expect(toast.textContent).toContain(say("ui.act.toast.month"));
    expect(document.querySelector("[data-ask-form]")).toBeNull();
    const said = nowLineIn(store.getState().lines);
    if (said === null) throw new Error("The place said nothing.");
    expect(document.body.textContent).not.toContain(words(said.key, said.params));
    const view = store.getState().view!;
    expect(newsLines(store.getState().lines, [], view).some((line) => line.key === said.key)).toBe(true);
    await waitFor(() => expect(document.querySelector("[data-act-toast]")).toBeNull(), { timeout: 5000 });
  });

  test("[world:things-are-tappable-models] given the motor park, when asking around, then the driver's answer still stands as its sheet, since it names a way out", async () => {
    const { store } = await played();
    inWorld(store);
    await act(async () => {
      await actOnCard({ activity: ASK_AROUND, param: null }, store.getState());
    });
    const card = await waitFor(() => {
      const sheet = document.querySelector<HTMLElement>("[data-ask-form]");
      if (sheet === null) throw new Error("No sheet is up.");
      return sheet;
    });
    expect(card.textContent).toContain("The driver says: Dubai, if you have the papers.");
    expect(document.querySelector("[data-act-toast]")).toBeNull();
  });
});
