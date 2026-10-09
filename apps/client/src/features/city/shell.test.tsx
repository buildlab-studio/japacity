// The world's shell over the place (docs/rules/world.md R-WORLD-001 to 004): what stands over the
// scene, what hides when, and the nudge's choice. The scene itself needs WebGL and is not drawn here.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView, newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { inMonths, say, words } from "../../shared/words/text";
import { City } from "./City";
import { cityWords } from "./city.words";
import { nudgeOf, stepWayOf } from "./nudge";

const world = (extra: Partial<Parameters<typeof City>[0]> = {}) => <City world month={<p data-month-body>month</p>} results={(place) => <p data-results-for={place} />} {...extra} />;

/** Renders the world and passes the chapter's opening words when a life has not played a month yet (R-WORLD-001). */
async function opened(ui: Parameters<typeof renderWithView>[0], view: Parameters<typeof renderWithView>[1]): Promise<Awaited<ReturnType<typeof renderWithView>>> {
  const rendered = await renderWithView(ui, view);
  const go = document.querySelector<HTMLElement>("[data-opening-go]");
  if (go !== null) fireEvent.click(go);
  // Go takes the step's way, which may open the map; these tests want the world under it.
  const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
  if (mapClose !== null) fireEvent.click(mapClose);
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
    // The nudge is a button when it opens the way to what it names (R-WORLD-003); the band's handle shows only while something is coming (R-WORLD-002).
    // The months the player may still play are part of the band, a glyph with the number (R-WORLD-027).
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([say("ui.months.label", { count: view.turns.banked }), say("ui.world.end-month"), say(nudgeOf(view).key), say("ui.world.map"), say("ui.world.phone")]);
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
  test("[R-WORLD-002] [R-WORLD-027] given a life, when the band renders, then its clock is the character's age in years and months with the months to play beside it at all times, and no month number", async () => {
    const view = engineView();
    await opened(world(), view);
    const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
    expect(ageMonths).toBeGreaterThan(0);
    const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
    expect(within(band()).getByText(clock)).toBeTruthy();
    expect(band().textContent).not.toContain(say("ui.world.month-of", { month: view.month + 1 }));
    // R-WORLD-027 replaces the hide-until-three: the count shows at all times, as a glyph with the number, never as a sentence.
    expect(view.turns.banked).toBeGreaterThan(3);
    expect(within(band()).getByRole("button", { name: say("ui.months.label", { count: view.turns.banked }) }).textContent).toBe(String(view.turns.banked));
    document.body.innerHTML = "";
    await opened(world(), { ...view, turns: { ...view.turns, banked: 2 } });
    expect(within(band()).getByRole("button", { name: say("ui.months.label", { count: 2 }) }).textContent).toBe("2");
  });

  test("[R-WORLD-003] given a chip open when the month ends, when the results show, then the chip is gone and the nudge is back", async () => {
    const view = { ...engineView(), report: null };
    const { store } = await opened(world(), view);
    act(() => store.setState({ reportOpen: true, view: { ...view, report: richView().report } }));
    expect(document.querySelector("[data-thing-chip]")).toBeNull();
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

  test("[R-WORLD-003] given a step already started, when the nudge is chosen, then it names the wait: a paper on its way, a school's answer, a hunt or a test planned, funds short", () => {
    const base = { ...quiet, month: 10 };
    const file = { ...base, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }, { id: "transcript", met: false }, { id: "english", met: false }, { id: "offer", met: false }], done: [] } };
    const waiting = { ...file, documents: [{ id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null }] };
    expect(nudgeOf(waiting)).toMatchObject({ key: "chapter.build-the-file.item.passport.started", params: { when: inMonths(12, 10) }, about: "step" });
    expect(nudgeOf(file).key).toBe("chapter.build-the-file.item.passport.nudge");
    const testing = { ...file, chapter: { ...file.chapter, items: [{ id: "english", met: false }, { id: "offer", met: false }] } };
    // The test planned waits on the month's end; `.started` names the result on its way.
    expect(nudgeOf(testing, undefined, ["activity.sit-english-test"]).key).toBe("chapter.build-the-file.item.english.planned");
    const applied = { ...file, chapter: { ...file.chapter, items: [{ id: "offer", met: false }] }, routes: [{ ...richView().routes[0]!, id: "route.uk-masters" as const, schools: [{ id: "school.one" as never, state: "pending" as const, readyMonth: 11, discount: 0 }] }] };
    expect(nudgeOf(applied)).toMatchObject({ key: "chapter.build-the-file.item.offer.started", params: { when: inMonths(11, 10) } });
    const hunting = { ...base, chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "job", met: false }], done: [] } };
    expect(nudgeOf(hunting, undefined, ["activity.job-hunt"]).key).toBe("chapter.find-your-feet.item.job.started");
    const short = { ...base, chapter: { current: "chapter.decision-day" as const, items: [{ id: "held", met: false }], done: [] }, routes: [{ ...richView().routes[0]!, id: "route.uk-masters" as const, funds: { heldMonths: 0, covered: false, shown: 100000, required: 300000 } }] };
    expect(nudgeOf(short)).toMatchObject({ key: "chapter.decision-day.item.held.short", params: { amount: formatMoney(200000, "GBP") } });
  });

  test("[R-WORLD-003] given a step planned this month, or one the player cannot afford, when the nudge is chosen, then it says so: the planned step waits on the month, the dear one names the gap", () => {
    const file = { ...quiet, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }], done: [] } };
    expect(nudgeOf(file, undefined, ["activity.get-passport"]).key).toBe("chapter.build-the-file.item.passport.planned");
    const dear = {
      ...file,
      pockets: { ...file.pockets, NGN: { ...file.pockets.NGN, bank: 100000, cash: 0 } },
      activities: file.activities.map((option) => (option.id === "activity.get-passport" ? { ...option, affordable: false, cost: [{ currency: "NGN" as const, amount: 10000000, reason: "fee-document" as const }] } : option)),
    };
    expect(nudgeOf(dear)).toMatchObject({ key: "chapter.build-the-file.item.passport.short", params: { amount: formatMoney(9900000, "NGN") } });
  });

  test("[R-WORLD-003] given a step short of money, when a hunt is planned or the job's pay covers the gap, then the nudge says so; given the page or the meetup planned, then it waits on the month; abroad the dues gap comes before the step", () => {
    const file = { ...quiet, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "english", met: false }], done: [] } };
    const dear = {
      ...file,
      pockets: { ...file.pockets, NGN: { ...file.pockets.NGN, bank: 100000, cash: 0 } },
      activities: file.activities.map((option) => (option.id === "activity.sit-english-test" ? { ...option, affordable: false, cost: [{ currency: "NGN" as const, amount: 10000000, reason: "fee-test" as const }] } : option)),
    };
    expect(nudgeOf(dear).key).toBe("chapter.build-the-file.item.english.short");
    expect(nudgeOf(dear, undefined, ["activity.job-hunt"]).key).toBe("ui.nudge.hunt-planned");
    // A job whose month's pay covers the gap: the nudge says to work and save.
    const paid = { ...dear, job: { ...dear.job, id: "activity.job-junior-dev" as const } };
    expect(nudgeOf(paid).key).toBe("chapter.build-the-file.item.english.saving");
    // The month's bills eat the pay: the nudge says the gap, never "work and save".
    const billed = { ...paid, obligations: [{ ...paid.obligations[0]!, due: 40_000_000, entry: "obligation.upkeep" as never }] };
    expect(nudgeOf(billed)).toMatchObject({ key: "chapter.build-the-file.item.english.short", params: { amount: formatMoney(9_900_000, "NGN") } });
    const first = { ...quiet, chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "known", met: false }], done: [] } };
    expect(nudgeOf(first, undefined, ["activity.look-into-route"]).key).toBe("chapter.find-your-feet.item.known.planned");
    // The adviser's visit looks into the route too.
    expect(nudgeOf(first, undefined, ["activity.see-adviser"]).key).toBe("chapter.find-your-feet.item.known.planned.see-adviser");
    const heard = { ...first, chapter: { ...first.chapter, items: [{ id: "heard", met: false }] } };
    expect(nudgeOf(heard, undefined, ["activity.meetup"]).key).toBe("chapter.find-your-feet.item.heard.planned");
    const abroad = {
      ...file,
      place: { ...file.place, where: "abroad" as const, country: "country.uk" as const },
      pockets: { ...file.pockets, GBP: { bank: 10000, cash: 0, locked: 0 } },
      obligations: [{ ...file.obligations[0]!, due: 500000, entry: "obligation.rent-room-uk" as never }],
    };
    expect(nudgeOf(abroad).about).toBe("dues");
  });

  test("[R-WORLD-006] given an ask that belongs at the family house, when the sheet opens elsewhere, then it says someone waits there and one button goes there", async () => {
    const view = { ...richView(), setpiece: null, interview: null };
    await opened(world({ asks: [<p key="a" data-ask="a">the send-off</p>], asksAt: ["place.family-house"] }), view);
    fireEvent.click(screen.getByRole("button", { name: say("ui.nudge.offer") }));
    const sheet = screen.getByRole("dialog");
    expect(sheet.querySelector("[data-ask-away]")?.getAttribute("data-ask-away")).toBe("place.family-house");
    expect(within(sheet).queryByText("the send-off")).toBeNull();
    expect(within(sheet).getByRole("button", { name: say("ui.world.go-there") })).toBeTruthy();
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

describe("the trader from sixteen with a shop's capital", () => {
  test("[R-WORLD-001] [R-WORLD-003] given a settled trader at his handover, when the world opens, then the opening words speak of the settlement and the nudge sends him to the meetup, not the board", () => {
    const game = newGame("scenario.prologue", "sixteen-0");
    for (let turn = 0; turn < 40 && game.state.prologue.open; turn += 1) {
      const prologue = game.view().prologue!;
      const allowed = prologue.answers.filter((answer) => answer.allowed).map((answer) => answer.id);
      const answer = ["apprentice", "spare-parts", "stay", "settle", "nowhere", "room"].find((id) => allowed.includes(id)) ?? allowed[0] ?? "";
      game.accept({ type: "prologue/choose", step: prologue.step, answer });
    }
    const view = game.view();
    expect(view.chapter.current).toBe("chapter.find-your-feet");
    const nudge = nudgeOf({ ...view, setpiece: null, interview: null, offers: [], report: null });
    expect(nudge.about).toBe("step");
    expect(nudge.key.startsWith("chapter.find-your-feet.item.heard")).toBe(true);
    expect(stepWayOf(view)?.go).toBe("place.yaba");
    expect(words("chapter.find-your-feet.open.prologue.capital")).toContain("settlement");
  });
});

describe("the nudge", () => {
  const base = { ...engineView(), setpiece: null, interview: null, offers: [], report: null };

  test("[R-WORLD-003] given a paper on its way and a better-paid job on the board, when the nudge is read, then it sends the life to the board, not to wait", () => {
    const file = { ...base, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }], done: [] } };
    const pending = { ...file, documents: [{ id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null }], job: { ...file.job, id: "activity.job-customer-service" as const } };
    const hunt = pending.activities.find((option) => option.id === "activity.job-hunt");
    const better = (hunt?.params ?? []).find((job) => job === "activity.job-junior-dev") ?? null;
    if (better === null) throw new Error("The board lists no junior developer job.");
    expect(nudgeOf(pending).key).toBe("ui.nudge.better-job");
    const noBoard = { ...pending, activities: pending.activities.map((option) => (option.id === "activity.job-hunt" ? { ...option, params: [] } : option)) };
    expect(nudgeOf(noBoard).key).toBe("chapter.build-the-file.item.passport.started");
  });

  test("[R-WORLD-003] given last month's report waiting and News read, when the nudge is read, then it moves on to the month's end", () => {
    const line = { key: "line.offer.opened", params: { offer: "offer.nepa-bill" }, tone: "plain" as const, attention: true, counts: [] };
    const reported = { ...base, chapter: { current: null, items: [], done: [] }, report: { month: 3, lines: [line], japacityBefore: null, japacityAfter: null, attention: true } };
    expect(nudgeOf(reported).about).toBe("report");
    expect(nudgeOf(reported, undefined, [], true).about).toBe("end");
  });

  test("[R-WORLD-003] given the landing chapter's job step with a hunt planned, when the nudge is read, then it says the application is in", () => {
    const abroad = { ...base, chapter: { current: "chapter.landing" as const, items: [{ id: "job", met: false }], done: [] } };
    expect(nudgeOf(abroad, undefined, ["activity.job-hunt"]).key).toBe("chapter.landing.item.job.planned");
  });

  test("[R-WORLD-003] given a tuition instalment already missed and the next not covered, when an ask is open too, then the dues come first and say the visa is at stake", () => {
    const owed = base.obligations[0];
    if (owed === undefined) throw new Error("No obligation to shape.");
    const abroad = {
      ...base,
      place: { ...base.place, where: "abroad" as const, country: "country.uk" as const },
      pockets: { ...base.pockets, GBP: { bank: 10_000, cash: 0, locked: 0 } },
      obligations: [{ ...owed, entry: "obligation.tuition" as never, due: 300_000, missed: 1 }],
      offers: [{ ...(richView().offers[0] ?? ({} as never)) }],
    };
    const nudge = nudgeOf(abroad);
    expect(nudge.key).toBe("ui.nudge.dues-visa");
    expect(nudge.about).toBe("dues");
  });

  test("[R-WORLD-003] [R-ROUTE-020] given the visa granted and held funds still open, when the plane's step is read, then the nudge says to give the funds back and the way is the bank's counter", () => {
    const owed = base.obligations[0];
    if (owed === undefined) throw new Error("No obligation to shape.");
    const held = { ...base, chapter: { current: "chapter.send-off" as const, items: [{ id: "departed", met: false }], done: [] }, obligations: [{ ...owed, entry: "obligation.held-funds" as never, due: 0 }] };
    expect(nudgeOf(held).key).toBe("chapter.send-off.item.departed.blocked");
    expect(stepWayOf(held)?.go).toBe("place.olokun-office");
    const clear = { ...held, obligations: [] };
    expect(stepWayOf(clear)?.go).toBe("place.airport-lagos");
  });
});
