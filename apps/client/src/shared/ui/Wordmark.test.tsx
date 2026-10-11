// The game's wordmark and mark (account.md R-ACCOUNT-029): drawn by hand, one file for each look
// and each ground, plain shapes in at most two colours of the looks' own, no gradient and no shadow.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { setTheme } from "../world/theme";
import { say } from "../words/text";
import { Wordmark, wordmarkFile } from "./Wordmark";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const BRAND = join(import.meta.dirname, "../../../public/brand");
const LOOKS = ["adire", "danfo"] as const;
const GROUNDS = ["light", "dark"] as const;
/** The looks' own colours (index.css): the danfo yellow both share, and each look's ink. */
const YELLOW = "#f2b705";
const INK = { adire: "#1c2a5e", danfo: "#17140f" } as const;

afterEach(() => {
  setTheme("adire", document.documentElement, null);
});

describe("the wordmark's files", () => {
  test("[R-ACCOUNT-029] given each look and each ground, then the mark and the wordmark are there, the game's name as their title, in the danfo yellow and the look's ink alone, with no gradient, filter, shadow, picture or text", () => {
    for (const look of LOOKS) {
      for (const ground of GROUNDS) {
        for (const kind of ["mark", "wordmark"]) {
          const svg = readFileSync(join(BRAND, `japacity-${kind}-${look}-${ground}.svg`), "utf8");
          expect(svg.startsWith("<svg ")).toBe(true);
          expect(svg).toContain(`<title>${say("ui.game")}</title>`);
          const colours = new Set([...svg.matchAll(/#[0-9a-f]{6}\b/gi)].map((found) => found[0].toLowerCase()));
          expect([...colours].sort()).toEqual([YELLOW, INK[look]].sort());
          expect(svg).not.toMatch(/gradient|filter|shadow|opacity|<image|<text|url\(/i);
        }
      }
    }
  });
});

describe("the wordmark on a screen", () => {
  test("[R-ACCOUNT-029] given each look, then the wordmark shows the file for that look and its ground, its words the game's name", () => {
    const { unmount } = render(<Wordmark ground="light" />);
    expect(screen.getByRole("img", { name: say("ui.game") }).getAttribute("src")).toBe(wordmarkFile("adire", "light"));
    unmount();
    setTheme("danfo", document.documentElement, null);
    render(<Wordmark ground="dark" />);
    const shown = screen.getByRole("img", { name: say("ui.game") });
    expect(shown.getAttribute("src")).toBe(wordmarkFile("danfo", "dark"));
    expect(shown.getAttribute("src")).toMatch(/brand\/japacity-wordmark-danfo-dark\.svg$/);
    expect(shown.getAttribute("alt")).toBe("Japacity");
  });
});
