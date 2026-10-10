// The travel data page as designed (prologue.md R-PROLOGUE-009, 014): the photo, the name, the age and
// what the life was so far, the family and how ready in a row under them, and Begin's round red stamp.
import { render } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { DataPage, PAGE_COLOURS, Stamp } from "./DataPage";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const PAGE = { name: "Ife", age: "23", path: "The developer", ready: "12%", photo: "" };

describe("the data page", () => {
  test("[R-PROLOGUE-009] given a page with a family, then it prints the name, the age, so far, the family and ready, ready as the big figure on the right; with none, no family field", () => {
    render(<DataPage page={{ ...PAGE, family: "A family that gets by" }} />);
    const field = (id: string): string | null => document.querySelector(`[data-page] [data-field='${id}']`)?.textContent ?? null;
    expect(field("name")).toBe(`${say("prologue.page.name")}Ife`);
    expect(field("path")).toBe(`${say("prologue.page.path")}The developer`);
    expect(field("family")).toBe(`${say("ui.page.field.family")}A family that gets by`);
    expect(field("ready")).toBe(`${say("prologue.page.ready")}12%`);
    expect(document.querySelector("[data-field='ready'] .num")).not.toBeNull();
    document.body.innerHTML = "";
    render(<DataPage page={PAGE} />);
    expect(document.querySelector("[data-field='family']")).toBeNull();
  });

  test("[R-PROLOGUE-014] given Begin's stamp, then it lands as a round red stamp across the page, a small step stamp stays a box", () => {
    render(<DataPage page={PAGE} stamp={<Stamp words={say("prologue.page.stamp.ready")} turn={-12} big />} />);
    const round = document.querySelector<HTMLElement>("[data-stamp-round]")!;
    expect(round.className).toContain("rounded-full");
    expect(round.style.color).toBe("rgb(179, 48, 42)");
    expect(PAGE_COLOURS.red).toBe("#b3302a");
    document.body.innerHTML = "";
    render(<Stamp words="Passport held" turn={2} />);
    expect(document.querySelector("[data-stamp-round]")).toBeNull();
    expect(document.querySelector("[data-stamp]")?.className).not.toContain("rounded-full");
  });
});
