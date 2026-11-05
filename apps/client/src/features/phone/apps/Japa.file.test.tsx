// Japa's BUILD THE FILE in the file's order, and a way closed by the news said plainly (world:phone-holds-what-phones-hold,
// route-gates:talent-visa-needs-endorsement): the talent file lists the passport and the TB test the application needs beside the
// portfolio, the endorsement and the application; and while the pandemic has closed every route, Japa says so rather
// than mark every need done in silence. Real content, a developer played through `step`.
import { content } from "@japacity/content";
import type { Id, PlayerView } from "@japacity/sim";
import { applyEffects, readyLife, slot } from "@japacity/sim/testing";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../../shared/testing/render";
import { say } from "../../../shared/words/text";
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
  test("[world:phone-holds-what-phones-hold] [route-gates:talent-visa-needs-endorsement] given the talent file, when Japa shows, then BUILD THE FILE lists the passport before the endorsement and the TB test before the application, each ticked as the route reads it, with where it is got", async () => {
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
  test("[world:phone-holds-what-phones-hold] [world:nudge-says-one-thing] [text:show-then-tell] given every route closed by the news, when Japa shows, then a locked chip says every route is closed and to watch News", async () => {
    await renderWithView(<Japa />, developer(WINDOWS));
    const line = document.querySelector("[data-japa-closed]");
    expect(line?.getAttribute("data-japa-closed")).toBe("every");
    expect(line?.textContent).toBe(say("phone.japa.closed.every"));
    expect(line?.textContent).toBe("All closed · watch News");
    expect(line?.classList.contains("sticker-chip")).toBe(true);
    expect(line?.querySelector("svg.lucide-lock")).not.toBeNull();
  });

  test("[world:phone-holds-what-phones-hold] given only the talent route closed, when Japa shows, then it says this way is closed, never every route", async () => {
    await renderWithView(<Japa />, developer(["var.uk-talent-window"]));
    const line = document.querySelector("[data-japa-closed]");
    expect(line?.getAttribute("data-japa-closed")).toBe(TALENT);
    expect(line?.textContent).toBe(say("phone.japa.closed"));
    expect(line?.textContent).toBe("Closed · watch News");
  });
});
