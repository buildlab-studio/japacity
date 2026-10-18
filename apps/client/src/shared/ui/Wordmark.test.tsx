// The game's lockup and seal (account:start-screen-over-live-city): drawn files, one for each ground, the seal
// in three drawings for its sizes; plain shapes in the game's own colours, no text and no picture inside them.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { say } from "../words/text";
import { Mark, markFile, Wordmark, wordmarkFile } from "./Wordmark";
// Registers Testing Library's cleanup for this file.
import "../testing/render";

const BRAND = join(import.meta.dirname, "../../../public/brand");
const GROUNDS = ["light", "dark"] as const;
/** The seal's own colours: the navy, the chalk, the warm bulb and the cool bulb, and the white of a highlight, and the band's chalk the dark lockup's letters take. */
const COLOURS = ["#f3efe6", "#1c2a5e", "#eaf3fb", "#f2b705", "#cfe9ff", "#fff", "#ffffff"];
/** Every brand file the page serves, by name: the lockup, and the seal in its three drawings. */
const FILES = ["lockup", "mark", "mark-medium", "mark-small"].flatMap((kind) => GROUNDS.map((ground) => `japacity-${kind}-${ground}.svg`));

describe("the brand's files", () => {
  test("[account:start-screen-over-live-city] given each drawing and each ground, then the file is there, the game's name as its title, in the seal's own colours alone, with no picture, no text and no filter", () => {
    for (const file of FILES) {
      const svg = readFileSync(join(BRAND, file), "utf8");
      expect(svg.startsWith("<svg ")).toBe(true);
      expect(svg).toContain(`<title>${say("ui.game")}</title>`);
      const colours = new Set([...svg.matchAll(/#[0-9a-f]{3,6}\b/gi)].map((found) => found[0].toLowerCase()));
      for (const colour of colours) expect(COLOURS, `${file} uses ${colour}`).toContain(colour);
      expect(svg).not.toMatch(/<image|<text|filter|shadow/i);
    }
  });

  test("[account:start-screen-over-live-city] given the favicon and the icons, then each is served from the root: the favicon as an svg and an ico, the 192, the 512, the maskable and the apple touch icon as pngs, all named by the manifest or the page", () => {
    const root = join(BRAND, "..");
    const png = (file: string) => readFileSync(join(root, file)).subarray(0, 8).toString("hex");
    for (const file of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) expect(png(file)).toBe("89504e470d0a1a0a");
    expect(readFileSync(join(root, "favicon.svg"), "utf8")).toContain(`<title>${say("ui.game")}</title>`);
    expect(readFileSync(join(root, "favicon.ico")).subarray(0, 4).toString("hex")).toBe("00000100");
    const manifest = JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8")) as { name: string; icons: { src: string; sizes: string; purpose: string }[] };
    expect(manifest.name).toBe(say("ui.game"));
    expect(manifest.icons.map((icon) => `${icon.src} ${icon.sizes} ${icon.purpose}`)).toEqual(["/icon-192.png 192x192 any", "/icon-512.png 512x512 any", "/icon-maskable-512.png 512x512 maskable"]);
    const page = readFileSync(join(root, "..", "index.html"), "utf8");
    for (const link of ["/favicon.svg", "/favicon.ico", "/apple-touch-icon.png", "/manifest.webmanifest"]) expect(page).toContain(`href="${link}"`);
  });

  test("[account:start-screen-over-live-city] given a size in pixels, then the seal's drawing is the one that suits it: the small to 48, the medium to 192, the full above", () => {
    expect(markFile("light", 32)).toMatch(/japacity-mark-small-light\.svg$/);
    expect(markFile("dark", 48)).toMatch(/japacity-mark-small-dark\.svg$/);
    expect(markFile("light", 64)).toMatch(/japacity-mark-medium-light\.svg$/);
    expect(markFile("dark", 192)).toMatch(/japacity-mark-medium-dark\.svg$/);
    expect(markFile("light", 256)).toMatch(/japacity-mark-light\.svg$/);
  });
});

describe("the lockup on a screen", () => {
  test("[account:start-screen-over-live-city] given each ground (each paint), then the lockup shows that ground's file, its words the game's name", () => {
    for (const ground of GROUNDS) {
      const { unmount } = render(<Wordmark ground={ground} />);
      const shown = screen.getByRole("img", { name: say("ui.game") });
      expect(shown.getAttribute("src")).toBe(wordmarkFile(ground));
      expect(shown.getAttribute("src")).toMatch(new RegExp(`brand/japacity-lockup-${ground}\\.svg$`));
      expect(shown.getAttribute("alt")).toBe("Japacity");
      expect(shown.getAttribute("data-wordmark")).toBe(ground);
      unmount();
    }
  });

  test("[account:start-screen-over-live-city] given the seal alone at a size, then it shows the drawing for that size, square, its words the game's name", () => {
    render(<Mark ground="dark" px={32} />);
    const shown = screen.getByRole("img", { name: say("ui.game") });
    expect(shown.getAttribute("src")).toBe(markFile("dark", 32));
    expect(shown.getAttribute("width")).toBe("32");
    expect(shown.getAttribute("height")).toBe("32");
  });
});
