// An act's facts as chips in their one order (text:show-then-tell): whatever order a sheet gives them in, they stand as pay,
// chance, time, when, a bill, a fee, a rate, where it counts and a catch; chips by default, icon rows only where asked for; what
// the act changes as tags with their arrows and what it needs as marks.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { FACT_ORDER, type Fact } from "../words/facts";
import { ChangesAndNeeds, Facts } from "./Facts";

const SHUFFLED: Fact[] = [
  { kind: "catch", words: "Sometimes it never arrives" },
  { kind: "rate", words: "£1 buys ₦2,139" },
  { kind: "time", words: "A day" },
  { kind: "fee", words: "Fee £270" },
  { kind: "pay", words: "₦70,000 a month" },
  { kind: "when", words: "Paid at month's end" },
  { kind: "chance", band: "likely" },
  { kind: "bill", words: "₦40,000 a month × 12" },
];

describe("an act's facts", () => {
  test("[text:show-then-tell] given facts in any order, when they are drawn, then they stand as chips in the one order, each a tilted sticker with its icon and its words", () => {
    render(<Facts facts={SHUFFLED} />);
    const chips = [...document.querySelectorAll<HTMLElement>("[data-facts='chips'] [data-fact]")];
    expect(chips.map((chip) => chip.getAttribute("data-fact"))).toEqual(FACT_ORDER.filter((kind) => kind !== "counts"));
    expect(FACT_ORDER).toEqual(["pay", "chance", "time", "when", "bill", "fee", "rate", "counts", "catch"]);
    for (const chip of chips) {
      expect(chip.className).toContain("sticker-chip");
      expect(chip.querySelector("svg, [data-gauge]")).not.toBeNull();
    }
    expect(chips[1]?.textContent).toBe("Likely");
    expect(document.querySelector("[data-facts='rows']")).toBeNull();
  });

  test("[text:show-then-tell] given a long fact where a chip cannot carry it, when the rows are asked for, then the same facts stand as rows in the same order", () => {
    render(<Facts facts={SHUFFLED} look="rows" />);
    expect([...document.querySelectorAll("[data-facts='rows'] [data-fact]")].map((row) => row.getAttribute("data-fact"))).toEqual(FACT_ORDER.filter((kind) => kind !== "counts"));
  });

  test("[text:show-then-tell] given what an act changes and what it needs, when they are drawn, then a gain is a tag with an up arrow, a cost a tag with a down arrow, and a need a mark with its word for a screen reader", () => {
    render(<ChangesAndNeeds changes={[{ tone: "up", words: "+2 English" }, { tone: "down", words: "Tires you" }]} needs={[{ state: "failed", words: "Your passport first", id: "passport" }]} />);
    expect([...document.querySelectorAll("[data-change]")].map((tag) => [tag.getAttribute("data-change"), tag.textContent])).toEqual([
      ["up", "+2 English"],
      ["down", "Tires you"],
    ]);
    expect(document.querySelector("[data-change='up'] svg.lucide-arrow-up")).not.toBeNull();
    expect(document.querySelector("[data-change='down'] svg.lucide-arrow-down")).not.toBeNull();
    expect(document.querySelector("[data-state-tag='passport'] [data-mark='failed']")?.getAttribute("aria-label")).not.toBeNull();
  });
});
