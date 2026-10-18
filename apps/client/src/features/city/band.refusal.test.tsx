// The band after a refusal (docs/rules/world.md R-WORLD-002, R-WORLD-003): the nudge "Ask for the
// endorsement again in 6 months" over the coming chip "You can ask for the endorsement again, in 6 months"
// would say nearly the same sentence twice. When the chip's "what" is the nudge's own wait, the chip stays folded: the
// row peeks with the nudge alone, and the handle still opens the chip. Real content, a real refusal played through step.
import { content } from "@japacity/content";
import type { Content, Id, PlayerView } from "@japacity/sim";
import { applyEffects, readyLife, slot } from "@japacity/sim/testing";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { renderWithView } from "../../shared/testing/render";
import { inMonths } from "../../shared/words/text";
import { City, chipFolds } from "./City";
import { cityWords } from "./city.words";
import { soonest } from "../../shared/words/coming";
import { nudgeOf } from "./nudge/nudge";

const TALENT: Id<"route"> = "route.uk-talent";
const FILE = "chapter.build-the-file-talent";

function neverEndorsed(used: Content): Content {
  const route = used.route[TALENT]!;
  return { ...used, route: { ...used.route, [TALENT]: { ...route, endorsement: { ...route.endorsement!, baseBp: 0, perPortfolioBp: 0, perNetworkBp: 0 } } } };
}

/** A developer whose endorsement was asked for and refused, in the talent file with the endorsement next. */
function refusedView(): PlayerView {
  const game = readyLife(content, { quiet: true, change: neverEndorsed, qualities: { "quality.tech": 85, "quality.portfolio": 5, "quality.network": 70 } });
  for (let month = 0; month < 4 && game.state.route["route.uk-masters"]!.state === "unknown"; month += 1) game.endTurn();
  applyEffects(game, [{ type: "route/hear", route: TALENT, via: "meetup" }]);
  game.endTurn([slot("activity.look-into-route", TALENT)]);
  game.accept({ type: "activity/now", activity: "activity.apply-endorsement", param: null });
  const ready = game.state.document["document.endorsement"]?.readyMonth ?? 0;
  while (game.state.turn.month < ready) game.endTurn();
  const view = game.view();
  return { ...view, offers: [], setpiece: null, interview: null, chapter: { current: FILE, items: [{ id: "portfolio", met: true }, { id: "endorsement", met: false }, { id: "applied", met: false }], done: [], closes: false, next: null } };
}

describe("the band after a refusal", () => {
  test("[R-WORLD-002] [R-WORLD-003] given the endorsement refused, when the nudge names the wait and the chip would name the same wait, then the chip folds; another thing coming, or another month, does not fold it", () => {
    const view = refusedView();
    const nudge = nudgeOf(view);
    const coming = soonest(view);
    expect(nudge.key).toBe(`${FILE}.item.endorsement.wait`);
    expect(coming).not.toBeNull();
    expect(nudge.params?.when).toBe(inMonths(coming!.month, view.month));
    expect(chipFolds(nudge, coming, view.month)).toBe(true);
    expect(chipFolds(nudge, { ...coming!, month: coming!.month + 1 }, view.month)).toBe(false);
    expect(chipFolds(nudge, { ...coming!, kind: "offer" }, view.month)).toBe(false);
    expect(chipFolds({ ...nudge, about: "end" }, coming, view.month)).toBe(false);
  });

  test("[R-WORLD-002] given the endorsement refused, when the band's row peeks at the hub, then the brief's chip stands alone and no coming chip says the wait again; the handle still opens the coming chip", async () => {
    localStorage.setItem("japacity.city.last", JSON.stringify(["place.yaba"]));
    const view = refusedView();
    await renderWithView(<City world results={(at) => <p data-results-for={at} />} />, view);
    const go = document.querySelector<HTMLElement>("[data-opening-go]");
    if (go !== null) fireEvent.click(go);
    const mapClose = screen.queryByRole("button", { name: cityWords("city.close") });
    if (mapClose !== null) fireEvent.click(mapClose);
    // At the step's place the road's chip comes back; the wait itself is the Japa app's to tell.
    expect(document.querySelector("[data-brief-chip]")?.getAttribute("data-brief-chip")).toBe("here");
    expect(document.querySelector("[data-coming]")).toBeNull();
    const handle = document.querySelector<HTMLElement>("[data-band-handle]");
    expect(handle).not.toBeNull();
    fireEvent.click(handle!);
    expect(document.querySelector("[data-coming]")).not.toBeNull();
  });
});
