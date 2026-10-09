// No running month number anywhere a player sees (docs/rules/world.md R-WORLD-002): a month the
// simulation stamps into a report line reads as months away from the month in hand, which the
// game store keeps beside the words while a game is on screen.
import { text } from "@japacity/content";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { PhoneApps } from "../../features/phone/PhoneApps";
import { reloadSeen } from "../../features/phone/seen";
import { newGame } from "../testing/fixtures";
import { renderWithView } from "../testing/render";
import { monthEnding } from "./format";
import { nowMonth, setNow } from "./now";
import { forMonths, inMonths, words } from "./text";

const PASSPORT = "document.passport";
const STAMPED = /\{(month|until|readyMonth)\}/;

afterEach(() => {
  setNow(null);
});

/** Every line and reminder in content that carries a stamped month. */
function stampedKeys(): string[] {
  return Object.keys(text).filter((key) => (key.startsWith("line.") || key.includes(".reminder.")) && STAMPED.test(text[key] ?? ""));
}

describe("months away in the words", () => {
  test("[R-WORLD-002] given a month in hand, when every content line that carries a stamped month is told, then none shows a month number and each says months away", () => {
    const keys = stampedKeys();
    expect(keys.length).toBeGreaterThan(5);
    setNow(7);
    const told = keys.map((key) => ({ key, told: words(key, { month: 9, until: 9, readyMonth: 9 }) }));
    expect(told.filter(({ told: line }) => /month \d|\b9\b/i.test(line))).toEqual([]);
    expect(told.filter(({ told: line }) => !line.includes(inMonths(9, 7)) && !line.includes(forMonths(9, 7)))).toEqual([]);
  });

  test("[R-WORLD-002] given a month in hand, when a stamped month is this month, next month or later, then the line says this month, next month or in so many months", () => {
    setNow(4);
    expect(words("line.document.requested", { document: PASSPORT, month: 4 })).toContain("ready this month");
    expect(words("line.document.requested", { document: PASSPORT, month: 5 })).toContain("ready next month");
    expect(words("line.document.requested", { document: PASSPORT, month: 7 })).toContain("ready in 3 months");
    expect(words("line.credit.judgment", { country: "country.uk", until: 34 })).toContain("for 30 more months");
  });

  test("[R-WORLD-002] given no game on screen, when a stamped month is told, then it keeps its number, the month whose end brings it", () => {
    expect(nowMonth()).toBeNull();
    expect(words("line.document.requested", { document: PASSPORT, month: 5 })).toContain(`in month ${String(monthEnding(5))}`);
  });

  test("[R-WORLD-002] [R-WORLD-008] given a passport requested, when the month ends and News opens, then its line says when it is ready as months away, with no month number", async () => {
    localStorage.clear();
    reloadSeen();
    const game = newGame("scenario.ada");
    const { lines } = game.endTurn([{ activity: "activity.get-passport", param: null }]);
    const requested = lines.find((line) => line.key === "line.document.requested");
    const ready = requested?.params.month;
    if (typeof ready !== "number") throw new Error("The passport was not requested.");
    const view = game.view();
    await renderWithView(<PhoneApps onClose={() => undefined} area="Ojuelegba" now={() => new Date(2026, 9, 8, 12, 5)} talk={null} />, view);
    expect(nowMonth()).toBe(view.month);
    fireEvent.click(document.querySelector<HTMLElement>('[data-app="news"]')!);
    const report = document.querySelector("[data-report]");
    expect(report?.textContent).toContain(words("line.document.requested", requested?.params));
    expect(report?.textContent).toContain(`ready ${inMonths(ready, view.month)}`);
    expect(report?.textContent).not.toMatch(/month \d/i);
  });
});
