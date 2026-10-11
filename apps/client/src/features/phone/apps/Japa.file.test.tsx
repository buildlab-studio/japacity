// Japa's BUILD THE FILE in the file's order, and a way closed by the news said plainly (docs/rules/world.md R-WORLD-019,
// route-gates.md R-ENDORSE-003). X1: the talent file listed the portfolio, the endorsement and the
// application, and neither the passport nor the TB test the application needs. X2: Japa marked every need done while
// the pandemic had closed every route, and nothing said so. Real content, a developer played through `step`.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { describe, expect, test } from "vitest";

import { applyEffects, readyLife, slot } from "../../../../../../packages/sim/src/route/route.journey";
import { renderWithView } from "../../../shared/testing/render";
import { say } from "../../../shared/words/text";
import { phoneWords } from "../phone.words";
import { Japa } from "./Japa";

const TALENT: Id<"route"> = "route.uk-talent";
const FILE = "chapter.build-the-file-talent";
const WINDOWS = Object.values(content.route).flatMap((route) => (route?.window === null || route?.window === undefined ? [] : [route.window]));

/** A developer with the talent page read, no passport; `closed`: the windows the news shuts once the page is read. */
function developer(closed: readonly string[] = []): PlayerView {
  let from = Number.POSITIVE_INFINITY;
  const shut = Object.fromEntries(closed.map((window) => [window, 0])) as Record<Id<"var">, number>;
  const game = readyLife(content, { quiet: true, documents: [], qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 }, vars: (tick) => (tick >= from ? shut : {}) });
  for (let months = 0; months < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; months += 1) game.endTurn();
  applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
  game.endTurn([slot("activity.look-into-route", TALENT)]);
  from = game.tick;
  const view = game.view();
  return { ...view, plan: { ...view.plan, route: TALENT }, chapter: { current: FILE, items: [{ id: "portfolio", met: true }, { id: "endorsement", met: false }, { id: "applied", met: false }], done: [], closes: false, next: null } };
}

describe("the talent file in Japa", () => {
  test("[R-WORLD-019] [R-ENDORSE-003] given the talent file, when Japa shows, then BUILD THE FILE lists the passport before the endorsement and the TB test before the application, each ticked as the route reads it, with where it is got", async () => {
    await renderWithView(<Japa />, developer());
    const rows = [...document.querySelectorAll(`[data-chapter-steps='${FILE}'] li`)];
    const said = rows.map((row) => row.querySelector("span > span")?.textContent ?? "");
    expect(said).toEqual([say(`${FILE}.item.portfolio`), say(`${FILE}.item.passport`), say(`${FILE}.item.endorsement`), say(`${FILE}.item.tb`), say(`${FILE}.item.applied`)]);
    expect(rows.map((row) => row.getAttribute("data-met"))).toEqual(["true", "false", "false", "false", "false"]);
    expect(rows[1]?.querySelector("[data-step-way]")?.textContent).toBe(say(`${TALENT}.item.passport.way`));
    expect(rows[3]?.querySelector("[data-step-way]")?.textContent).toContain("last of all");
    expect(document.querySelector("[data-japa-closed]")).toBeNull();
  });
});

describe("a closed way in Japa", () => {
  test("[R-WORLD-019] [R-WORLD-003] given every route closed by the news, when Japa shows, then it says every route is closed and that the news says when they open", async () => {
    await renderWithView(<Japa />, developer(WINDOWS));
    const line = document.querySelector("[data-japa-closed]");
    expect(line?.getAttribute("data-japa-closed")).toBe("every");
    expect(line?.textContent).toBe(phoneWords("phone.japa.closed.every"));
    expect(line?.textContent).toBe("Every route is closed for now. The news says when they open.");
  });

  test("[R-WORLD-019] given only the talent route closed, when Japa shows, then it says this way is closed, never every route", async () => {
    await renderWithView(<Japa />, developer(["var.uk-talent-window"]));
    const line = document.querySelector("[data-japa-closed]");
    expect(line?.getAttribute("data-japa-closed")).toBe(TALENT);
    expect(line?.textContent).toBe(phoneWords("phone.japa.closed"));
  });
});
