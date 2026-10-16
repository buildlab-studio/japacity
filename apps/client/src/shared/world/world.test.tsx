import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import type { MomentShot } from "../../authority/store";
import { engineView } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { say } from "../words/text";
import { AskSheet } from "./AskSheet";
import { WorldSheet } from "./WorldSheet";
import { Band } from "./Band";
import { Nudge } from "./Nudge";
import { ThumbBar } from "./ThumbBar";

const naira = (amount: number): string => `₦${String(Math.round(amount / 100))}`;

describe("the band", () => {
  test("[R-WORLD-002] given a month, a place and money, when the band renders, then it shows those three with the month's name and the part of the day, and nothing else: no Next month", () => {
    render(<Band when="Month 6" name="The family house" money={42_000_000} formatMoney={naira} month={{ name: "April", part: "Evening" }} />);
    expect(screen.getByText("Month 6")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The family house" })).toBeTruthy();
    expect(screen.getByText("₦420000")).toBeTruthy();
    expect(screen.getByRole("button", { name: say("ui.month.chip", { name: "April", part: "Evening" }) })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next month" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("the nudge", () => {
  test("[R-WORLD-003] given a nudge, when it renders, then it is one line of its words, and hidden it renders nothing", () => {
    const { rerender } = render(<Nudge nudge={{ key: "ui.nudge.end" }} />);
    expect(screen.getByText("Live the month, or sleep")).toBeTruthy();
    rerender(<Nudge nudge={{ key: "ui.nudge.end" }} hidden />);
    expect(screen.queryByText("Live the month, or sleep")).toBeNull();
  });
});

describe("the thumb bar", () => {
  test("[R-WORLD-004] given something waits on the phone, when the bar renders, then Phone carries a dot, Map does not, and each tap reaches its handler", () => {
    const onMap = vi.fn();
    const onPhone = vi.fn();
    render(<ThumbBar onMap={onMap} onPhone={onPhone} phoneWaiting />);
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    expect(onMap).toHaveBeenCalledTimes(1);
    expect(onPhone).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Phone" }).querySelector("[data-dot]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Map" }).querySelector("[data-dot]")).toBeNull();
  });
});

describe("a world sheet under a moment card", () => {
  test("[R-MOMENT-006] given the results up, when a moment card stands over them, then the sheet's head, its title and its close, steps back so one close is in view, and comes back as the card goes", async () => {
    const { store } = await renderWithView(
      <WorldSheet open onClose={() => undefined} label="25 yrs 6 mo" title="The month is done" mark="results">
        <p>Salary</p>
      </WorldSheet>,
      engineView(),
    );
    const head = (): HTMLElement | null => document.querySelector<HTMLElement>("[data-world-sheet-head]");
    act(() => store.setState({ reportOpen: true }));
    expect(head()?.dataset.worldSheetHead).toBe("shown");
    act(() => store.setState({ momentCards: [{} as MomentShot] }));
    expect(head()?.dataset.worldSheetHead).toBe("covered");
    expect(head()?.getAttribute("aria-hidden")).toBe("true");
    act(() => store.setState({ momentCards: [] }));
    expect(head()?.dataset.worldSheetHead).toBe("shown");
    expect(screen.getByRole("button", { name: say("ui.world.close") })).toBeTruthy();
  });
});

describe("the sheet", () => {
  const ask = (form: "card" | "slip", act: () => void, dismiss: () => void) => ({
    form,
    icon: "bulb",
    who: "Mama",
    title: "Light bill",
    line: "The light people came again.",
    cost: { amount: 680_000, currency: "NGN" },
    button: "Pay it",
    act,
    dismiss,
    reference: "METER 0411",
  });

  test("[R-WORLD-006] given a card ask, when it opens, then who, the title, the line, the cost and one main button that says what is left after are shown", () => {
    const act = vi.fn();
    render(<AskSheet ask={ask("card", act, () => undefined)} have={4_850_000} formatMoney={(amount) => naira(amount)} />);
    expect(screen.getByText("Mama")).toBeTruthy();
    expect(screen.getByText("Light bill")).toBeTruthy();
    expect(screen.getByText("The light people came again.")).toBeTruthy();
    expect(screen.getByText("₦6800")).toBeTruthy();
    const main = screen.getByRole("button", { name: /Pay it/ });
    expect(main.textContent).toContain("₦41700 left");
    fireEvent.click(main);
    expect(act).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-ask-form]")?.getAttribute("data-ask-form")).toBe("card");
  });

  test("[R-WORLD-006] given an ask that happens at once, when it opens, then its second line says Now; given a reason from the world that stops it, then the button is shut and says the reason", () => {
    const act = vi.fn();
    render(<AskSheet ask={{ ...ask("card", act, () => undefined), cost: null, when: "now" }} have={4_850_000} formatMoney={(amount) => naira(amount)} />);
    const main = screen.getByRole("button", { name: /Pay it/ });
    expect(main.textContent).toContain(say("ui.world.now"));
    expect((main as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    render(<AskSheet ask={{ ...ask("card", act, () => undefined), when: "now", blocked: say("ui.world.depart-held") }} have={4_850_000} formatMoney={(amount) => naira(amount)} />);
    const shut = screen.getByRole("button", { name: /Pay it/ });
    expect((shut as HTMLButtonElement).disabled).toBe(true);
    expect(shut.textContent).toContain(say("ui.world.depart-held"));
    fireEvent.click(shut);
    expect(act).not.toHaveBeenCalled();
  });

  test("[R-WORLD-006] given a slip ask, when it opens, then it carries the reference and a Not now beside the main button, and Not now dismisses", () => {
    const dismiss = vi.fn();
    render(<AskSheet ask={ask("slip", () => undefined, dismiss)} have={4_850_000} formatMoney={(amount) => naira(amount)} />);
    expect(screen.getByText("METER 0411")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(document.querySelector("[data-ask-form]")?.getAttribute("data-ask-form")).toBe("slip");
  });
});
