// The official page from the phone (docs/rules/advice.md R-ADVICE-002): Japa offers it whenever it
// can be read, a route only heard of included, says it takes one slot, and plans it; and the
// papers' dates read as months away (docs/rules/world.md R-WORLD-002).
import type { PlayerView } from "@japacity/sim";
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { newGame, richView, viewAfter } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { forMonths, nameOf, runningName, say } from "../../shared/words/text";
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
  test("[R-ADVICE-002] given a route only heard of and no plan yet, when Japa opens, then the official page is offered for it with a line that it takes one slot, and a tap plans it", async () => {
    const { store } = await openJapa(adaHeard());
    const button = document.querySelector<HTMLButtonElement>("[data-official-page]");
    expect(button?.getAttribute("data-official-page")).toBe(UK);
    expect(button?.textContent).toContain(nameOf(OFFICIAL));
    expect(button?.textContent).toContain(phoneWords("phone.japa.official", { route: runningName(UK) }));
    expect(phoneWords("phone.japa.official", { route: runningName(UK) })).toMatch(/one slot/);
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
