// The centred column on a laptop (docs/design/13-the-lively-layer.md, section 2): the band and its nudge, the thumbs and
// their first labels, the corner's toasts, the teaching cards and the phone's frame each stand in it, so on a wide
// screen they sit in the middle with the world around them.
import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { Phone } from "../features/phone/Phone";
import { Band } from "../shared/world/Band";
import { Corner, resetLines, tell } from "../shared/world/Lines";
import { Nudge } from "../shared/world/Nudge";
import { ThumbBar } from "../shared/world/ThumbBar";
import { FirstUseLabels } from "../shared/world/Walkthrough";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

afterEach(() => {
  resetLines();
});

function inColumn(selector: string): boolean {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`Nothing at ${selector}`);
  return found.closest("[data-centred-column]") !== null;
}

describe("the centred column", () => {
  test("[R-WORLD-002] given the band with its nudge under it, when it draws, then both stand in the column", () => {
    render(<Band when="23 yrs" name="The family house" money={0} formatMoney={String} more={<Nudge nudge={{ key: "ui.world.whole" }} />} />);
    expect(inColumn("[data-band] > *")).toBe(true);
    expect(inColumn("[data-nudge]")).toBe(true);
  });

  test("[R-WORLD-004] given the thumbs and their first labels, when they draw, then Map and Phone and their labels stand in the column", () => {
    render(
      <>
        <ThumbBar onMap={() => undefined} onPhone={() => undefined} phoneWaiting={false} />
        <FirstUseLabels tapped={new Set()} hidden={false} />
      </>,
    );
    expect(inColumn('[data-thumb="map"]')).toBe(true);
    expect(inColumn('[data-thumb="phone"]')).toBe(true);
    expect(inColumn("[data-first-labels] > *")).toBe(true);
  });

  test("[R-WORLD-026] given a line told in the corner, when it shows, then it stands in the column", () => {
    render(<Corner />);
    act(() => tell("Money changed"));
    expect(inColumn("[data-corner]")).toBe(true);
  });

  test("[R-WORLD-018] given the phone, when it rises, then its frame stands in the column, at rest and grown", () => {
    render(<Phone apps={[]} onClose={() => undefined} area="Ojuelegba" when="Month 6" />);
    expect(inColumn("[data-handset]")).toBe(true);
  });
});
