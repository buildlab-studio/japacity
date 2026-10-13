import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { LoadingNote } from "./LoadingNote";
// Registers Testing Library's cleanup for this file.
import "../../shared/testing/render";

describe("a place loading", () => {
  test("[R-CITY-018] given a place loading, when its note shows, then it names the place and shows the progress as a bar that fills, never as a figure in per cent", () => {
    render(<LoadingNote place="Ojuelegba" percent={42} />);
    const note = document.querySelector<HTMLElement>("[data-loading]");
    expect(note?.textContent).toContain("Ojuelegba");
    expect(note?.textContent).not.toMatch(/%|\d/);
    const bar = screen.getByRole("progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });
});
