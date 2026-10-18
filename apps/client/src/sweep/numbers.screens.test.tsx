// No simulation number on two screens (docs/rules/text.md R-TEXT-005): the
// talent file in the Japa app never reads "Tech skill at 75 or more", nor the hub's board "₦90,000 at tech 50". Played on the real content.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";
import { fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ActivityPicker } from "../features/activity/ActivityView";
import { PhoneApps } from "../features/phone/PhoneApps";
import { newGame, viewAfter } from "../shared/testing/fixtures";
import { renderWithView } from "../shared/testing/render";
import { nameOf } from "../shared/words/text";

const TALENT = "route.uk-talent";
const LOOK = "activity.look-into-route";
const HUNT = "activity.job-hunt";
const TUTORING = "activity.weekend-tutoring";

/** A digit after any quality's name or its first word, alone or after "at", "of" or a colon. */
function figures(said: string): string[] {
  return Object.keys(content.quality).flatMap((quality) => {
    const name = nameOf(quality);
    return [name, name.split(" ")[0] ?? name].filter((each) => new RegExp(`\\b${each}\\b(:| at| of)?\\s*\\d`, "i").test(said));
  });
}

/** Ada with tech and work enough to hear of the talent route, and it looked into: its file is the one the Japa app shows. */
function talentKnown(): PlayerView {
  const game = newGame("scenario.ada");
  const hearIf = content.route[TALENT]?.hearIf ?? [];
  const lifts = hearIf.flatMap((gate) => (gate.type === "quality/min" ? [{ type: "quality/add" as const, quality: gate.quality, amount: gate.value }] : []));
  viewAfter(game, [...lifts, { type: "route/hear", route: TALENT, via: "test" }]);
  game.endTurn([{ activity: LOOK, param: TALENT }]);
  const view = game.view();
  const route = view.routes.find((each) => each.id === TALENT);
  if (route === undefined || route.state === "heard" || route.state === "unknown") throw new Error("The talent route was not looked into.");
  return view;
}

describe("no quality's figure on the screens", () => {
  test("[R-TEXT-005] [R-WORLD-019] given the talent route looked into, when the Japa app opens, then its steps say strong tech and no quality's figure", async () => {
    await renderWithView(<PhoneApps onClose={() => undefined} area="Yaba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />, talentKnown());
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="japa"]')!);
    const steps = [...document.querySelectorAll("[data-steps] li")].map((row) => row.textContent ?? "");
    expect(steps.length).toBe(content.route[TALENT]?.checklist.length);
    expect(steps).toContain("Strong tech");
    expect(steps.flatMap(figures)).toEqual([]);
  });

  test("[R-TEXT-005] [R-ACTIVITY-014] given Ada at the hub's board, when its rows are read, then no row says a quality's figure, and weekend tutoring's pay rises once her tech is good", async () => {
    await renderWithView(<ActivityPicker only={[HUNT]} />, newGame("scenario.ada").view());
    const rows = [...document.querySelectorAll("[data-job]")];
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.flatMap((row) => figures(row.textContent ?? ""))).toEqual([]);
    expect(document.querySelector(`[data-job="${TUTORING}"] [data-lift]`)?.textContent).toBe("₦90,000 once your tech is good");
  });
});
