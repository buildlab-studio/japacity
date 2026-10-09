// Words that read wrong in play, checked on the lines the real engine tells: a status with its article, the landing with
// the country's own name, a chapter closed with no turns, the toast for an act planned, and the
// market's aunty saying a thing that fits a woman or a man.
import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { recordedGame, recordedSave } from "../testing/fixtures";
import { nameOf, say, words } from "./text";

/** The lines Ada's recorded life tells when she boards the plane, the last command it holds. */
function flightLines() {
  const game = recordedGame("ada-careful", 1);
  const last = recordedSave("ada-careful").commands.at(-1);
  if (last === undefined) throw new Error("The recorded life holds no commands.");
  const reply = game.accept(last.command, last.sender);
  return reply.lines;
}

describe("words that fit", () => {
  test("[R-WORLD-008] given Ada's flight, when the status granted and the landing are told, then the status reads as its own name after a colon and the country takes no bare article", () => {
    const lines = flightLines();
    const granted = lines.find((line) => line.key === "line.status.granted");
    const arrived = lines.find((line) => line.key === "line.place.arrived");
    const { status: held } = granted?.params ?? {};
    const { country } = arrived?.params ?? {};
    if (granted === undefined || arrived === undefined || typeof held !== "string" || typeof country !== "string") throw new Error("The flight told no status or no landing.");
    const status = words(granted.key, granted.params);
    expect(status).toContain(nameOf(held));
    expect(status).not.toMatch(/You hold [a-z]/);
    const landing = words(arrived.key, arrived.params);
    expect(landing).toContain(nameOf(country));
    expect(landing).not.toMatch(/\bin United\b/);
  });

  test("[R-WORLD-002] given a chapter closed, when its line is read, then it names the chapter and says nothing of turns", () => {
    const said = words("line.chapter.closed", { chapter: "chapter.find-your-feet" });
    expect(said).toContain(nameOf("chapter.find-your-feet"));
    expect(said).not.toMatch(/turn/i);
  });

  test("[R-WORLD-006] given an act planned from its sheet, when the toast says so, then it is the act's name and planned", () => {
    expect(say("ui.world.planned", { what: nameOf("activity.job-hunt") })).toBe(`${nameOf("activity.job-hunt")}: planned.`);
  });

  test("[R-STREET-009] given the market behind the station, when its aunty speaks, then her words fit a woman or a man, since nothing but the bridge's night reads the character's sex", () => {
    const body = text["offer.street-find-uk.body"] ?? "";
    expect(body).not.toMatch(/\b(son|daughter|boy|girl|nephew|niece)\b/i);
  });
});
