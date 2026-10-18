// Acts that answer in the place (docs/rules/activity.md R-ACTIVITY-015): a now-act's card sends it at once and the
// place answers in a person's voice, with Done to close; a month-act fills a slot of the month. Played on the real
// content through the engine, as the local authority plays it.
import { text } from "@japacity/content";
import type { Id } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { gameAuthority, newGame } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { actOnCard, nowLineIn } from "../../shared/words/acts";
import { say, words } from "../../shared/words/text";
import { actsOffered, answerAsk } from "./acts";
import { City } from "./City";

const LOTTO = "activity.play-lotto" as Id<"activity">;
const ASK_AROUND = "activity.ask-around" as Id<"activity">;
const PASSPORT = "activity.get-passport" as Id<"activity">;
const MEETUP = "activity.meetup" as Id<"activity">;
const HUNT = "activity.job-hunt" as Id<"activity">;
const LEARN = "activity.learn-tech" as Id<"activity">;
// Decision 0012 (R-ACTIVITY-019): the coding course now answers at once and repeats; the course that fills a slot of the
// month is a master's at home.
const COURSE = "activity.masters-at-home" as Id<"activity">;

async function played(): Promise<{ store: GameStore; sent: ReturnType<typeof gameAuthority>["sent"]; game: ReturnType<typeof newGame> }> {
  const game = newGame("scenario.ada");
  const authority = gameAuthority(game);
  const store = createGameStore(authority);
  await store.getState().refresh();
  return { store, sent: authority.sent, game };
}

function inWorld(store: GameStore): void {
  render(
    <GameProvider store={store}>
      <City world results={() => <p />} />
    </GameProvider>,
  );
}

function askShown(): HTMLElement {
  const sheet = document.querySelector<HTMLElement>("[data-ask-form]");
  if (sheet === null) throw new Error("No sheet is up.");
  return sheet;
}

describe("a card's button", () => {
  test("[R-ACTIVITY-015] given the kiosk's slip, when Buy is pressed, then the ticket is bought now and nothing is planned; the slip stays with the kiosk's line and Done, and the draw comes with the month", async () => {
    const { store, sent } = await played();
    inWorld(store);
    await act(async () => {
      expect(await actOnCard({ activity: LOTTO, param: "1" }, store.getState())).toBe("answered");
    });
    expect(sent.at(-1)).toMatchObject({ type: "activity/now", activity: LOTTO, param: "1" });
    expect(store.getState().plan.some((pick) => pick?.activity === LOTTO)).toBe(false);
    const slip = await waitFor(askShown);
    expect(slip.dataset.askForm).toBe("slip");
    expect(slip.textContent).toContain(text["line.activity.play-lotto.now"]);
    const done = screen.getByRole("button", { name: say("ui.world.done") });
    fireEvent.click(done);
    await waitFor(() => expect(document.querySelector("[data-ask-form]")).toBeNull());
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(store.getState().view?.report?.lines.some((line) => line.key === "line.activity.lotto-lost" || line.key === "line.activity.lotto-won")).toBe(true);
  });

  test("[R-ACTIVITY-015] given the motor park, when asking around, then the driver's line is the answer, the Gulf is heard of now and the pitch is open now", async () => {
    const { store } = await played();
    inWorld(store);
    await act(async () => {
      await actOnCard({ activity: ASK_AROUND, param: null }, store.getState());
    });
    const card = await waitFor(askShown);
    expect(card.dataset.askForm).toBe("card");
    expect(card.textContent).toContain("The driver says: Dubai, if you have the papers.");
    const view = store.getState().view!;
    expect(view.routes.find((route) => route.id === "route.gulf-contract")?.state).toBe("heard");
    expect(view.offers.some((offer) => offer.entry === "offer.road-park")).toBe(true);
  });

  test("[R-ACTIVITY-015] given no passport, when it is asked for, then the passport is on its way now and the answer says in how many months, never a month number", async () => {
    const { store } = await played();
    await act(async () => {
      await actOnCard({ activity: PASSPORT, param: null }, store.getState());
    });
    const view = store.getState().view!;
    const passport = view.documents.find((paper) => paper.id === "document.passport");
    expect(passport?.state).toBe("pending");
    const line = nowLineIn(store.getState().lines);
    if (line === null) throw new Error("The office said nothing.");
    const months = (passport?.readyMonth ?? 0) - view.month;
    expect(words(line.key, line.params)).toBe(`Passport applied for. It is on its way, in ${String(months)} months.`);
  });

  test("[R-ACTIVITY-015] given a month-act, when its button is pressed, then it fills the next free slot and nothing is sent", async () => {
    const { store, sent } = await played();
    const before = sent.length;
    expect(await actOnCard({ activity: COURSE, param: null }, store.getState())).toBe("planned");
    expect(sent.length).toBe(before);
    expect(store.getState().plan).toContainEqual({ activity: COURSE, param: null });
    // Decision 0012: the coding course is sent at once, as often as wanted, and never fills a slot.
    for (let time = 0; time < 2; time += 1) {
      await act(async () => {
        expect(await actOnCard({ activity: LEARN, param: null }, store.getState())).toBe("answered");
      });
    }
    expect(sent.slice(before)).toEqual([expect.objectContaining({ type: "activity/now", activity: LEARN }), expect.objectContaining({ type: "activity/now", activity: LEARN })]);
    expect(store.getState().plan).not.toContainEqual({ activity: LEARN, param: null });
  });
});

describe("the place's answer", () => {
  test("[R-ACTIVITY-015] given a now-line, when the sheet shows it, then a paper bought keeps its slip, any other is a card, the line is the speaker's words, and the one button is Done", () => {
    const close = (): void => undefined;
    const slip = answerAsk({ key: "line.activity.play-lotto.now", params: { activity: LOTTO, param: "1" }, tone: "plain", attention: false, counts: [] }, { who: "Ojuelegba", clock: "21Y 3M" }, close);
    expect(slip).toMatchObject({ form: "slip", line: text["line.activity.play-lotto.now"], button: say("ui.world.done"), cost: null, when: "now" });
    const card = answerAsk({ key: "line.activity.ask-around.now", params: { activity: ASK_AROUND }, tone: "plain", attention: false, counts: [] }, { who: "The motor park", clock: "21Y 3M" }, close);
    expect(card).toMatchObject({ form: "card", who: "The motor park", line: "The driver says: Dubai, if you have the papers.", button: say("ui.world.done") });
  });
});

describe("the thing's chip", () => {
  test("[R-ACTIVITY-015] given a now-act done this month, when the acts the place offers are read, then it is gone this month and back the next; a purchase stays", async () => {
    const { store } = await played();
    const job = store.getState().view!.activities.find((option) => option.id === HUNT)?.params?.[0];
    if (job === undefined) throw new Error("Ada has no job to hunt.");
    expect(actsOffered(store.getState().view!)).toEqual(expect.arrayContaining([MEETUP, HUNT, job, LOTTO]));
    await act(async () => {
      await actOnCard({ activity: MEETUP, param: null }, store.getState());
      await actOnCard({ activity: HUNT, param: job }, store.getState());
      await actOnCard({ activity: LOTTO, param: "1" }, store.getState());
    });
    // Decision 0012 (R-ACTIVITY-019): an act that repeats is never done for the month, so it stays offered, as a purchase does.
    await act(async () => {
      await actOnCard({ activity: LEARN, param: null }, store.getState());
    });
    const after = actsOffered(store.getState().view!);
    expect(after).toContain(LEARN);
    expect(after).not.toContain(MEETUP);
    expect(after).not.toContain(HUNT);
    expect(after).not.toContain(job);
    expect(after).toContain(LOTTO);
    await act(async () => {
      await store.getState().endMonth();
    });
    expect(actsOffered(store.getState().view!)).toEqual(expect.arrayContaining([MEETUP, LOTTO]));
  });
});
