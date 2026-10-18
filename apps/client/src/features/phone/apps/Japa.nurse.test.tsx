// The nurse's years in Japa (world:phone-holds-what-phones-hold, chapter:chapters-follow-lean-route): the months on the ward
// counted while they run, the council's months said while it works, and a step not yet
// ticked says where it is taken (the lapsed licence's renewal at the clinic). Real content, nurses played through `step`.
import type { PlayerView, SlotPick } from "@japacity/sim";
import { cleanup } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { hire, month, readCare, tileNurse, until } from "../../../shared/testing/nurse";
import { cardFace } from "../../../shared/share/face";
import { renderWithView } from "../../../shared/testing/render";
import { inMonths } from "../../../shared/words/text";
import { Japa } from "./Japa";

const FILE = "chapter.build-the-file-care";
const VERIFY: SlotPick = { activity: "activity.request-verification", param: null };

function chapterSteps(): { words: string; way: string | null; met: string | null }[] {
  return [...document.querySelectorAll("[data-chapter-steps] li")].map((item) => ({ words: item.querySelector("span span")?.textContent ?? "", way: item.querySelector("[data-step-way]")?.textContent ?? null, met: item.getAttribute("data-met") }));
}

function routeSteps(): { words: string; way: string | null; met: string | null }[] {
  return [...document.querySelectorAll("[data-steps] li")].map((item) => ({ words: item.querySelector("span span")?.textContent ?? "", way: item.querySelector("[data-step-way]")?.textContent ?? null, met: item.getAttribute("data-met") }));
}

/** The tile's nurse on the ward, in her care file. */
function onTheWard(seed: string): ReturnType<typeof tileNurse> {
  const game = tileNurse(seed);
  hire(game);
  readCare(game);
  until(game, (view) => view.chapter.current === FILE, 4);
  return game;
}

describe("the nurse's months in Japa", () => {
  test("[world:phone-holds-what-phones-hold] [chapter:chapters-follow-lean-route] given the tile's nurse on the ward, when Japa shows each month, then the months on the ward are counted, rising, until the twenty-four are in and the step is ticked", async () => {
    const game = onTheWard("nurse-ward");
    for (let months = 0; months < 3; months += 1) month(game);
    const view = game.view();
    expect(view.job.months).toBeGreaterThan(0);
    await renderWithView(<Japa />, view);
    expect(chapterSteps()[0]).toEqual({ words: `${String(view.job.months)} of 24 months on the ward`, way: null, met: "false" });
    month(game);
    cleanup();
    await renderWithView(<Japa />, game.view());
    expect(chapterSteps()[0]?.words).toBe(`${String(view.job.months + 1)} of 24 months on the ward`);
    const done = until(game, (now) => now.chapter.items.find((item) => item.id === "tenure")?.met === true, 30);
    cleanup();
    await renderWithView(<Japa />, done);
    expect(chapterSteps()[0]).toEqual({ words: "Twenty-four months on the ward", way: null, met: "true" });
  });

  test("[world:phone-holds-what-phones-hold] given the council asked for the verification, when Japa shows while it works, then the step says when the council answers", async () => {
    const game = onTheWard("nurse-noticed");
    until(game, (view) => view.activities.find((option) => option.id === VERIFY.activity)?.allowed === true, 30);
    month(game, [VERIFY]);
    const view: PlayerView = game.view();
    const paper = view.documents.find((held) => held.id === "document.nmcn-verification");
    expect(paper?.state).toBe("pending");
    await renderWithView(<Japa />, view);
    expect(chapterSteps()[1]).toMatchObject({ way: `The council answers ${inMonths(paper?.readyMonth ?? 0, view.month)}`, met: "false" });
  });

  test("[world:phone-holds-what-phones-hold] [document:one-pending-copy] given the tile's nurse whose licence has run out, when Japa shows, then the licence's step is unticked and says where it is renewed; ticked steps say no way", async () => {
    const game = onTheWard("nurse-licence");
    const lapsed = until(game, (view) => view.documents.some((held) => held.id === "document.nursing-licence" && held.state === "expired"), 60, (view) => (view.activities.find((option) => option.id === VERIFY.activity)?.allowed === true ? [VERIFY] : []));
    await renderWithView(<Japa />, lapsed);
    const steps = routeSteps();
    // The renewal is a message to the council from the phone, in the Papers app.
    expect(steps[0]).toEqual({ words: "Nursing licence held", way: "Renew it with the council on your phone", met: "false" });
    expect(steps.filter((step) => step.met === "true").every((step) => step.way === null)).toBe(true);
  });
});

describe("the nurse's way out and figure", () => {
  test("[world:phone-holds-what-phones-hold] [chapter:chapters-follow-lean-route] [share:card-contents] given the tile's nurse whose care page is read while health care is shut to applicants from abroad, when Japa and the chapter's card show, then both name health care and its figure", async () => {
    const game = tileNurse("nurse-page");
    hire(game);
    readCare(game);
    const view = until(game, (now) => now.card?.kind === "chapter", 4);
    const care = view.routes.find((route) => route.id === "route.uk-care");
    expect(view.japacity.percent).toBeNull();
    expect(care?.percent).not.toBeNull();
    await renderWithView(<Japa />, view);
    expect(document.querySelector("[data-japa-percent]")?.getAttribute("data-japa-percent")).toBe(String(care?.percent));
    expect(document.querySelector("[data-japa-gloss]")).not.toBeNull();
    const face = cardFace(view.card!, view.scenario);
    expect(face.route).toBe("Health care in the UK");
    expect(face.percent).toBe(care?.percent);
  });
});
