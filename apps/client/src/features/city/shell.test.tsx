// The world's shell over the place (docs/rules/world.md R-WORLD-001 to 004): what stands over the
// scene, what hides when, and the nudge's choice. The scene itself needs WebGL and is not drawn here.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { City } from "./City";
import { nudgeOf } from "./nudge";

const world = (extra: Partial<Parameters<typeof City>[0]> = {}) => <City world month={<p data-month-body>month</p>} results={(place) => <p data-results-for={place} />} {...extra} />;

function band(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-band]");
  if (found === null) throw new Error("No band");
  return found;
}

function thumbs(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-thumb-bar]");
  if (found === null) throw new Error("No thumb bar");
  return found;
}

describe("the world fills the screen", () => {
  test("[R-WORLD-001] given a life in the world, when it opens, then only the band, the nudge and the Map and Phone buttons stand over the place", async () => {
    await renderWithView(world(), engineView());
    expect(band()).toBeTruthy();
    expect(document.querySelector("[data-nudge]")).not.toBeNull();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([say("ui.world.end-month"), say("ui.world.map"), say("ui.world.phone")]);
    expect(document.querySelector("[data-report-here], [data-overheard], [data-scene]")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[R-WORLD-001] given a set piece and offers waiting, when the world opens, then nothing of them stands over the place until the nudge is tapped, and the sheet opens over it", async () => {
    await renderWithView(world({ asks: <p data-asks-body>asks</p> }), richView());
    expect(document.querySelector("[data-scene], [data-asks-body]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.nudge.setpiece") }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("asks")).toBeTruthy();
    expect(band()).toBeTruthy();
  });

  test("[R-WORLD-001] given the world, when End month is tapped, then the Month sheet opens over it with the month's contents and closes back to it", async () => {
    await renderWithView(world(), engineView());
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.end-month") }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("month")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.world.close") }));
    expect(document.querySelector("[data-month-body]")).toBeNull();
  });
});

describe("the band and the thumb buttons", () => {
  test("[R-WORLD-002] given a life, when the band renders, then its clock is the character's age in years and months with the turns left beside it, and no month number", async () => {
    const view = engineView();
    await renderWithView(world(), view);
    const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
    expect(ageMonths).toBeGreaterThan(0);
    const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12, turns: view.turns.banked });
    expect(within(band()).getByText(clock)).toBeTruthy();
    expect(band().textContent).not.toContain(say("ui.world.month-of", { month: view.month + 1 }));
  });

  test("[R-WORLD-002] given the results showing, when the band renders, then it hides, and it shows again once the player goes back", async () => {
    const { store } = await renderWithView(world(), richView());
    expect(band().getAttribute("aria-hidden")).toBe("false");
    act(() => store.setState({ reportOpen: true }));
    expect(band().getAttribute("aria-hidden")).toBe("true");
    act(() => store.setState({ reportOpen: false }));
    expect(band().getAttribute("aria-hidden")).toBe("false");
  });

  test("[R-WORLD-002] given the staged wins still to show, when the month has ended, then the band stays until the results come up", async () => {
    const { store } = await renderWithView(world(), richView());
    const view = richView();
    act(() => store.setState({ reportOpen: true, moments: view.report?.lines.slice(0, 1) ?? [] }));
    expect(band().getAttribute("aria-hidden")).toBe("false");
  });

  test("[R-WORLD-004] given the results showing, when the thumb bar renders, then Map and Phone hide with it", async () => {
    const { store } = await renderWithView(world(), richView());
    expect(thumbs().getAttribute("aria-hidden")).toBe("false");
    act(() => store.setState({ reportOpen: true }));
    expect(thumbs().getAttribute("aria-hidden")).toBe("true");
  });

  test("[R-WORLD-008] [R-WORLD-025] given the month ended, when the shell shows, then the scene goes dark first, and the results are handed the name of where the player is", async () => {
    const { store } = await renderWithView(world(), engineView());
    const shown = band().querySelector("h2")?.textContent ?? "";
    act(() => store.setState({ reportOpen: true }));
    expect(document.querySelector("[data-cut]")?.getAttribute("data-cut")).toBe("true");
    expect(document.querySelector("[data-results-for]")).toBeNull();
    await waitFor(() => expect(document.querySelector("[data-results-for]")?.getAttribute("data-results-for")).toBe(shown));
  });
});

describe("the nudge", () => {
  const quiet = { ...engineView(), setpiece: null, interview: null, offers: [], report: null };
  const step = quiet.chapter.items.find((item) => !item.met)?.id;

  test("[R-WORLD-003] given the view, when the nudge is chosen, then it follows the order: question, offer, the chapter's step, a report line waiting, the month's end", () => {
    const rich = richView();
    expect(nudgeOf(rich).key).toBe("ui.nudge.setpiece");
    expect(nudgeOf({ ...rich, setpiece: null, interview: null }).key).toBe("ui.nudge.offer");
    expect(quiet.chapter.current).not.toBeNull();
    // The story's words for the step exist in content now, so the nudge takes them (R-WORLD-003).
    expect(nudgeOf(quiet).key).toBe(`${String(quiet.chapter.current)}.item.${String(step)}.nudge`);
    const noStep = { ...quiet, chapter: { ...quiet.chapter, current: null } };
    expect(nudgeOf({ ...noStep, report: rich.report }).key).toBe("ui.nudge.report");
    expect(nudgeOf(noStep).key).toBe("ui.nudge.end");
    const nothingWaits = rich.report === null ? null : { ...rich.report, lines: rich.report.lines.map((line) => ({ ...line, attention: false })) };
    expect(nudgeOf({ ...noStep, report: nothingWaits }).key).toBe("ui.nudge.end");
  });

  test("[R-WORLD-003] given the story has nudge words for the step, when the nudge is chosen, then they are used over the step's own words", () => {
    const own = `${String(quiet.chapter.current)}.item.${String(step)}`;
    expect(nudgeOf(quiet, (key) => key === `${own}.nudge`).key).toBe(`${own}.nudge`);
    expect(nudgeOf(quiet, () => false).key).toBe(own);
  });

  test("[R-WORLD-003] given the nudges the interface writes, then each is one sentence of at most eight words", () => {
    for (const key of ["ui.nudge.setpiece", "ui.nudge.offer", "ui.nudge.report", "ui.nudge.end"]) {
      const words = say(key);
      expect({ key, count: words.split(/\s+/).length <= 8, sentences: words.split(". ").length }).toEqual({ key, count: true, sentences: 1 });
    }
  });

  test("[R-WORLD-003] given an offer waiting, when it opens, then the nudge says so; and the nudge hides while the Month sheet is open", async () => {
    const { store } = await renderWithView(world(), { ...richView(), setpiece: null, interview: null, offers: [] });
    const nudge = () => document.querySelector("[data-nudge]")?.textContent ?? null;
    expect(nudge()).not.toBe(say("ui.nudge.offer"));
    const view = store.getState().view;
    if (view === null) throw new Error("No view");
    act(() => store.setState({ view: { ...view, offers: richView().offers } }));
    expect(nudge()).toBe(say("ui.nudge.offer"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.world.end-month") }));
    expect(nudge()).toBeNull();
  });
});
