import { join } from "node:path";

import { text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { DEFAULT_PORT, doorButton, fanChoice, inside, keptSummary, livesFrom, localCertificate, parseOptions, readKept, shotName } from "./options";

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

  test("given an address, when asked whether its certificate is the local stack's own, then only https on localhost or 127.0.0.1 is", () => {
    expect(localCertificate("https://localhost:8787")).toBe(true);
    expect(localCertificate("https://127.0.0.1:6592")).toBe(true);
    expect(localCertificate("http://localhost:5173")).toBe(false);
    expect(localCertificate("https://japacity.app")).toBe(false);
    expect(localCertificate("https://localhost.japacity.app")).toBe(false);
    expect(localCertificate("not an address")).toBe(false);
  });

  test("given --help, when parsed, then it asks for the usage and nothing else is checked", () => {
    expect(parsed(["--help"])).toEqual({ ok: false, help: true, problem: "" });
  });

  test("given a path, when asked whether it is inside a folder, then a sibling with a shared prefix is not", () => {
    expect(inside("/work/japacity/tools", ROOT)).toBe(true);
    expect(inside("/work/japacity-other/tools", ROOT)).toBe(false);
    expect(inside("/work", ROOT)).toBe(false);
  });
});

describe("the life on the front door", () => {
  test("given the game's words, when the lives are read, then the developer has a tile and a ready life, under the names the door shows", () => {
    const lives = livesFrom(text);
    expect(doorButton(lives, "developer", false)).toEqual({ ok: true, name: text["prologue.archetype.developer.name"] });
    expect(doorButton(lives, "developer", true)).toEqual({ ok: true, name: `Pick: ${text["scenario.developer.kind"] ?? ""}` });
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

describe("the fan button the driver takes", () => {
  const look = { id: "look", kind: "act", enabled: true };
  const racks = { id: "activity.job-fish-racks", kind: "act", enabled: true };

  test("given the racks' Look before their Work the racks and no act named by the nudge, when the driver chooses, then it takes the work, the act that stages an entry", () => {
    expect(fanChoice([look, racks], null)).toBe("activity.job-fish-racks");
  });

  test("given the act the nudge's step opens on the fan and open, when the driver chooses, then it takes that act", () => {
    expect(fanChoice([racks, { id: "activity.job-hunt", kind: "now", enabled: true }], "activity.job-hunt")).toBe("activity.job-hunt");
    expect(fanChoice([look, { id: "activity.job-hunt", kind: "now", enabled: false }], "activity.job-hunt")).toBe("look");
  });

  test("given the nurse's exam carrying on in the plan, shut, with its Stop beside it, when the driver chooses, then it takes nothing: a Stop is never taken", () => {
    expect(fanChoice([{ id: "activity.nurse-certification", kind: "act", enabled: false }, { id: "activity.nurse-certification:stop", kind: "stop", enabled: true }], null)).toBeNull();
  });

  test("given only plain acts, when the driver chooses, then it takes the first open one", () => {
    expect(fanChoice([{ id: "sit", kind: "act", enabled: false }, look], null)).toBe("look");
  });
});

describe("a life kept and resumed", () => {
  const KEPT = "/tmp/plays/kept/developer.json";

  test("given --keep and --resume naming files outside the repository, when parsed, then each is read as an absolute path, a relative one from the folder it is run in", () => {
    expect(parsed(["--out", OUTSIDE, "--keep", KEPT])).toMatchObject({ ok: true, options: { keep: KEPT } });
    expect(parsed(["--out", OUTSIDE, `--resume=${KEPT}`, "--keep", KEPT, "--months", "2"])).toMatchObject({ ok: true, options: { resume: KEPT, keep: KEPT, months: 2 } });
    expect(parsed(["--out", OUTSIDE, "--resume", "kept.json"], "/tmp/plays")).toMatchObject({ ok: true, options: { resume: "/tmp/plays/kept.json" } });
  });

  test("given no --keep, --resume or --stop, when parsed, then none is set", () => {
    const result = parsed(["--out", OUTSIDE]);
    if (!result.ok) throw new Error(result.problem);
    expect([result.options.keep, result.options.resume, result.options.stop]).toEqual([undefined, undefined, undefined]);
  });

  test("given --keep or --resume naming a file inside the repository, relative or absolute, when parsed, then it is refused: the file holds a signed-in session", () => {
    for (const name of ["--keep", "--resume"]) {
      expect(refusal(["--out", OUTSIDE, name, "kept.json"])).toContain(`${name} ${join(ROOT, "kept.json")} is inside the repository`);
      expect(refusal(["--out", OUTSIDE, name, join(ROOT, "tools", "play", "kept.json")])).toContain("inside the repository");
      expect(refusal(["--out", OUTSIDE, name, ROOT])).toContain("inside the repository");
      expect(parsed(["--out", OUTSIDE, name])).toMatchObject({ ok: false, problem: `${name} needs a value.` });
      expect(refusal(["--out", OUTSIDE, `${name}=`])).toBe(`${name} needs a file.`);
    }
    expect(parsed(["--out", OUTSIDE, "--keep", "/work/japacity-other/kept.json"])).toMatchObject({ ok: true });
  });

  test("given --resume with --life or --ready, when parsed, then it is refused: the life is the one kept", () => {
    expect(refusal(["--out", OUTSIDE, "--resume", KEPT, "--life", "nurse"])).toContain("--resume opens the life that was kept");
    expect(refusal(["--out", OUTSIDE, "--resume", KEPT, "--ready"])).toContain("--resume opens the life that was kept");
  });

  test("given --stop, when parsed, then door and planned are read, anything else is refused, and door is refused on a resumed life", () => {
    expect(parsed(["--out", OUTSIDE, "--stop", "door", "--keep", KEPT])).toMatchObject({ ok: true, options: { stop: "door" } });
    expect(parsed(["--out", OUTSIDE, "--stop=planned", "--resume", KEPT])).toMatchObject({ ok: true, options: { stop: "planned" } });
    expect(refusal(["--out", OUTSIDE, "--stop", "bed"])).toBe('--stop takes door or planned, got "bed".');
    expect(refusal(["--out", OUTSIDE, "--stop", "door", "--resume", KEPT])).toContain("a resumed life is past it");
  });

  test("given a kept file, when it is read back, then a browser's storage is taken and anything else is refused", () => {
    expect(readKept("not json")).toEqual({ ok: false, problem: "the kept file is not JSON" });
    expect(readKept(JSON.stringify({ cookies: {} }))).toEqual({ ok: false, problem: "the kept file is not a browser's storage" });
    expect(readKept("null")).toEqual({ ok: false, problem: "the kept file is not a browser's storage" });
    expect(readKept(JSON.stringify({ cookies: [], origins: [] }))).toEqual({ ok: true, kept: { cookies: [], origins: [] } });
  });

  test("given a kept storage, when it is summed up for the log, then only its counts are said, never a name or a value", () => {
    const kept = {
      cookies: [{ name: "session_token", value: "sekret-cookie-value" }],
      origins: [
        { origin: "https://localhost:8787", localStorage: [{ name: "japacity.month", value: "sekret-plan" }, { name: "japacity.walkthrough", value: "1" }] },
        { origin: "http://localhost:5190", localStorage: [] },
      ],
    };
    const summary = keptSummary(kept, "https://localhost:8787");
    expect(summary).toBe("1 cookies, 2 local storage keys for https://localhost:8787");
    for (const secret of ["session_token", "sekret", "japacity.month"]) expect(summary).not.toContain(secret);
    expect(keptSummary(kept, "https://staging.japacity.app")).toBe("1 cookies, 0 local storage keys for https://staging.japacity.app");
  });
});
