import { readFileSync } from "node:fs";
import { join } from "node:path";

import { content, text } from "@japacity/content";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import hubFile from "../../../public/assets/places/ojuelegba/place.json";
import { engineView, richView } from "../../shared/testing/fixtures";
import { renderWithView } from "../../shared/testing/render";
import { assetUrl, PUBLISHED, type PublishManifest } from "../../shared/three/manifest";
import { City } from "./City";
import { cityWords } from "./city.words";
import { CreditsList, type CreditsFile } from "./Credits";
import { localDate, poolOf, sampleCrowd } from "./crowd";
import { filesOf, type PlaceFile } from "./placeFile";

const PUBLIC = join(import.meta.dirname, "..", "..", "..", "public");
const manifest = JSON.parse(readFileSync(join(PUBLIC, "assets", "manifest.json"), "utf8")) as PublishManifest;
/** Content's words for a key, failing the test when content has none. */
function said(key: string): string {
  const words = text[key];
  if (words === undefined) throw new Error(`No words for ${key}`);
  return words;
}

const credits = JSON.parse(readFileSync(join(PUBLIC, "assets", "credits.json"), "utf8")) as CreditsFile;

describe("the city reads the view and never changes it", () => {
  test("[R-CITY-001] given the city in front of the panels, when the player opens the menu and enters another place, then no command is sent", async () => {
    const { authority } = await renderWithView(<City />, engineView());
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.look") }));
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.menu") }));
    const list = screen.getByRole("list", { name: cityWords("city.places") });
    fireEvent.click(within(list).getByRole("button", { name: said("place.bode-thomas.name") }));
    expect(screen.getByRole("heading", { name: said("place.bode-thomas.name") })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.back") }));
    expect(authority.sent).toEqual([]);
  });

  test("[R-CITY-024] given a new life, when the city is looked at, then the hub's name is content's words for it", async () => {
    await renderWithView(<City />, engineView());
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.look") }));
    expect(screen.getByRole("heading", { name: said("place.ojuelegba.name") })).toBeDefined();
    expect(text["place.ojuelegba.name"]).toBe(content.place["place.ojuelegba"]?.realName);
  });

  test("[R-CITY-011] given a set piece open, when the old page's city is looked at, then it shows the place that stages it with the question, and the answers stay in the month", async () => {
    await renderWithView(<City />, richView());
    fireEvent.click(screen.getByRole("button", { name: cityWords("city.look") }));
    expect(screen.getByRole("heading", { name: said("place.visa-centre.name") })).toBeDefined();
    expect(screen.getByText(said("setpiece.credibility-interview.q.who-pays"))).toBeDefined();
    expect(screen.queryByRole("button", { name: new RegExp(said("setpiece.credibility-interview.a.who-pays.own")) })).toBeNull();
    expect(screen.getByRole("button", { name: cityWords("city.scene.answer") })).toBeDefined();
  });
});

describe("loading", () => {
  test("[R-CITY-018] given the hub's file and today's sample, when the first download is planned, then it holds only the hub's own files and shared ones", () => {
    const hub = content.place["place.ojuelegba"];
    if (hub === undefined) throw new Error("The hub is missing");
    const file = hubFile as unknown as PlaceFile;
    const sample = sampleCrowd(hub, poolOf(file.people.sample), localDate(new Date(2026, 9, 8)), "high", content.tuning.city);
    const files = filesOf(file, sample.people.map((shown) => shown.person.file));
    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((path) => !path.startsWith("places/ojuelegba/") && !path.startsWith("shared/"))).toEqual([]);
  });

  test("[R-CITY-018] given the published manifest, when a shipped file's address is asked for, then it is the hashed name beside the file under public/assets, and an unshipped one has none", () => {
    const url = assetUrl(manifest, "places/ojuelegba/place.json");
    expect(url).toMatch(new RegExp(`^${PUBLISHED}places/ojuelegba/place\\.[0-9a-f]{12}\\.json$`));
    expect(assetUrl(manifest, "places/nowhere/place.json")).toBeNull();
  });
});

describe("credits", () => {
  test("[R-CITY-021] given credits.json, when the credits screen shows, then the map data line links OpenStreetMap to its copyright page, with the fonts and the generated media", () => {
    render(<CreditsList credits={credits} />);
    expect(screen.getByRole("link", { name: "OpenStreetMap" }).getAttribute("href")).toBe("https://www.openstreetmap.org/copyright");
    expect(screen.getByText(/available under the Open Database Licence/)).toBeDefined();
    for (const font of credits.fonts) expect(screen.getByText(font.attribution)).toBeDefined();
    expect(screen.getByText(credits.generated)).toBeDefined();
  });
});
