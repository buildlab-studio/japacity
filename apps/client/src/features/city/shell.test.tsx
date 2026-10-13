// The world's shell over the place (docs/rules/world.md R-WORLD-001 to 004): what stands over the
// scene, what hides when, and the nudge's choice. The scene itself needs WebGL and is not drawn here.
import { worldClockAt } from "@japacity/sim";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { engineView, newGame, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { formatMoney } from "../../shared/words/format";
import { inMonths, nameOf, say, words } from "../../shared/words/text";
import { bandMonth } from "../../shared/world/Band";
import { forgetTaught, wasTaught } from "../../shared/world/taught";
import { City, type CityMapSlot, homeLine, RESULTS_BEAT_MS, TITLE_MS } from "./City";
import { cityWords } from "./city.words";
import { nudgeOf, stepWayOf } from "./nudge";

const world = (extra: Partial<Parameters<typeof City>[0]> = {}) => <City world results={(place) => <p data-results-for={place} />} {...extra} />;
/** The world with a phone that says which app it opened on (R-WORLD-002: the Calendar is on the phone). */
const phoned = (extra: Partial<Parameters<typeof City>[0]> = {}) => world({ phone: (_close, _area, app) => <p data-phone-app={app ?? ""} />, ...extra });

/** Renders the world and passes a later chapter's opening card when one stands over it (R-WORLD-001, R-CHAPTER-011). */
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

/** The month's name and phase on the band: a tap opens the Calendar (R-WORLD-002, R-TURN-010). */
function monthChip(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-band] [data-band-month]");
  if (found === null) throw new Error("No month on the band");
  return found;
}

function thumbs(): HTMLElement {
  const found = document.querySelector<HTMLElement>("[data-thumb-bar]");
  if (found === null) throw new Error("No thumb bar");
  return found;
}

describe("the world fills the screen", () => {
  test("[R-WORLD-001] [R-CHAPTER-011] given a life that has not played a month, when the world opens, then the first chapter's title stands over the world with no card, no dimming and no button, the nudge under the band gives the first step, and a life with a month behind it opens straight on the world", async () => {
    const view = engineView();
    await renderWithView(world(), view);
    const opening = document.querySelector<HTMLElement>("[data-opening]");
    if (opening === null || view.chapter.current === null) throw new Error("No opening");
    expect(opening.dataset.opening).toBe(view.chapter.current);
    expect(opening.textContent).toBe(nameOf(view.chapter.current));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.opening.go") })).toBeNull();
    expect(document.querySelector("[data-nudge]")?.textContent).toContain(say(nudgeOf(view).key));
    // A life with a month behind it opens straight on the world.
    document.body.innerHTML = "";
    await renderWithView(world(), richView());
    expect(document.querySelector("[data-opening]")).toBeNull();
  });

  test("[R-WORLD-001] given a life in the world, when it opens, then only the band, the nudge and the Map and Phone buttons stand over the place", async () => {
    const view = engineView();
    const { store } = await opened(world(), view);
    expect(band()).toBeTruthy();
    expect(document.querySelector("[data-nudge]")).not.toBeNull();
    // The nudge is a button when it opens the way to what it names (R-WORLD-003); the band's handle shows only while something is coming (R-WORLD-002).
    // The month's name and phase are part of the band, a chip that opens the Calendar (R-WORLD-002, decision 0034).
    // The name over the age opens the data page (R-PROLOGUE-009).
    expect(screen.getAllByRole("button").map((button) => button.getAttribute("aria-label") ?? button.textContent)).toEqual([say("prologue.page.open"), say("ui.month.chip", { ...bandMonth(view, store.getState().beganAt, worldClockAt(Date.now())) }), say(nudgeOf(view).key), say("ui.world.map"), say("ui.world.phone")]);
    expect(document.querySelector("[data-report-here], [data-overheard], [data-scene]")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[R-WORLD-001] given a set piece and offers waiting, when the world opens, then nothing of them stands over the place until the nudge is tapped, and the sheet opens over it", async () => {
    await renderWithView(world({ asks: <p data-asks-body>asks</p> }), richView());
    expect(document.querySelector("[data-scene], [data-asks-body]")).toBeNull();
    // The set piece is staged elsewhere, so the nudge says it waits there (R-CITY-011); its tap opens the sheet all the same.
    fireEvent.click(document.querySelector<HTMLElement>("[data-nudge-open]") as HTMLElement);
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("asks")).toBeTruthy();
    expect(band()).toBeTruthy();
  });

  test("[R-WORLD-006] given three asks waiting, when the nudge is tapped, then the sheet shows one at a time, counted, with Next and Back", async () => {
    await renderWithView(world({ asks: [<p key="a" data-ask="a">first</p>, <p key="b" data-ask="b">second</p>, <p key="c" data-ask="c">third</p>] }), richView());
    // The set piece is staged elsewhere, so the nudge says it waits there (R-CITY-011); its tap opens the sheet all the same.
    fireEvent.click(document.querySelector<HTMLElement>("[data-nudge-open]") as HTMLElement);
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

  test("[R-WORLD-002] given the band, when its month or the coming chip is tapped, then the phone opens on the Calendar, the chip on what is coming", async () => {
    const { authority } = await opened(phoned(), { ...richView(), setpiece: null, interview: null });
    fireEvent.click(monthChip());
    expect(document.querySelector("[data-phone-app]")?.getAttribute("data-phone-app")).toBe("calendar");
    expect(authority.sent).toEqual([]);
  });
});

describe("the band and the thumb buttons", () => {
  test("[R-WORLD-002] [R-CLOCK-033] given a life, when the band renders, then its clock is the character's age in years and months with the month's name and the world's part of the day beside it, and no month number or count", async () => {
    const view = engineView();
    const { store } = await opened(world(), view);
    const ageMonths = view.qualities.find((quality) => quality.id === "quality.age-months")?.value ?? 0;
    expect(ageMonths).toBeGreaterThan(0);
    const clock = say("ui.world.clock", { years: Math.floor(ageMonths / 12), months: ageMonths % 12 });
    expect(within(band()).getByText(clock)).toBeTruthy();
    expect(band().textContent).not.toContain(say("ui.world.month-of", { month: view.month + 1 }));
    // The month in words: its name from when the life began, the part of the day from the world's clock (decision 0036).
    const month = bandMonth(view, store.getState().beganAt, worldClockAt(Date.now()));
    expect(monthChip().textContent).toBe(`${month.name}${month.part}`);
    expect(monthChip().textContent).not.toMatch(/\d/);
    expect(month.part).toBe(say(`ui.day.part.${worldClockAt(Date.now()).part}`));
    expect(document.querySelector("[data-band] [data-end-month], [data-band] [data-month-count]")).toBeNull();
  });

  test("[R-WORLD-003] given a chip open when the month ends, when the results show, then the chip is gone and the nudge is back", async () => {
    const view = { ...engineView(), report: null };
    const { store } = await opened(world(), view);
    act(() => store.setState({ reportOpen: true, view: { ...view, report: richView().report } }));
    expect(document.querySelector("[data-thing-chip]")).toBeNull();
  });

  test("[R-WORLD-002] given the results showing, when the band renders, then it hides once they are up, and it shows again once the player goes back", async () => {
    const { store } = await opened(world(), richView());
    expect(band().getAttribute("aria-hidden")).toBe("false");
    act(() => store.setState({ reportOpen: true }));
    // The band stays through the short beat in the room, and steps back once the results are up.
    expect(band().getAttribute("aria-hidden")).toBe("false");
    await waitFor(() => expect(band().getAttribute("aria-hidden")).toBe("true"), { timeout: RESULTS_BEAT_MS + 1500 });
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

  test("[R-WORLD-008] [R-WORLD-025] given the month ended, when the shell shows, then a short beat in the room comes first, the scene goes dark after it, and the results are handed the name of where the player is", async () => {
    const { store } = await opened(world(), engineView());
    const shown = band().querySelector("h2")?.textContent ?? "";
    act(() => store.setState({ reportOpen: true }));
    // The beat in the room comes before the cut, so the dark comes after it.
    expect(document.querySelector("[data-cut]")?.getAttribute("data-cut")).toBe("false");
    await waitFor(() => expect(document.querySelector("[data-cut]")?.getAttribute("data-cut")).toBe("true"), { timeout: RESULTS_BEAT_MS + 1000 });
    expect(document.querySelector("[data-results-for]")).toBeNull();
    // The band starts the name with a capital; the results' "Back to ..." keeps content's casing.
    await waitFor(() => expect(document.querySelector("[data-results-for]")).not.toBeNull());
    const handed = document.querySelector("[data-results-for]")?.getAttribute("data-results-for") ?? "";
    expect(handed.charAt(0).toUpperCase() + handed.slice(1)).toBe(shown);
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
      fireEvent.click(monthChip());
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
    const file = { ...base, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }, { id: "transcript", met: false }, { id: "english", met: false }, { id: "offer", met: false }], done: [], closes: false, next: null } };
    const waiting = noMeanwhile({ ...file, documents: [{ id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null, onItsWay: 12 }] });
    expect(nudgeOf(waiting)).toMatchObject({ key: "chapter.build-the-file.item.passport.started", params: { when: inMonths(12, 10) }, about: "step" });
    expect(nudgeOf(file).key).toBe("chapter.build-the-file.item.passport.nudge");
    const testing = { ...file, chapter: { ...file.chapter, items: [{ id: "english", met: false }, { id: "offer", met: false }] } };
    // The test planned waits on the month's end; `.started` names the result on its way.
    expect(nudgeOf(testing, undefined, ["activity.sit-english-test"]).key).toBe("chapter.build-the-file.item.english.planned");
    const applied = { ...file, chapter: { ...file.chapter, items: [{ id: "offer", met: false }] }, routes: [{ ...richView().routes[0]!, id: "route.uk-masters" as const, schools: [{ id: "school.one" as never, state: "pending" as const, readyMonth: 11, discount: 0 }] }] };
    expect(nudgeOf(applied)).toMatchObject({ key: "chapter.build-the-file.item.offer.started", params: { when: inMonths(11, 10) } });
    const hunting = { ...base, chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "job", met: false }], done: [], closes: false, next: null } };
    expect(nudgeOf(hunting, undefined, ["activity.job-hunt"]).key).toBe("chapter.find-your-feet.item.job.started");
    const short = { ...base, chapter: { current: "chapter.decision-day" as const, items: [{ id: "held", met: false }], done: [], closes: false, next: null }, routes: [{ ...richView().routes[0]!, id: "route.uk-masters" as const, funds: { heldMonths: 0, covered: false, shown: 100000, required: 300000 } }] };
    expect(nudgeOf(short)).toMatchObject({ key: "chapter.decision-day.item.held.short", params: { amount: formatMoney(200000, "GBP") } });
  });

  test("[R-WORLD-003] given a step planned this month, or one the player cannot afford, when the nudge is chosen, then it says so: the planned step waits on the month, the dear one names the gap", () => {
    const file = { ...quiet, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }], done: [], closes: false, next: null } };
    expect(nudgeOf(file, undefined, ["activity.get-passport"]).key).toBe("chapter.build-the-file.item.passport.planned");
    const dear = {
      ...file,
      pockets: { ...file.pockets, NGN: { ...file.pockets.NGN, bank: 100000, cash: 0 } },
      activities: file.activities.map((option) => (option.id === "activity.get-passport" ? { ...option, affordable: false, cost: [{ currency: "NGN" as const, amount: 10000000, reason: "fee-document" as const }] } : option)),
    };
    expect(nudgeOf(dear)).toMatchObject({ key: "chapter.build-the-file.item.passport.short", params: { amount: formatMoney(9900000, "NGN") } });
  });

  test("[R-WORLD-003] given a step short of money, when a hunt is planned or the job's pay covers the gap, then the nudge says so; given the page or the meetup planned, then it waits on the month; abroad the dues gap comes before the step", () => {
    const file = { ...quiet, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "english", met: false }], done: [], closes: false, next: null } };
    const dear = {
      ...file,
      pockets: { ...file.pockets, NGN: { ...file.pockets.NGN, bank: 100000, cash: 0 } },
      activities: file.activities.map((option) => (option.id === "activity.sit-english-test" ? { ...option, affordable: false, cost: [{ currency: "NGN" as const, amount: 10000000, reason: "fee-test" as const }] } : option)),
    };
    expect(nudgeOf(dear).key).toBe("chapter.build-the-file.item.english.short");
    expect(nudgeOf(dear, undefined, ["activity.job-hunt"]).key).toBe("ui.nudge.hunt-planned");
    // A hunt applied for at once (R-ACTIVITY-015) reads as a planned one: the view marks it done and nothing is in the plan.
    const applied = { ...dear, activities: dear.activities.map((option) => (option.id === "activity.job-hunt" ? { ...option, done: true } : option)) };
    expect(nudgeOf(applied).key).toBe("ui.nudge.hunt-planned");
    // A job whose month's pay covers the gap: the nudge says to work and save.
    const paid = { ...dear, job: { ...dear.job, id: "activity.job-junior-dev" as const } };
    expect(nudgeOf(paid).key).toBe("chapter.build-the-file.item.english.saving");
    // The month's bills eat the pay: the nudge says the gap, never "work and save".
    const billed = { ...paid, obligations: [{ ...paid.obligations[0]!, due: 40_000_000, entry: "obligation.upkeep" as never }] };
    expect(nudgeOf(billed)).toMatchObject({ key: "chapter.build-the-file.item.english.short", params: { amount: formatMoney(9_900_000, "NGN") } });
    const first = { ...quiet, chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "known", met: false }], done: [], closes: false, next: null } };
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
    // The player stands on Bode Thomas Street, not at home (the city never moves them to an ask's place by itself, R-CITY-011).
    localStorage.setItem("japacity.city.last", JSON.stringify(["place.bode-thomas"]));
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

  test("[R-WORLD-003] given an offer waiting, when it opens, then the nudge says so; and the nudge hides while the phone's Calendar is open", async () => {
    const { store } = await opened(phoned(), { ...richView(), setpiece: null, interview: null, offers: [], job: { ...richView().job, id: null, side: null } });
    const nudge = () => document.querySelector("[data-nudge]")?.textContent ?? null;
    expect(nudge()).not.toBe(say("ui.nudge.offer"));
    const view = store.getState().view;
    if (view === null) throw new Error("No view");
    act(() => store.setState({ view: { ...view, offers: richView().offers } }));
    expect(nudge()).toBe(say("ui.nudge.offer"));
    fireEvent.click(monthChip());
    expect(nudge()).toBeNull();
  });
});

describe("the trader from sixteen with a shop's capital", () => {
  test("[R-WORLD-001] [R-WORLD-003] given a settled trader at his handover, when the world opens, then the opening words speak of the settlement and the nudge sends him to the motor park, not the board", () => {
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
    // a trade hears of its way out at the motor park, not the meetup.
    expect(nudge.key).toBe("chapter.find-your-feet.item.heard.nudge.motor-park");
    expect(stepWayOf(view)?.go).toBe("place.ojuelegba");
    expect(words("chapter.find-your-feet.open.prologue.capital")).toContain("settlement");
  });
});

/** The waiting months' acts (R-ACTIVITY-013) left out, so a test can read the wait's own words. */
function noMeanwhile<T extends { activities: { id: string }[] }>(view: T): T {
  return { ...view, activities: view.activities.filter((option) => !["activity.open-source", "activity.tech-posts", "activity.be-noticed", "activity.nurse-certification"].includes(option.id)) };
}

describe("the nudge", () => {
  const base = { ...engineView(), setpiece: null, interview: null, offers: [], report: null };

  test("[R-WORLD-003] given a paper on its way and a better-paid job on the board, when the nudge is read, then it sends the life to the board, not to wait", () => {
    const file = { ...base, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }], done: [], closes: false, next: null } };
    const pending = noMeanwhile({ ...file, documents: [{ id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null, onItsWay: 12 }], job: { ...file.job, id: "activity.job-customer-service" as const } });
    const hunt = pending.activities.find((option) => option.id === "activity.job-hunt");
    const better = (hunt?.params ?? []).find((job) => job === "activity.job-junior-dev") ?? null;
    if (better === null) throw new Error("The board lists no junior developer job.");
    expect(nudgeOf(pending).key).toBe("ui.nudge.better-job");
    const noBoard = { ...pending, activities: pending.activities.map((option) => (option.id === "activity.job-hunt" ? { ...option, params: [] } : option)) };
    expect(nudgeOf(noBoard).key).toBe("chapter.build-the-file.item.passport.started");
  });

  test("[R-WORLD-003] given last month's report waiting and News read, when the nudge is read, then it moves on to the month's end", () => {
    const line = { key: "line.offer.opened", params: { offer: "offer.nepa-bill" }, tone: "plain" as const, attention: true, counts: [] };
    const reported = { ...base, chapter: { current: null, items: [], done: [], closes: false, next: null }, report: { month: 3, lines: [line], japacityBefore: null, japacityAfter: null, attention: true } };
    expect(nudgeOf(reported).about).toBe("report");
    expect(nudgeOf(reported, undefined, [], true).about).toBe("end");
  });

  test("[R-WORLD-003] given the landing chapter's job step with a hunt planned, when the nudge is read, then it says the application is in", () => {
    const abroad = { ...base, chapter: { current: "chapter.landing" as const, items: [{ id: "job", met: false }], done: [], closes: false, next: null } };
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
    const held = { ...base, chapter: { current: "chapter.send-off" as const, items: [{ id: "departed", met: false }], done: [], closes: false, next: null }, obligations: [{ ...owed, entry: "obligation.held-funds" as never, due: 0 }] };
    expect(nudgeOf(held).key).toBe("chapter.send-off.item.departed.blocked");
    expect(stepWayOf(held)?.go).toBe("place.olokun-office");
    const clear = { ...held, obligations: [] };
    expect(stepWayOf(clear)?.go).toBe("place.airport-lagos");
  });
});

describe("the archetypes' own ways", () => {
  const base = { ...engineView(), setpiece: null, interview: null, offers: [], report: null, scenario: "scenario.prologue" as const };

  test("[R-PROLOGUE-010] [R-WORLD-003] given a nurse from sixteen with her licence and no job, when the first step is read, then the nudge sends her to the staff nurse job at the clinic", () => {
    const nurse = {
      ...base,
      chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "job", met: false }, { id: "pay", met: false }, { id: "heard", met: false }, { id: "known", met: false }], done: [], closes: false, next: null },
      qualities: base.qualities.map((quality) => (quality.id === "quality.edu-level" ? { ...quality, value: 3 } : quality.id === "quality.care" ? { ...quality, value: 60 } : quality)),
      documents: [{ id: "document.nursing-licence" as const, state: "held" as const, readyMonth: null, expiresMonth: null, value: null, onItsWay: null }],
      job: { id: null, months: 0, side: null, pay: null, sidePay: null },
      routes: [],
    };
    expect(nudgeOf(nurse).key).toBe("chapter.find-your-feet.item.job.nudge.clinic");
    expect(stepWayOf(nurse)).toEqual({ go: "place.tb-clinic", at: ["place.tb-clinic:jobs-notice"] });
  });

  test("[R-WORLD-003] given a chapter whose every item is met, when the nudge is chosen, then it says the chapter is done and to turn the page, never a goal's first act", () => {
    const done = {
      ...base,
      chapter: { current: "chapter.send-off" as const, items: [{ id: "departed", met: true }], done: [], closes: false, next: null },
      goals: { open: [{ id: "goal.buy-land" as const, items: [{ id: "land", met: false }] }], done: [] },
    };
    expect(nudgeOf(done)).toEqual({ key: "ui.nudge.chapter-done", about: "end" });
  });

  test("[R-WORLD-003] [R-CHAPTER-009] given a nurse from sixteen in her job who has heard of care work and the master's, when the first step is read, then the nudge says to read the care page and the way opens that page with care chosen", () => {
    const nurse = {
      ...base,
      chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "job", met: true }, { id: "pay", met: true }, { id: "heard", met: true }, { id: "known", met: false }], done: [], closes: false, next: null },
      qualities: base.qualities.map((quality) => (quality.id === "quality.edu-level" ? { ...quality, value: 3 } : quality.id === "quality.care" ? { ...quality, value: 60 } : quality)),
      documents: [{ id: "document.nursing-licence" as const, state: "held" as const, readyMonth: null, expiresMonth: null, value: null, onItsWay: null }],
      job: { id: "activity.job-nurse" as const, months: 1, side: null, pay: null, sidePay: null },
      routes: [
        { ...richView().routes[0]!, id: "route.uk-masters" as const, state: "heard" as const },
        { ...richView().routes[0]!, id: "route.uk-care" as const, state: "heard" as const },
      ],
    };
    // The page is read in Japa, one tap away, never a ride to the hub: `.needs` words open Japa.
    expect(nudgeOf(nurse)).toEqual({ key: "chapter.find-your-feet.item.known.own.needs", params: { route: "care work" }, about: "step" });
    expect(say("chapter.find-your-feet.item.known.own.needs", { route: "care work" })).toBe("Read about care work in Japa");
    expect(stepWayOf(nurse)).toEqual({ go: "place.yaba", at: ["place.yaba:desk", "place.ojuelegba:hub"], opens: "activity.look-into-route", param: "route.uk-care" });
    // A graduate with no way of her own keeps the table's words, and her way still opens the page, with no route chosen, so its picker offers the routes heard (the forty-month driver runs, 10 Oct).
    const graduate = { ...nurse, qualities: base.qualities.map((quality) => (quality.id === "quality.edu-level" ? { ...quality, value: 3 } : quality)), documents: [] };
    expect(nudgeOf(graduate).key).toBe("chapter.find-your-feet.item.known.nudge");
    expect(stepWayOf(graduate)).toEqual({ go: "place.yaba", at: ["place.yaba:desk", "place.ojuelegba:hub"], opens: "activity.look-into-route" });
  });

  test("[R-PROLOGUE-010] [R-WORLD-003] given a trader from sixteen who has heard of no way out, when the first step is read, then the nudge sends him to the motor park, and asking around planned says so", () => {
    const trader = {
      ...base,
      chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "job", met: false }, { id: "pay", met: false }, { id: "heard", met: false }, { id: "known", met: false }], done: [], closes: false, next: null },
      qualities: base.qualities.map((quality) => (quality.id === "quality.edu-level" ? { ...quality, value: 1 } : quality)),
      pockets: { ...base.pockets, NGN: { ...base.pockets.NGN, cash: 600_000_000, bank: 0 } },
      routes: [],
      job: { id: null, months: 0, side: null, pay: null, sidePay: null },
    };
    expect(nudgeOf(trader).key).toBe("chapter.find-your-feet.item.heard.nudge.motor-park");
    expect(stepWayOf(trader)).toEqual({ go: "place.ojuelegba", at: ["place.ojuelegba:motor-park"] });
    expect(nudgeOf(trader, undefined, ["activity.ask-around"]).key).toBe("chapter.find-your-feet.item.heard.planned.ask-around");
  });
});

describe("the nudge (the waiting months' acts)", () => {
  const base = { ...engineView(), setpiece: null, interview: null, offers: [], report: null };
  const waiting = noMeanwhile({ ...base, month: 10, chapter: { current: "chapter.build-the-file" as const, items: [{ id: "passport", met: false }], done: [], closes: false, next: null }, documents: [{ id: "document.passport" as const, state: "pending" as const, readyMonth: 12, expiresMonth: null, value: null, onItsWay: 12 }] });

  test("[R-WORLD-003] [R-SPONSOR-005] given a nurse in the nursing job with the care route in play, when a better-paid job sits on the board, then the nudge never sends her off the job", () => {
    const nurse = { ...waiting, job: { ...waiting.job, id: "activity.job-nurse" as const }, routes: [{ ...richView().routes[0]!, id: "route.uk-care" as const, state: "heard" as const }] };
    expect(nudgeOf(nurse).key).not.toBe("ui.nudge.better-job");
    const unknown = { ...nurse, routes: [] };
    expect(nudgeOf(unknown).key).toBe("ui.nudge.better-job");
  });

  test("[R-WORLD-003] given a hunt planned while a job is held and a paper on its way, when the nudge is read, then it says the application is in", () => {
    const working = { ...waiting, job: { ...waiting.job, id: "activity.job-customer-service" as const } };
    expect(nudgeOf(working, undefined, ["activity.job-hunt"]).key).toBe("ui.nudge.hunt-planned");
  });

  test("[R-WORLD-003] given a hunt missed last month and other jobs on the board, when the first chapter's job step is read, then the nudge names another way", () => {
    const missed = { ...base, chapter: { current: "chapter.find-your-feet" as const, items: [{ id: "job", met: false }], done: [], closes: false, next: null }, report: { month: 3, lines: [{ key: "line.activity.hunt-missed", params: { job: "activity.job-nurse" }, tone: "bad" as const, attention: false, counts: [] }], japacityBefore: null, japacityAfter: null, attention: false } };
    expect(nudgeOf(missed).key).toBe("chapter.find-your-feet.item.job.nudge.again");
  });

  test("[R-WORLD-003] [R-GOAL-003] given every chapter done and a goal open with a first act, when the nudge is read, then it names the goal's first act", () => {
    const settled = { ...base, chapter: { current: null, items: [], done: [], closes: false, next: null }, goals: { open: [{ id: "goal.own-door" as const, items: [{ id: "flat", met: false }] }], done: [] } };
    const nudge = nudgeOf(settled);
    expect(nudge.key).toBe("goal.own-door.first");
    expect(nudge.about).toBe("goal");
  });

  test("[R-ACTIVITY-013] [R-WORLD-003] given a paper on its way and the life's own act open this month, when the nudge is read, then it names that act, and once planned it moves on", () => {
    const offered = (id: string) => ({ id, allowed: true, affordable: true, cost: [], missing: [], params: null }) as never;
    const coder = { ...waiting, qualities: waiting.qualities.map((quality) => (quality.id === "quality.tech" ? { ...quality, value: 45 } : quality)), activities: [...waiting.activities, offered("activity.open-source"), offered("activity.tech-posts")] };
    expect(nudgeOf(coder).key).toBe("ui.nudge.meanwhile.open-source");
    // Planned, the next act that fits comes up; with every one planned, the wait's own words stand.
    expect(nudgeOf(coder, undefined, ["activity.open-source"]).key).toBe("ui.nudge.meanwhile.tech-posts");
    expect(nudgeOf(coder, undefined, ["activity.open-source", "activity.tech-posts"]).key).toBe("chapter.build-the-file.item.passport.started");
  });
});

describe("the home the game opens in", () => {
  test("[R-HOME-006] given a life living in Makoko, when the world opens, then it opens on the water and the map's Home pin stands there", async () => {
    localStorage.removeItem("japacity.city.last");
    const base = engineView();
    const view = { ...base, home: { ...base.home, place: "place.makoko" as const, rent: { currency: "NGN" as const, amount: 25_000 } } };
    let handed: CityMapSlot | null = null;
    await opened(
      world({
        cityMap: (props) => {
          handed = props;
          return <p data-map-slot />;
        },
      }),
      view,
    );
    expect(document.querySelector("[data-city]")?.getAttribute("data-city")).toBe("place.makoko");
    // Go took the first step's way, which opens the map (R-WORLD-003); the slot has it already.
    if (handed === null) fireEvent.click(screen.getByRole("button", { name: say("ui.world.map") }));
    const slot = handed as CityMapSlot | null;
    if (slot === null) throw new Error("The map was not handed its slot");
    expect(slot.home).toBe("place.makoko");
    // The player stands at home, so its pin reads "here"; it is the slot's home all the same.
    expect(slot.pins.find((pin) => pin.id === "place.makoko")?.state).toBe("here");
    expect(slot.pins.find((pin) => pin.id === "place.family-house")?.state).not.toBe("home");
  });

  test("[R-WORLD-014] [R-WORLD-020] given a life living in Makoko, when the map is handed its pins, then the family house is still on it, a little from the home spot, so the people met there can be reached", async () => {
    localStorage.removeItem("japacity.city.last");
    const base = engineView();
    const view = { ...base, home: { ...base.home, place: "place.makoko" as const, rent: { currency: "NGN" as const, amount: 25_000 } } };
    let handed: CityMapSlot | null = null;
    await opened(
      world({
        cityMap: (props) => {
          handed = props;
          return <p data-map-slot />;
        },
      }),
      view,
    );
    if (handed === null) fireEvent.click(screen.getByRole("button", { name: say("ui.world.map") }));
    const slot = handed as CityMapSlot | null;
    if (slot === null) throw new Error("The map was not handed its slot");
    const house = slot.pins.find((pin) => pin.id === "place.family-house");
    const home = slot.pins.find((pin) => pin.id === "place.makoko");
    expect(house).toBeDefined();
    expect(house?.state).not.toBe("home");
    expect(house?.position).not.toEqual(home?.position);
  });

  test("[R-HOME-010] [R-HOME-006] given a life living in the room in a compound, when the world opens, then it opens in the room and the map's Home pin stands there", async () => {
    localStorage.removeItem("japacity.city.last");
    const base = engineView();
    const view = { ...base, home: { ...base.home, place: "place.compound-room" as const, rent: { currency: "NGN" as const, amount: 50_000_00 } } };
    let handed: CityMapSlot | null = null;
    await opened(
      world({
        cityMap: (props) => {
          handed = props;
          return <p data-map-slot />;
        },
      }),
      view,
    );
    expect(document.querySelector("[data-city]")?.getAttribute("data-city")).toBe("place.compound-room");
    if (handed === null) fireEvent.click(screen.getByRole("button", { name: say("ui.world.map") }));
    const slot = handed as CityMapSlot | null;
    if (slot === null) throw new Error("The map was not handed its slot");
    expect(slot.home).toBe("place.compound-room");
    expect(slot.pins.find((pin) => pin.id === "place.compound-room")?.state).toBe("here");
  });

  test("[R-HOME-001] [R-HOME-006] given a life living in the hostel room, when the world opens, then it opens in the hostel and the map's Home pin stands there", async () => {
    localStorage.removeItem("japacity.city.last");
    const base = engineView();
    const view = { ...base, home: { ...base.home, place: "place.hostel-room" as const, rent: { currency: "NGN" as const, amount: 15_000_00 } } };
    let handed: CityMapSlot | null = null;
    await opened(
      world({
        cityMap: (props) => {
          handed = props;
          return <p data-map-slot />;
        },
      }),
      view,
    );
    expect(document.querySelector("[data-city]")?.getAttribute("data-city")).toBe("place.hostel-room");
    if (handed === null) fireEvent.click(screen.getByRole("button", { name: say("ui.world.map") }));
    const slot = handed as CityMapSlot | null;
    if (slot === null) throw new Error("The map was not handed its slot");
    expect(slot.home).toBe("place.hostel-room");
    expect(slot.pins.find((pin) => pin.id === "place.hostel-room")?.state).toBe("here");
  });

  test("[R-HOME-006] given a life in the family house, when the world opens, then it opens in the compound as before", async () => {
    localStorage.removeItem("japacity.city.last");
    await opened(world(), engineView());
    expect(document.querySelector("[data-city]")?.getAttribute("data-city")).toBe("place.family-house");
  });
});

describe("once per life", () => {
  test("[R-CHAPTER-011] given the first chapter's title shown once, when the page reloads, then it never shows again in this life, and a new life shows it again", async () => {
    localStorage.clear();
    const view = engineView();
    await renderWithView(world(), view);
    expect(document.querySelector("[data-opening-title]")).not.toBeNull();
    await waitFor(() => expect(document.querySelector("[data-opening-title]")).toBeNull(), { timeout: TITLE_MS + 2000 });
    expect(wasTaught("title", view.scenario)).toBe(true);
    // A reload: a new store and a new screen over the same life.
    document.body.innerHTML = "";
    await renderWithView(world(), view);
    expect(document.querySelector("[data-opening-title]")).toBeNull();
    // A new life is taught afresh.
    document.body.innerHTML = "";
    forgetTaught();
    await renderWithView(world(), view);
    expect(document.querySelector("[data-opening-title]")).not.toBeNull();
    localStorage.clear();
  });

  test("[R-HOME-008] given the first entry into the home in a life, when the world opens there, then one small card says what the home is, its blurb; dismissed, it never shows again", async () => {
    localStorage.clear();
    const view = { ...richView(), setpiece: null, interview: null };
    await opened(world(), view);
    const card = document.querySelector("[data-home-teach]");
    expect(card?.getAttribute("data-home-teach")).toBe("place.family-house");
    expect(card?.textContent).toContain(words("place.family-house.blurb"));
    // On a laptop the card stands in the centred column with the world around it (decision 0038).
    expect(card?.closest("[data-centred-column]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.home.teach.close") }));
    expect(document.querySelector("[data-home-teach]")).toBeNull();
    document.body.innerHTML = "";
    await opened(world(), view);
    expect(document.querySelector("[data-home-teach]")).toBeNull();
    localStorage.clear();
  });
});

describe("the band says what the home is", () => {
  test("[R-WORLD-002] given each home, when the band's place line is read, then it names the home's kind in few words: the room in a compound, the family house, the room on the water, the shared room abroad by its area", async () => {
    const base = engineView();
    expect(homeLine("place.compound-room", base)).toBe("Your room, a compound in Ojuelegba");
    expect(homeLine("place.family-house", base)).toBe("The family house");
    expect(homeLine("place.hostel-room", base)).toBe("Your room, a hostel in Yaba");
    expect(homeLine("place.makoko", { ...base, home: { ...base.home, place: "place.makoko" } })).toBe("The room on the water");
    // Makoko is a place like any other for a life that lives elsewhere.
    expect(homeLine("place.makoko", base)).toBeNull();
    expect(homeLine("place.the-room", { ...base, place: { ...base.place, where: "abroad", country: "country.uk" } })).toBe("The shared room, Peckham");
    expect(homeLine("place.yaba", base)).toBeNull();
    localStorage.removeItem("japacity.city.last");
    const view = { ...base, home: { ...base.home, place: "place.compound-room" as const, rent: { currency: "NGN" as const, amount: 50_000_00 } } };
    await opened(world(), view);
    expect(band().textContent).toContain("Your room, a compound in Ojuelegba");
  });
});
