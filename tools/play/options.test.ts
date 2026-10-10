import { join } from "node:path";

import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { DEFAULT_PORT, doorButton, inside, livesFrom, parseOptions, shotName } from "./options";

const ROOT = "/work/japacity";
const OUTSIDE = "/tmp/plays/one";

function parsed(argv: string[], cwd = ROOT) {
  return parseOptions(argv, cwd, ROOT);
}

/** The problem a refused command line names, or "accepted". */
function refusal(argv: string[], cwd = ROOT): string {
  const result = parsed(argv, cwd);
  return result.ok ? "accepted" : result.problem;
}

describe("the play driver's options", () => {
  test("given only --out, when parsed, then the developer's tile is played for three months on the default port", () => {
    expect(parsed(["--out", OUTSIDE])).toEqual({
      ok: true,
      options: { life: "developer", ready: false, months: 3, out: OUTSIDE, url: null, port: DEFAULT_PORT, played: false, headed: false },
    });
  });

  test("given every option, when parsed, then each is read, in both spellings", () => {
    const result = parsed(["--", "--life=Nurse", "--ready", "--months", "12", `--out=${OUTSIDE}`, "--url", "http://localhost:5182/x", "--played", "--headed"]);
    expect(result).toEqual({
      ok: true,
      options: { life: "nurse", ready: true, months: 12, out: OUTSIDE, url: "http://localhost:5182", port: DEFAULT_PORT, played: true, headed: true },
    });
  });

  test("given no --out, when parsed, then it is refused", () => {
    expect(refusal(["--life", "developer"])).toContain("--out is required");
  });

  test("given an --out inside the repository, relative or absolute, when parsed, then it is refused", () => {
    expect(refusal(["--out", "shots"])).toContain("inside the repository");
    expect(refusal(["--out", join(ROOT, "docs", "shots")])).toContain("inside the repository");
    expect(parsed(["--out", ROOT])).toMatchObject({ ok: false });
  });

  test("given a relative --out from a folder outside the repository, when parsed, then it resolves there", () => {
    expect(parsed(["--out", "shots"], "/tmp")).toMatchObject({ ok: true, options: { out: "/tmp/shots" } });
  });

  test("given months or a port out of range or not whole, when parsed, then each is refused", () => {
    for (const months of ["0", "61", "2.5", "three"]) expect(refusal(["--out", OUTSIDE, "--months", months])).toContain("--months");
    expect(parsed(["--out", OUTSIDE, "--months", "60"])).toMatchObject({ ok: true, options: { months: 60 } });
    expect(refusal(["--out", OUTSIDE, "--port", "80"])).toContain("--port");
  });

  test("given an unknown argument, a flag missing its value, both --url and --port, or a bad address, when parsed, then each is refused", () => {
    expect(refusal(["--out", OUTSIDE, "--fast"])).toContain("Unknown argument");
    expect(parsed(["--out", OUTSIDE, "--life"])).toMatchObject({ ok: false, problem: "--life needs a value." });
    expect(parsed(["--out", "--months", "3"])).toMatchObject({ ok: false, problem: "--out needs a value." });
    expect(refusal(["--out", OUTSIDE, "--url", "http://localhost:1", "--port", "5182"])).toContain("not both");
    expect(refusal(["--out", OUTSIDE, "--url", "file:///etc"])).toContain("http address");
    expect(parsed(["--out", OUTSIDE, "--ready=yes"])).toMatchObject({ ok: false, problem: "--ready takes no value." });
  });

  test("given --help, when parsed, then it asks for the usage and nothing else is checked", () => {
    expect(parsed(["--help"])).toEqual({ ok: false, help: true, problem: "" });
  });

  test("given a path, when asked whether it is inside a folder, then a sibling with a shared prefix is not", () => {
    expect(inside("/work/japacity/tools", ROOT)).toBe(true);
    expect(inside("/work/japacity-wt/m36", ROOT)).toBe(false);
    expect(inside("/work", ROOT)).toBe(false);
  });
});

describe("the life on the front door", () => {
  test("given the game's words, when the lives are read, then the developer has a tile and a ready life, under the names the door shows", () => {
    const lives = livesFrom(text);
    expect(doorButton(lives, "developer", false)).toEqual({ ok: true, name: text["prologue.archetype.developer.name"] });
    expect(doorButton(lives, "developer", true)).toEqual({ ok: true, name: `Pick: ${text["scenario.zainab.kind"] ?? ""}` });
  });

  test("given a short name with no life, when looked up, then the known names are listed", () => {
    const lives = livesFrom({ "prologue.archetype.nurse.name": "The nurse", "prologue.archetype.shop-worker.name": "The shop worker", "scenario.x.kind": "The shop worker" });
    expect(doorButton(lives, "shop-worker", true)).toEqual({ ok: true, name: "Pick: The shop worker" });
    expect(doorButton(lives, "pilot", false)).toEqual({ ok: false, problem: 'No archetype called "pilot". Known: nurse, shop-worker.' });
  });
});

describe("the pictures' names", () => {
  test("given a count and a step, when named, then the count leads with two digits and the step is lower case with dashes", () => {
    expect(shotName(1, "Front door")).toBe("01-front-door.png");
    expect(shotName(12, "Month 3: the results!")).toBe("12-month-3-the-results.png");
    expect(shotName(105, "phone Bank")).toBe("105-phone-bank.png");
  });

  test("given a step with no letters or a long one, when named, then the name is still a safe, short file name", () => {
    expect(shotName(3, "!!!")).toBe("03-shot.png");
    const long = shotName(4, "a ".repeat(80));
    expect(long.length).toBeLessThanOrEqual("04-".length + 48 + ".png".length);
    expect(long).toMatch(/^04-[a-z0-9-]+[a-z0-9]\.png$/);
  });
});
