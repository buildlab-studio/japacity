import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "vitest";

import { ALLOWED, enforcedTags, findProcessTags, findTellTales, PROCESS_ALLOWED, PROCESS_TAGS, type ProcessTag, scrubTree, TELL_TALES } from "./scrub";

const made: string[] = [];

afterEach(() => {
  for (const folder of made.splice(0)) rmSync(folder, { recursive: true, force: true });
});

function repository(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "scrub-check-"));
  made.push(root);
  execFileSync("git", ["init", "-q"], { cwd: root });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("the scrub check", () => {
  test("given a planted line for each tell-tale, when a docs page is checked, then every one is caught on its line", () => {
    for (const tale of TELL_TALES) {
      const hits = findTellTales("docs/rules/somewhere.md", `# A page\n\n${tale.example}\n`);
      expect(hits.map((hit) => hit.label)).toContain(tale.label);
      expect(hits.every((hit) => hit.line === 3)).toBe(true);
    }
  });

  test("given ordinary game words, when they are checked, then nothing is caught", () => {
    const words = "The visa centre refuses. A favicon.ico sits beside the page. The officer asks about the lottery and the rules.";
    expect(findTellTales("packages/content/src/news/news.text.ts", words)).toEqual([]);
  });

  test("given the two player pages, the test that reads them and LICENSES.md, when they carry the words, then they are allowed", () => {
    const planted = TELL_TALES.map((tale) => tale.example).join("\n");
    for (const file of ALLOWED) expect(findTellTales(file, planted)).toEqual([]);
    expect(ALLOWED).toContain("apps/client/src/features/legal/terms.html");
    expect(ALLOWED).toContain("apps/client/src/features/legal/privacy.html");
    expect(ALLOWED).toContain("apps/client/src/features/legal/legal.test.ts");
    expect(ALLOWED).toContain("LICENSES.md");
  });

  test("given a binary file, when it is checked, then it is passed over", () => {
    const sample = TELL_TALES[0]?.example ?? "";
    expect(findTellTales("assets-src/model.glb", `\u0000${sample}`)).toEqual([]);
  });

  test("given a repository with a planted line, an ignored file and a player page, when the tree is scrubbed, then only the planted line fails", () => {
    const sample = TELL_TALES[0]?.example ?? "";
    const root = repository({
      ".gitignore": "notes/\n",
      "docs/planted.md": `Fine.\n${sample}\n`,
      "notes/local.md": sample,
      "apps/client/src/features/legal/privacy.html": sample,
      "README.md": "A game.",
    });
    const hits = scrubTree(root);
    expect(hits.map((hit) => `${hit.file}:${String(hit.line)}`)).toEqual(["docs/planted.md:2"]);
  });
});

describe("the scrub check's process tags", () => {
  test("given a planted line for each process tag, enforced or not, when a file is checked against every tag, then each is caught on its line", () => {
    for (const each of PROCESS_TAGS) {
      const hits = findProcessTags("packages/sim/src/somewhere.ts", `const a = 1;\n\n${each.example}\n`, PROCESS_TAGS);
      expect(hits.map((hit) => hit.label)).toContain(each.label);
      expect(hits.every((hit) => hit.line === 3 && hit.kind === "process")).toBe(true);
    }
  });

  test("given the game's own words, an SVG path and a tag word inside a string, when they are checked against every tag, then nothing is caught", () => {
    const words = [
      "The lead applicant's visa ends, and the dependant's with it.",
      "The brief's mission card. The invite's milestone. A wave of refusals. The wave emote.",
      "The a branch split of the map. A a branch corner.",
      '<path d="m12 5 7 7-7 7" />',
      `log(\`${["QUESTION", " pairs are planned."].join(":")}\`);`,
      "The content version m0.4 is stored with every saved life.",
      "The officer's second review of the file. The market's catalogue. Measured on an Apple M3 Max. the decision to the officer.",
    ].join("\n");
    expect(findProcessTags("packages/content/src/news/news.text.ts", words, PROCESS_TAGS)).toEqual([]);
  });

  test("given a tag that is not enforced, when the enforced tags are taken, then it is left out and a file is not checked for it", () => {
    const [first] = PROCESS_TAGS;
    if (first === undefined) throw new Error("No process tags.");
    const held: ProcessTag = { ...first, enforced: false };
    expect(enforcedTags([held, ...PROCESS_TAGS.slice(1)])).toEqual(PROCESS_TAGS.slice(1));
    expect(findProcessTags("docs/rules/somewhere.md", held.example, enforcedTags([held]))).toEqual([]);
    expect(findProcessTags("docs/rules/somewhere.md", held.example)).toHaveLength(1);
  });

  test("given the list itself, when it carries every tag, then it is allowed", () => {
    expect([...PROCESS_ALLOWED]).toEqual(["tools/check/scrub.ts"]);
    expect(findProcessTags("tools/check/scrub.ts", PROCESS_TAGS.map((each) => each.example).join("\n"), PROCESS_TAGS)).toEqual([]);
  });

  test("given a repository with an enforced tag planted in a code file, when the tree is scrubbed, then the line fails as a process tag", () => {
    const planted = PROCESS_TAGS.find((each) => each.enforced)?.example ?? "";
    const root = repository({ "tools/planted.ts": `// Fine.\n// ${planted}\n`, "README.md": "A game." });
    expect(scrubTree(root).map((hit) => `${hit.file}:${String(hit.line)} ${hit.kind}`)).toEqual(["tools/planted.ts:2 process"]);
  });
});
