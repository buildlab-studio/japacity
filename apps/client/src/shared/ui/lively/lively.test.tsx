// The lively layer's primitives (docs/design/13-the-lively-layer.md, section 2; decision 0038): a sticker, a sticker chip,
// the pressed yellow action, a pill, a card, a sheet with its handle, a person's name pill and the centred column. Each
// carries a data attribute for tests and pictures and takes a className.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

import { say } from "../../words/text";
import { CentredColumn, COLUMN_PX } from "./CentredColumn";
import { Face, faceMark } from "./Face";
import { LivelyCard } from "./LivelyCard";
import { LivelySheet } from "./LivelySheet";
import { Pill } from "./Pill";
import { PressButton } from "./PressButton";
import { Sticker } from "./Sticker";
import { StickerChip } from "./StickerChip";
import { TINTS } from "./tint";
// Registers Testing Library's cleanup for this file.
import "../../testing/render";

function one(selector: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`Nothing at ${selector}`);
  return found;
}

describe("the sticker", () => {
  test("[R-WORLD-021] given a picture, when the sticker draws, then it shows the picture cut with the white edge, tilted, named for a screen reader", () => {
    render(<Sticker src="/assets/tiles/prop_cooking-fire.png" alt="The cooking fire" className="extra" />);
    const sticker = one("[data-sticker]");
    const picture = screen.getByRole("img", { name: "The cooking fire" });
    expect(picture.getAttribute("src")).toBe("/assets/tiles/prop_cooking-fire.png");
    expect(sticker.hasAttribute("data-stand-in")).toBe(false);
    expect(sticker.className).toContain("extra");
    expect(one("[data-sticker-cut]").className).toContain("sticker-cut");
    expect(one("[data-sticker-cut]").style.rotate).toMatch(/^-?\d+deg$/);
  });

  test("[R-WORLD-021] given no picture yet, when the sticker draws, then an emoji stands in and says so; a tint by kind puts a soft tile behind it", () => {
    render(<Sticker emoji="🍜" alt="Indomie" tint="food" tilt={4} />);
    const sticker = one("[data-sticker]");
    expect(sticker.getAttribute("data-stand-in")).toBe("");
    expect(sticker.getAttribute("data-tint")).toBe("food");
    expect(sticker.className).toContain("bg-tint-food");
    expect(screen.getByRole("img", { name: "Indomie" }).textContent).toBe("🍜");
    expect(one("[data-sticker-cut]").style.rotate).toBe("4deg");
  });

  test("[R-WORLD-021] given every kind, then each has its tint class, and the plain kind is the sheet's", () => {
    expect(Object.keys(TINTS).sort()).toEqual(["body", "food", "money", "people", "plain", "study"]);
    for (const [kind, name] of Object.entries(TINTS)) expect(name).toBe(`bg-tint-${kind}`);
  });
});

describe("the sticker chip", () => {
  test("[R-WORLD-021] given words and a kind, when the chip draws, then it is a tilted pill with the cut edge in its tint", () => {
    render(
      <StickerChip tint="money" className="extra">
        +Belly
      </StickerChip>,
    );
    const chip = one("[data-sticker-chip]");
    expect(chip.textContent).toBe("+Belly");
    expect(chip.getAttribute("data-tint")).toBe("money");
    expect(chip.className).toContain("sticker-chip");
    expect(chip.className).toContain("bg-tint-money");
    expect(chip.className).toContain("extra");
    expect(chip.style.rotate).toMatch(/^-?\d+deg$/);
  });

  test("[R-WORLD-021] given no kind, when the chip draws, then it is white", () => {
    render(<StickerChip>A morning</StickerChip>);
    expect(one("[data-sticker-chip]").className).toContain("bg-sheet-2");
    expect(one("[data-sticker-chip]").hasAttribute("data-tint")).toBe(false);
  });
});

describe("the pressed action", () => {
  test("[R-WORLD-021] given the one action, when it is pressed, then it is the yellow button with the navy underside and it acts", () => {
    const act = vi.fn();
    render(
      <PressButton onClick={act} className="extra">
        Let's go
      </PressButton>,
    );
    const button = screen.getByRole("button", { name: "Let's go" });
    expect(button.hasAttribute("data-press-button")).toBe(true);
    expect(button.className).toContain("press-button");
    expect(button.className).toContain("extra");
    expect(button.getAttribute("type")).toBe("button");
    fireEvent.click(button);
    expect(act).toHaveBeenCalledTimes(1);
  });

  test("[R-WORLD-021] given a refused action, when it is disabled, then a tap does nothing", () => {
    const act = vi.fn();
    render(
      <PressButton onClick={act} disabled>
        Apply
      </PressButton>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(act).not.toHaveBeenCalled();
  });
});

describe("the pill and the card", () => {
  test("[R-WORLD-021] given words, when the pill draws, then it is white with the navy edge", () => {
    render(<Pill className="extra">5 things</Pill>);
    const pill = one("[data-pill]");
    expect(pill.textContent).toBe("5 things");
    expect(pill.className).toContain("pill");
    expect(pill.className).toContain("extra");
  });

  test("[R-WORLD-021] given content, when the card draws, then it is the white card with the 20 px radius and the edge, and passes its attributes on", () => {
    render(
      <LivelyCard className="extra" data-job="job.developer">
        Junior developer
      </LivelyCard>,
    );
    const card = one("[data-lively-card]");
    expect(card.textContent).toBe("Junior developer");
    expect(card.className).toContain("lively-card");
    expect(card.className).toContain("extra");
    expect(card.getAttribute("data-job")).toBe("job.developer");
  });
});

describe("the sheet", () => {
  test("[R-WORLD-021] given an open sheet, when it draws, then it rises in the sheet colour with its handle, its title and its line, and the handle closes it", () => {
    const change = vi.fn();
    render(
      <LivelySheet open onOpenChange={change} title="Your study table" line="One leg shorter. Still works." picture={<Sticker emoji="📚" alt="Books" />} className="extra">
        <p>Inside</p>
      </LivelySheet>,
    );
    const sheet = one("[data-lively-sheet]");
    expect(sheet.className).toContain("motion-rise");
    expect(sheet.className).toContain("bg-sheet");
    expect(sheet.className).toContain("extra");
    expect(screen.getByRole("dialog", { name: "Your study table" })).toBeTruthy();
    expect(screen.getByText("One leg shorter. Still works.")).toBeTruthy();
    expect(screen.getByText("Inside")).toBeTruthy();
    expect(sheet.querySelector("[data-sticker]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.report.close") }));
    expect(change).toHaveBeenCalledWith(false, expect.anything());
  });

  test("[R-WORLD-021] given a closed sheet, then nothing of it is drawn", () => {
    render(
      <LivelySheet open={false} onOpenChange={() => undefined} title="Hidden">
        <p>Inside</p>
      </LivelySheet>,
    );
    expect(document.querySelector("[data-lively-sheet]")).toBeNull();
  });
});

describe("the face", () => {
  test("[R-WORLD-021] given a person, when the face draws, then it is the name pill with a flat mark carrying the initial, never a picture", () => {
    render(<Face name="Mama" className="extra" />);
    const face = one("[data-face]");
    expect(face.getAttribute("data-face")).toBe("Mama");
    expect(face.className).toContain("extra");
    expect(face.querySelector("img")).toBeNull();
    const mark = one("[data-face-mark]");
    expect(mark.textContent).toBe("M");
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(face.textContent).toBe("MMama");
  });

  test("[R-WORLD-021] given the same name, then the mark's colour is always the same, and a name with an accent keeps its letter", () => {
    expect(faceMark("Ọlá")).toEqual(faceMark("Ọlá"));
    expect(faceMark("Ọlá").initial).toBe("Ọ");
    expect(faceMark("tunde").initial).toBe("T");
    expect(faceMark("").initial).toBe("?");
  });
});

describe("the centred column", () => {
  test("[R-WORLD-021] given anything inside, when the column draws, then it is phone width at most and centred, and takes a className", () => {
    render(
      <CentredColumn className="extra">
        <span>Inside</span>
      </CentredColumn>,
    );
    const column = one("[data-centred-column]");
    expect(COLUMN_PX).toBe(430);
    expect(column.className).toContain("centred-column");
    expect(column.className).toContain("extra");
    expect(column.textContent).toBe("Inside");
  });
});
