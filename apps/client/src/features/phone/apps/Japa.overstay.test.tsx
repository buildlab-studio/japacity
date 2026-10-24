// The Japa app on an overstay (status:view-shows-status, status:grace-allows-in-country-applications, person:partner-route-in-country): the
// stage in plain words over the visa, the acts the engine takes from inside the country each opening its own card as the
// Papers app's acts do, and the ways on file. Going home stays the bag's, so Japa only says where it is.
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { abroadView } from "../../../shared/testing/fixtures";
import { graceView, overstayingGame } from "../../../shared/testing/overstay";
import { renderWithView } from "../../../shared/testing/render";
import { overstayWords } from "../../../shared/words/overstay";
import { nameOf, say } from "../../../shared/words/text";
import { PhoneApps } from "../PhoneApps";

const SCHOOL = "activity.apply-to-school";

async function openJapaWithCards(view: Parameters<typeof renderWithView>[1]) {
  const rendered = await renderWithView(
    <PhoneApps onClose={() => undefined} area="Peckham" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} cards={(ids) => <div data-test-card={ids.join(",")} />} />,
    view,
  );
  fireEvent.click(document.querySelector<HTMLElement>('[data-app="japa"]')!);
  return rendered;
}

function overstay(): HTMLElement {
  const block = document.querySelector<HTMLElement>("[data-japa-overstay]");
  if (block === null) throw new Error("Japa shows no overstay.");
  return block;
}

describe("Japa on an overstay", () => {
  test("[status:grace-allows-in-country-applications] [status:view-shows-status] given the grace, when Japa opens, then the stage stands over the visa with what can be applied for from inside, a new course among the acts, and a tap opens the act's card", async () => {
    const view = graceView();
    expect(view.activities.find((option) => option.id === SCHOOL)?.allowed).toBe(true);
    await openJapaWithCards(view);
    expect(overstay().dataset.japaOverstay).toBe("grace");
    expect(overstay().textContent).toContain(overstayWords(view)!.title);
    expect(overstay().textContent).toContain(overstayWords(view)!.line);
    const act = within(overstay()).getByRole("button", { name: nameOf(SCHOOL) });
    fireEvent.click(act);
    expect(document.querySelector(`[data-test-card="${SCHOOL}"]`)).not.toBeNull();
    // The ways on file stand under it, as at home: the master's is known again once its status is gone (route:lapsed-route-known-again).
    expect(document.querySelector("[data-way-files]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("phone.japa.overstay.back") }));
    expect(document.querySelector('[data-way-file="route.uk-masters"]')).not.toBeNull();
  });

  test("[status:grace-allows-in-country-applications] given the grace passed, when Japa opens, then the new course is no longer offered from inside, the stage says overstaying, and the way home is the bag's", async () => {
    const view = overstayingGame().view();
    expect(view.activities.find((option) => option.id === SCHOOL)?.allowed).not.toBe(true);
    await openJapaWithCards(view);
    expect(overstay().dataset.japaOverstay).toBe("over");
    expect(within(overstay()).queryByRole("button", { name: nameOf(SCHOOL) })).toBeNull();
    expect(overstay().textContent).toContain(say("phone.japa.overstay.home"));
  });

  test("[status:view-shows-status] given a visa that holds, when Japa opens, then no overstay is shown", async () => {
    await openJapaWithCards(abroadView());
    expect(document.querySelector("[data-japa-overstay]")).toBeNull();
  });
});
