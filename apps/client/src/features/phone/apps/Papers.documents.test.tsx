// The papers list in Papers (docs/rules/document.md R-DOCUMENT-008; world.md R-WORLD-019, R-WORLD-002): none said
// plainly, each paper named from content with its state, a warning two months before one
// runs out, none while a new copy is on its way, and when a copy comes said as months away, never a month number.
import { text } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { engineView, richView } from "../../../shared/testing/fixtures";
import { renderWithView } from "../../../shared/testing/render";
import { inMonths, say, sayCount } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";
import { papersOf } from "../papers";
import { phoneWords } from "../phone.words";

async function openPapers(view: PlayerView) {
  const rendered = await renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 11, 12, 0)} talk={null} />, view);
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="papers"]')!);
  return rendered;
}

function paper(id: string): HTMLElement {
  const card = document.querySelector<HTMLElement>(`[data-paper="${id}"]`);
  if (card === null) throw new Error(`No ${id} in Papers.`);
  return card;
}

const TB = "document.tb-certificate" as const;

describe("the papers, in Papers", () => {
  test("[R-WORLD-019] given none, then it says so", async () => {
    // No paper held and no way out read into yet: nothing to list.
    const base = engineView();
    const view: PlayerView = { ...base, documents: [], plan: { ...base.plan, route: null }, routes: base.routes.map((route) => ({ ...route, state: "unknown" as const })) };
    expect(papersOf(view)).toEqual([]);
    await openPapers(view);
    expect(document.querySelector("[data-papers-none]")?.textContent).toBe(phoneWords("phone.papers.none"));
  });

  test("[R-WORLD-019] [R-DOCUMENT-008] given held and pending papers, then each is named from content with its state, the coming one as months away", async () => {
    const view = richView();
    await openPapers(view);
    const passport = paper("document.passport");
    expect(passport.getAttribute("data-state")).toBe("held");
    expect(passport.textContent).toContain(text["document.passport.name"]!);
    const coming = view.documents.find((held) => held.onItsWay !== null || held.state === "pending");
    if (coming === undefined) throw new Error("Nothing on its way in the rich view.");
    expect(paper(coming.id).querySelector("[data-paper-state]")?.textContent).toBe(phoneWords("phone.papers.pending", { when: inMonths(coming.onItsWay ?? view.month, view.month) }));
    expect(paper("document.english-test").textContent).toContain(say("ui.document.band", { band: "6.5" }));
  });

  test("[R-DOCUMENT-008] given a held paper two months from running out, then it warns", async () => {
    const rich = richView();
    const documents = [{ id: TB, state: "held" as const, readyMonth: null, expiresMonth: rich.month + 2, value: null, onItsWay: null }];
    await openPapers({ ...rich, documents });
    expect(paper(TB).textContent).toContain(sayCount("ui.document.expires-soon", 2, { months: 2 }));
  });

  test("[R-DOCUMENT-008] given a held paper two months from running out with a new copy on its way, then it says when the new copy comes and does not warn", async () => {
    const rich = richView();
    const documents = [{ id: TB, state: "held" as const, readyMonth: rich.month + 1, expiresMonth: rich.month + 2, value: null, onItsWay: rich.month + 1 }];
    await openPapers({ ...rich, documents });
    expect(paper(TB).querySelector("[data-paper-state]")?.textContent).toBe(phoneWords("phone.papers.pending", { when: inMonths(rich.month + 1, rich.month) }));
    expect(paper(TB).textContent).not.toContain(sayCount("ui.document.expires-soon", 2, { months: 2 }));
  });

  test("[R-DOCUMENT-008] given held papers far from running out, then there is no warning", async () => {
    await openPapers(richView());
    expect(document.querySelector("[data-papers]")?.textContent).not.toMatch(/Runs out/);
  });
});
