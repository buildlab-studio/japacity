// The world's shell over the place (docs/rules/world.md R-WORLD-001 to 004): what stands over the
// scene, what hides when, and the nudge's choice. The scene itself needs WebGL and is not drawn here.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { say, words } from "../../shared/words/text";
import { City } from "./City";
import { nudgeOf } from "./nudge";

const world = (extra: Partial<Parameters<typeof City>[0]> = {}) => <City world month={<p data-month-body>month</p>} results={(place) => <p data-results-for={place} />} {...extra} />;

/** Renders the world and passes the chapter's opening words when a life has not played a month yet (R-WORLD-001). */
async function opened(ui: Parameters<typeof renderWithView>[0], view: Parameters<typeof renderWithView>[1]): Promise<Awaited<ReturnType<typeof renderWithView>>> {
  const rendered = await renderWithView(ui, view);
  const go = document.querySelector<HTMLElement>("[data-opening-go]");
  if (go !== null) fireEvent.click(go);
  return rendered;
}

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
  test("[R-WORLD-001] given a life that has not played a month, when the world opens, then the chapter's opening words stand over the dimmed world with the nudge, and Go dismisses them", async () => {
    const view = engineView();
    await renderWithView(world(), view);
    const opening = document.querySelector<HTMLElement>("[data-opening]");
    if (opening === null || view.chapter.current === null) throw new Error("No opening");
    expect(opening.dataset.opening).toBe(view.chapter.current);
    expect(opening.textContent).toContain(words(`${view.chapter.current}.open`));
    expect(opening.textContent).toContain(say(nudgeOf(view).key));
    fireEvent.click(screen.getByRole("button", { name: say("ui.opening.go") }));
    expect(document.querySelector("[data-opening]")).toBeNull();
    // A life with a month behind it opens straight on the world.
    document.body.innerHTML = "";
    await renderWithView(world(), richView());
    expect(document.querySelector("[data-opening]")).toBeNull();
  });

  test("[R-WORLD-001] given a life in the world, when it opens, then only the band, the nudge and the Map and Phone buttons stand over the place", async () => {
    const view = engineView();
    await opened(world(), view);
    expect(band()).toBeTruthy();
    expect(document.querySelector("[data-nudge]")).not.toBeNull();
    // The nudge is a button when it opens the way to what it names (R-WORLD-003).
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([say("ui.world.end-month"), say("ui.world.show-more"), say(nudgeOf(view).key), say("ui.world.map"), say("ui.world.phone")]);
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

  test("[R-WORLD-006] given three asks waiting, when the nudge is tapped, then the sheet shows one at a time, counted, with Next and Back", async () => {
    await renderWithView(world({ asks: [<p key="a" data-ask="a">first</p>, <p key="b" data-ask="b">second</p>, <p key="c" data-ask="c">third</p>] }), richView());
    fireEvent.click(screen.getByRole("button", { name: say("ui.nudge.setpiece") }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("first")).toBeTruthy();
    expect(within(sheet).queryByText("second")).toBeNull();
    expect(within(sheet).getByText(say("ui.world.ask-of", { n: 1, count: 3 }))).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.world.ask-next") }));
    expect(within(sheet).getByText("second")).toBeTruthy();
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.world.ask-next") }));
    expect(within(sheet).getByText("third")).toBeTruthy();
    expect(within(sheet).getByRole<HTMLButtonElement>("button", { name: say("ui.world.ask-next") }).disabled).toBe(true);
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.world.ask-back") }));
    expect(within(sheet).getByText("second")).toBeTruthy();
  });

  test("[R-WORLD-001] given the world, when End month is tapped, then the Month sheet opens over it with the month's contents and closes back to it", async () => {
    await opened(world(), engineView());
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
    await opened(world(), view);
    const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
    expect(ageMonths).toBeGreaterThan(0);
    const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
    expect(within(band()).getByText(clock)).toBeTruthy();
    expect(band().textContent).not.toContain(say("ui.world.month-of", { month: view.month + 1 }));
    expect(within(band()).getByText(say("ui.world.turns", { count: view.turns.banked }))).toBeTruthy();
  });

  test("[R-WORLD-002] given the results showing, when the band renders, then it hides, and it shows again once the player goes back", async () => {
    const { store } = await opened(world(), richView());
    expect(band().getAttribute("aria-hidden")).toBe("false");
    act(() => store.setState({ reportOpen: true }));
    expect(band().getAttribute("aria-hidden")).toBe("true");
    act(() => store.setState({ reportOpen: false }));
    expect(band().getAttribute("aria-hidden")).toBe("false");
  });

  test("[R-WORLD-002] given the staged wins still to show, when the month has ended, then the band stays until the results come up", async () => {
    const { store } = await opened(world(), richView());
    const view = richView();
    act(() => store.setState({ reportOpen: true, moments: view.report?.lines.slice(0, 1) ?? [] }));
    expect(band().getAttribute("aria-hidden")).toBe("false");
  });

  test("[R-WORLD-004] given the results showing, when the thumb bar renders, then Map and Phone hide with it", async () => {
    const { store } = await opened(world(), richView());
    expect(thumbs().getAttribute("aria-hidden")).toBe("false");
    act(() => store.setState({ reportOpen: true }));
    expect(thumbs().getAttribute("aria-hidden")).toBe("true");
  });

  test("[R-WORLD-008] [R-WORLD-025] given the month ended, when the shell shows, then the scene goes dark first, and the results are handed the name of where the player is", async () => {
    const { store } = await opened(world(), engineView());
    const shown = band().querySelector("h2")?.textContent ?? "";
    act(() => store.setState({ reportOpen: true }));
    expect(document.querySelector("[data-cut]")?.getAttribute("data-cut")).toBe("true");
    expect(document.querySelector("[data-results-for]")).toBeNull();
    await waitFor(() => expect(document.querySelector("[data-results-for]")?.getAttribute("data-results-for")).toBe(shown));
  });
});

describe("street talk", () => {
  test("[R-WORLD-026] given a place with overheard lines, when the world shows, then one line of chatter stands in the bottom corner, changes with time, and hides while a sheet is open", async () => {
    vi.useFakeTimers();
    try {
      await opened(world(), engineView());
      const chatter = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-chatter]");
      expect(chatter()).not.toBeNull();
      const first = chatter()?.textContent ?? "";
      expect(first.length).toBeGreaterThan(0);
      expect(first).not.toMatch(/[\u2013\u2014]/);
      const seen = new Set([first]);
      for (let turn = 0; turn < 6; turn += 1) {
        void act(() => vi.advanceTimersByTime(9000));
        seen.add(chatter()?.textContent ?? "");
      }
      expect(seen.size).toBeGreaterThan(1);
      fireEvent.click(screen.getByRole("button", { name: say("ui.world.end-month") }));
      expect(chatter()).toBeNull();
    } finally {
      vi.useRealTimers();
    }
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
    const { store } = await opened(world(), { ...richView(), setpiece: null, interview: null, offers: [] });
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
