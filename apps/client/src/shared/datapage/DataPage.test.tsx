// The travel data page as designed, line for line (prologue.md R-PROLOGUE-009): the
// header and its type line, the photo, NAME, NATIONALITY beside AGE, PATH, SO FAR, FAMILY beside READY as the big
// figure, and the machine-readable strip from the game's own data. The visa's stamp is round and red.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { DataPage, mrz, PAGE_COLOURS, Stamp, stripLines } from "./DataPage";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

/** Tailwind's whole round, which the palette's own test counts as a pill (R-WORLD-021). */
const ROUND = ["rounded", "full"].join("-");

const PAGE = { name: "Ifẹ́", age: "23 yrs 1 mo", path: "The developer", was: "Science, then computer science", ready: "12%", photo: "", family: "A family that gets by", strip: { district: "Surulere", years: 23, months: 1, percent: 12 } };

describe("the data page", () => {
  test("[R-PROLOGUE-009] given a page, then it prints the design's lines in the design's order: the type line, the name, the nationality beside the age, the path, so far, the family beside ready as the big figure, then the strip", () => {
    render(<DataPage page={PAGE} />);
    const field = (id: string): string | null => document.querySelector(`[data-page] [data-field='${id}']`)?.textContent ?? null;
    expect(document.querySelector("[data-page-type]")?.textContent).toBe(say("ui.page.type-line"));
    expect(field("name")).toBe(`${say("prologue.page.name")}Ifẹ́`);
    expect(field("nationality")).toBe(`${say("ui.page.field.nationality")}${say("ui.page.nationality")}`);
    expect(field("age")).toBe(`${say("prologue.page.age")}23 yrs 1 mo`);
    expect(field("path")).toBe(`${say("ui.page.field.path")}The developer`);
    expect(field("was")).toBe(`${say("prologue.page.path")}Science, then computer science`);
    expect(field("family")).toBe(`${say("ui.page.field.family")}A family that gets by`);
    expect(field("ready")).toBe(`${say("prologue.page.ready")}12%`);
    expect(document.querySelector("[data-field='ready'] .num")).not.toBeNull();
    const order = [...document.querySelectorAll<HTMLElement>("[data-page] [data-field]")].map((one) => one.dataset["field"]);
    expect(order).toEqual(["name", "nationality", "age", "path", "was", "family", "ready"]);
    expect(document.querySelector("[data-page-strip]")?.textContent).toBe(stripLines("Ifẹ́", PAGE.strip).join(""));
    // No stamp before a visa.
    expect(document.querySelector("[data-stamp]")).toBeNull();
  });

  test("[R-PROLOGUE-009] given the game's own data, then the strip carries the name, the home's district, the age and how ready, in capitals with fillers; a part not known yet is fillers; never a real number", () => {
    expect(stripLines("Ifẹ́", PAGE.strip)).toEqual(["P<NGAIFE<<<<<<<<<<<<<<<<<<<<<<", "SURULERE<<23Y1M<<12<<<<<<<<<<<"]);
    expect(stripLines("Ada", { district: "Ojuelegba", years: 24, months: null, percent: null })[1]).toBe("OJUELEGBA<<24Y<<<<<<<<<<<<<<<<");
    expect(mrz("Mary-Jane", 12)).toBe("MARY<JANE<<<");
    for (const line of stripLines("Temi", PAGE.strip)) expect(line).toHaveLength(30);
  });

  test("[R-PROLOGUE-009] given the visa's stamp, then it is round and red with the way under it; a step after it is a small box", () => {
    render(<DataPage page={{ ...PAGE, stamps: [{ words: say("prologue.page.stamp.granted"), under: "care work" }, { words: say("ui.page.stamp.flight") }] }} />);
    const round = document.querySelector<HTMLElement>("[data-stamp-visa] [data-stamp-round]")!;
    expect(round.className.split(" ")).toContain(ROUND);
    expect(round.style.color).toBe("rgb(179, 48, 42)");
    expect(round.textContent).toBe(`${say("prologue.page.stamp.granted")}care work`);
    expect(PAGE_COLOURS.red).toBe("#b3302a");
    const after = [...document.querySelectorAll<HTMLElement>("[data-stamps] [data-stamp]")];
    expect(after.map((one) => one.textContent)).toEqual([say("ui.page.stamp.flight")]);
    expect(after[0]?.className.split(" ")).not.toContain(ROUND);
    document.body.innerHTML = "";
    render(<Stamp words="Landed" turn={2} />);
    expect(document.querySelector("[data-stamp-round]")).toBeNull();
  });
});
