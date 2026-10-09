import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import { say } from "../words/text";
import { AskSheet } from "./AskSheet";
import { Band } from "./Band";
import { THEME_KEY } from "./contract";
import { Nudge } from "./Nudge";
import { restoreTheme, setTheme } from "./theme";
import { ThumbBar } from "./ThumbBar";

const naira = (amount: number): string => `₦${String(Math.round(amount / 100))}`;

describe("the band", () => {
  test("[R-WORLD-002] given a month, a place and money, when the band renders, then it shows those three and End month, and nothing else", () => {
    render(<Band when="Month 6" name="The family house" money={42_000_000} formatMoney={naira} onEndMonth={() => undefined} />);
    expect(screen.getByText("Month 6")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "The family house" })).toBeTruthy();
    expect(screen.getByText("₦420000")).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "End month" }).disabled).toBe(false);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  test("[R-WORLD-002] given the month cannot end, when the band renders with the reason, then End month is disabled and carries it", () => {
    render(<Band when="Month 6" name="Home" money={0} formatMoney={naira} onEndMonth={() => undefined} endBlocked="Answer the officer first" />);
    const button = screen.getByRole<HTMLButtonElement>("button", { name: "End month" });
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("title")).toBe("Answer the officer first");
  });
});

describe("the nudge", () => {
  test("[R-WORLD-003] given a nudge, when it renders, then it is one line of its words, and hidden it renders nothing", () => {
    const { rerender } = render(<Nudge nudge={{ key: "ui.nudge.end" }} />);
    expect(screen.getByText("End the month when you are ready")).toBeTruthy();
    rerender(<Nudge nudge={{ key: "ui.nudge.end" }} hidden />);
    expect(screen.queryByText("End the month when you are ready")).toBeNull();
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

describe("the theme", () => {
  test("[R-WORLD-021] given a theme is set, when it is set and restored, then the attribute on the root follows it and the device remembers it", () => {
    const root = { dataset: {} as DOMStringMap };
    const kept = new Map<string, string>();
    const storage = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value) };
    setTheme("danfo", root, storage);
    expect(root.dataset.ui).toBe("danfo");
    expect(kept.get(THEME_KEY)).toBe("danfo");
    const fresh = { dataset: {} as DOMStringMap };
    expect(restoreTheme(fresh, storage)).toBe("danfo");
    expect(fresh.dataset.ui).toBe("danfo");
    setTheme("adire", root, storage);
    expect(root.dataset.ui).toBeUndefined();
  });
});
