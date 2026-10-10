// The official page from the phone (docs/rules/advice.md R-ADVICE-002): Japa offers it whenever it
// can be read, a route only heard of included, says it is free, and plans it; and the
// papers' dates read as months away (docs/rules/world.md R-WORLD-002).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { abroadView, newGame, recordedGame, richView, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { blurbOf, forMonths, nameOf, runningName, say, sayCount, words } from "../../shared/words/text";
import { PhoneApps } from "./PhoneApps";
import { phoneWords } from "./phone.words";
import { reloadSeen } from "./seen";

const OFFICIAL = "activity.look-into-route";
const UK = "route.uk-masters";

beforeEach(() => {
  localStorage.clear();
  reloadSeen();
});

async function openJapa(view: PlayerView) {
  const rendered = await renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />, view);
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="japa"]')!);
  return rendered;
}

/** Ada at the start, with the UK master's only heard of: no plan yet, and the official page open to her. */
function adaHeard(): PlayerView {
  const view = viewAfter(newGame("scenario.ada"), [{ type: "route/hear", route: UK, via: "test" }]);
  const official = view.activities.find((option) => option.id === OFFICIAL);
  if (official?.allowed !== true || official.params?.includes(UK) !== true) throw new Error("Ada cannot read the official page.");
  if (view.japacity.route !== null) throw new Error("Ada already has a plan.");
  return view;
}

describe("the official page in Japa", () => {
  test("[R-ADVICE-002] given a route only heard of and no plan yet, when Japa opens, then the official page is offered for it with its own line, and a tap plans it", async () => {
    const { store } = await openJapa(adaHeard());
    const button = document.querySelector<HTMLButtonElement>("[data-official-page]");
    expect(button?.getAttribute("data-official-page")).toBe(UK);
    expect(button?.textContent).toContain(nameOf(OFFICIAL));
    expect(button?.textContent).toContain(phoneWords("phone.japa.official", { route: runningName(UK) }));
    expect(phoneWords("phone.japa.official", { route: runningName(UK) })).toMatch(/Free\./);
    fireEvent.click(button!);
    expect(store.getState().plan).toContainEqual({ activity: OFFICIAL, param: UK });
    expect(screen.getByText(say("ui.world.planned", { what: nameOf(OFFICIAL) }))).toBeTruthy();
    const after = document.querySelector<HTMLButtonElement>("[data-official-page]");
    expect(after?.disabled).toBe(true);
    expect(after?.textContent).toContain(phoneWords("phone.japa.official-planned", { route: runningName(UK) }));
  });

  test("[R-ADVICE-002] given no route heard of, when Japa opens, then no official page is offered", async () => {
    await openJapa(newGame("scenario.ada").view());
    expect(document.querySelector("[data-official-page]")).toBeNull();
  });

  test("[R-ADVICE-002] given every slot already planned, when the official page is tapped, then nothing is planned and the phone says the month is full", async () => {
    const view = adaHeard();
    const { store } = await openJapa(view);
    act(() => {
      for (let slot = 0; slot < view.freeSlots; slot += 1) store.getState().addToPlan({ activity: "activity.rest", param: null });
    });
    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-official-page]")!);
    expect(store.getState().plan).not.toContainEqual({ activity: OFFICIAL, param: UK });
    expect(screen.getByText(say("ui.world.full"))).toBeTruthy();
  });

  test("[R-WORLD-002] given a held paper that runs out, when the Papers screen opens, then it says how long it is valid, with no month number", async () => {
    const view = richView();
    const held = view.documents.find((paper) => paper.state === "held" && paper.expiresMonth !== null);
    if (held === undefined || held.expiresMonth === null) throw new Error("No held paper that runs out.");
    await openJapa(view);
    fireEvent.click(document.querySelector<HTMLElement>("[data-open-papers]")!);
    const paper = document.querySelector(`[data-paper="${held.id}"]`);
    expect(paper?.textContent).toContain(phoneWords("phone.japa.paper-valid", { when: forMonths(held.expiresMonth, view.month) }));
    expect(document.querySelector("[data-papers]")?.textContent).not.toMatch(/month \d|until in/i);
    expect(screen.getByText(phoneWords("phone.japa.papers.title"))).toBeTruthy();
  });
});

// Japa after the grant and after the flight (docs/rules/world.md R-WORLD-019, the review's finding
// 28): once granted it names the next step; once flown it shows the visa held, what it lets you do,
// and the landing chapter's steps, never "Ready to go".
describe("Japa after the grant and the flight", () => {
  const LANDING = "chapter.landing";

  test("[R-WORLD-019] given Ada's visa granted and the plane not yet boarded, when Japa opens, then the plan still stands at its percent and the next step is to board the plane", async () => {
    const view = recordedGame("ada-careful", 1).view();
    expect(view.routes.find((route) => route.id === UK)?.state).toBe("granted");
    await openJapa(view);
    const app = document.querySelector<HTMLElement>('[data-phone-app="japa"]');
    expect(app?.querySelector("[data-japa-percent]")).not.toBeNull();
    expect(app?.querySelector("[data-japa-next]")?.textContent).toContain(words("chapter.send-off.item.departed"));
    expect(app?.querySelector("[data-japa-visa]")).toBeNull();
  });

  test("[R-WORLD-019] given Ada just landed in London, when Japa opens, then it shows the visa she holds, what it lets her do, the months left and the way up, with the landing's steps to come, and no percent or Ready to go", async () => {
    const view = abroadView();
    const held = view.status;
    if (held === null) throw new Error("Ada landed with no status.");
    expect(view.chapter.current).not.toBe(LANDING);
    await openJapa(view);
    const app = document.querySelector<HTMLElement>('[data-phone-app="japa"]');
    expect(app?.querySelector("[data-japa-percent]")).toBeNull();
    expect(app?.textContent).not.toContain(phoneWords("phone.japa.label"));
    const visa = app?.querySelector<HTMLElement>("[data-japa-visa]");
    expect(visa?.dataset.japaVisa).toBe(held.entry);
    expect(visa?.textContent).toContain(nameOf(held.entry));
    expect(app?.textContent).toContain(blurbOf(held.entry) ?? "no blurb");
    expect(app?.textContent).toContain(sayCount("ui.status.months-left", held.monthsLeft ?? 0, { months: held.monthsLeft ?? 0 }));
    expect(app?.textContent).toContain(words(held.nextStep ?? "no next step"));
    const steps = [...(app?.querySelectorAll<HTMLElement>("[data-landing] [data-met]") ?? [])].map((step) => step.textContent);
    expect(steps).toEqual((content.chapter[LANDING]?.items ?? []).map((item) => words(`${LANDING}.item.${item.id}`)));
    expect(app?.querySelector("[data-landing]")?.getAttribute("data-landing")).toBe("soon");
    expect(app?.querySelector("[data-japa-next]")).toBeNull();
  });

  test("[R-WORLD-019] given Ada a month into life abroad, when Japa opens, then the landing's steps carry what is done, and the next is its first step not done", async () => {
    const view = abroadView(1);
    expect(view.chapter.current).toBe(LANDING);
    const next = view.chapter.items.find((item) => !item.met);
    if (next === undefined) throw new Error("The landing is already done.");
    await openJapa(view);
    const app = document.querySelector<HTMLElement>('[data-phone-app="japa"]');
    expect(app?.querySelector("[data-landing]")?.getAttribute("data-landing")).toBe("now");
    expect(app?.querySelector("[data-japa-next]")?.textContent).toContain(words(`${LANDING}.item.${next.id}`));
    const steps = [...(app?.querySelectorAll<HTMLElement>("[data-landing] [data-met]") ?? [])].map((step) => [step.textContent, step.dataset.met]);
    expect(steps).toEqual(view.chapter.items.map((item) => [words(`${LANDING}.item.${item.id}`), item.met ? "true" : "false"]));
    expect(app?.querySelector("[data-japa-percent]")).toBeNull();
  });
});

// one name for the readiness figure, Japacity, glossed where the figure shows.
describe("the figure's one name", () => {
  test("[R-WORLD-019] [R-TEXT-005] given a life with no way out yet, when Japa opens, then its head names the figure Japacity and never says ready to go", async () => {
    const view = newGame("scenario.ada").view();
    expect(view.japacity.route).toBeNull();
    await openJapa(view);
    const head = document.querySelector<HTMLElement>("[data-japa-head]");
    expect(head?.textContent).toContain("Japacity");
    expect(head?.textContent).toContain(phoneWords("phone.japa.none"));
    expect(head?.textContent).not.toMatch(/ready/i);
  });

  test("[R-WORLD-019] [R-TEXT-005] given a route in play with its figure, when Japa opens, then the head names it Japacity with a one-line gloss, and the cards call it Japacity too", async () => {
    const view = richView();
    expect(view.japacity.percent).not.toBeNull();
    await openJapa(view);
    const head = document.querySelector<HTMLElement>("[data-japa-head]");
    expect(head?.querySelector("[data-japa-label]")?.textContent).toBe("Japacity");
    expect(head?.querySelector("[data-japa-gloss]")?.textContent).toBe(phoneWords("phone.japa.gloss"));
    expect(phoneWords("phone.japa.gloss")).toMatch(/^How ready you are to go/);
    for (const key of ["share.japacity", "share.send-off.japacity", "ui.card.japacity"]) expect(say(key)).toMatch(/^Japacity\b/);
    expect(say("share.japacity")).not.toMatch(/^Ready to go$/i);
  });
});
