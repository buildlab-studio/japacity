// The Graduate visa on the status card (status:graduate-visa-applied-for): from course month 9 the card says what the application
// costs, the fee and the surcharge, so the months to save show; once it may be made, the card applies, asking once more with the sum.
import type { PlayerView } from "@japacity/sim";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { newGame } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { say } from "../../../shared/words/text";
import { openPapers } from "../phone.testing";

const APPLY = "activity.apply-graduate";

/** A student in the UK whose view carries the Graduate cost; `open` lets the application be made now. */
function student(open: boolean): PlayerView {
  const base = newGame("scenario.graduate").view();
  const status: NonNullable<PlayerView["status"]> = {
    entry: "status.uk-student",
    monthsLeft: 6,
    clock: null,
    lawfulMonths: 10,
    settleMonths: null,
    work: "part",
    nextStep: null,
    renew: null,
    overstay: null,
    graduate: { currency: "GBP", fee: 93_700, surcharge: 207_000 },
  };
  const apply = { id: APPLY, allowed: open, missing: [], params: null, cost: [], affordable: true, when: "now", done: false } as PlayerView["activities"][number];
  return { ...base, place: { ...base.place, where: "abroad", country: "country.uk" }, status, activities: [...base.activities.filter((option) => option.id !== APPLY), apply] };
}

const block = () => document.querySelector<HTMLElement>("[data-graduate]");

describe("the Graduate visa on the status card", () => {
  test("[status:graduate-visa-applied-for] given a student in course month 9, when Papers opens, then the status card says what the Graduate application costs, the fee and the surcharge, and offers no button yet", async () => {
    await openPapers(student(false));
    expect(block()?.textContent).toContain(say("ui.status.graduate-fees", { fee: formatMoney(93_700, "GBP"), surcharge: formatMoney(207_000, "GBP"), total: formatMoney(300_700, "GBP") }));
    expect(block()?.textContent).toContain(say("ui.status.graduate-later"));
    expect(block()?.querySelector("button")).toBeNull();
  });

  test("[status:graduate-visa-applied-for] [world:one-action-one-sheet] given the course passed and the application open, when the player applies and confirms, then the application is sent at once", async () => {
    const { authority } = await openPapers(student(true));
    fireEvent.click(block()!.querySelector<HTMLElement>("[data-graduate-apply]")!);
    fireEvent.click(block()!.querySelector<HTMLElement>("[data-graduate-yes]")!);
    await waitFor(() => expect(authority.sent.at(-1)).toMatchObject({ type: "activity/now", activity: APPLY }));
  });
});
