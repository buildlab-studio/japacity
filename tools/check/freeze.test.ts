import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { content, olderContents } from "@japacity/content";
import { checkContent, type Content } from "@japacity/sim";
import { afterEach, describe, expect, test } from "vitest";

import { frozenContent } from "../../packages/content/src/older/frozen";
import { readJson, REPO_ROOT } from "../repo";
import {
  checkFrozen,
  CONTENT_SOURCE,
  contentFingerprint,
  fingerprint,
  freeze,
  type FrozenSeal,
  listedOf,
  OLDER_DIR,
  readFrozen,
  type Seal,
  SEAL_FILE,
  simSources,
} from "./version";

/** A small content in the shape the check reads: a version and plain data, its keys not in order. */
const DATA = { version: "1", tuning: { turn: { refill: 2, cap: 3 } }, route: { "route.b": { fee: 200 }, "route.a": { fee: 100 } } };
const SEALED = { version: "1", fingerprint: "a".repeat(64) };

const folders: string[] = [];

/** A temporary copy of the content's source folder as the freeze touches it: its index.ts, and nothing frozen yet. */
function contentCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "japacity-freeze-"));
  folders.push(dir);
  copyFileSync(join(REPO_ROOT, CONTENT_SOURCE, "index.ts"), join(dir, "index.ts"));
  return dir;
}

/** The copy with `data` frozen in it, as pnpm content:freeze leaves it. */
function frozenCopy(data: { version: string } = DATA): string {
  const dir = contentCopy();
  const result = freeze(dir, data, { ...SEALED, version: data.version }, { ...SEALED, version: data.version });
  if (!result.ok) throw new Error(result.problem);
  return dir;
}

const read = (path: string): string => readFileSync(path, "utf8");

afterEach(() => {
  for (const dir of folders.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("pnpm content:freeze", () => {
  test("[server:older-content-frozen] given the sealed content, when frozen into a copy of the content's source, then the version's folder holds the content as it is and the fingerprint of that content alone, and olderContents lists it", () => {
    const dir = contentCopy();
    const before = read(join(dir, "index.ts"));
    const result = freeze(dir, DATA, SEALED, SEALED);
    if (!result.ok) throw new Error(result.problem);
    const folder = join(dir, OLDER_DIR, "1");
    expect(result.files).toEqual([join(folder, "content.json"), join(folder, "seal.json"), join(dir, "index.ts")]);
    const text = read(join(folder, "content.json"));
    // The content as it is, its keys in the order the simulation walks them, not sorted.
    expect(text).toBe(`${JSON.stringify(DATA)}\n`);
    const seal = readJson<FrozenSeal>(join(folder, "seal.json"));
    expect(seal).toMatchObject({ version: "1", fingerprint: contentFingerprint(DATA) });
    expect(seal.fingerprint).not.toBe(SEALED.fingerprint);
    const index = read(join(dir, "index.ts"));
    expect(index).toContain('import content1 from "./older/1/content.json";');
    expect(index).toContain('import { frozenContent } from "./older/frozen";');
    expect(index).toContain("export const olderContents: readonly Content[] = [frozenContent(content1)];");
    expect(index.split("\n").length).toBe(before.split("\n").length + 2);
    expect(checkFrozen("2", readFrozen(dir), [{ version: "1", fingerprint: contentFingerprint(DATA) }])).toEqual([]);
  });

  test("[server:older-content-frozen] given a second version frozen after the first, when the copy is read, then both are frozen and listed in order", () => {
    const dir = frozenCopy();
    const two = { ...DATA, version: "2", tuning: { turn: { refill: 2, cap: 4 } } };
    const result = freeze(dir, two, { ...SEALED, version: "2" }, { ...SEALED, version: "2" });
    if (!result.ok) throw new Error(result.problem);
    const index = read(join(dir, "index.ts"));
    expect(index).toContain('import content2 from "./older/2/content.json";');
    expect(index.match(/import \{ frozenContent \}/g)).toHaveLength(1);
    expect(index).toContain("export const olderContents: readonly Content[] = [frozenContent(content1), frozenContent(content2)];");
    expect(readFrozen(dir).map((each) => each.version)).toEqual(["1", "2"]);
  });

  test("[server:older-content-frozen] given the content or the simulation changed since the seal, or the version raised and not sealed, when frozen, then it is refused and nothing is written", () => {
    const dir = contentCopy();
    const before = read(join(dir, "index.ts"));
    const moved = freeze(dir, DATA, { ...SEALED, fingerprint: "b".repeat(64) }, SEALED);
    expect(moved.ok ? "" : moved.problem).toContain('not as sealed under "1"');
    const raised = freeze(dir, { ...DATA, version: "2" }, { ...SEALED, version: "2" }, SEALED);
    expect(raised).toMatchObject({ ok: false });
    expect(freeze(dir, DATA, SEALED, null)).toMatchObject({ ok: false });
    expect(existsSync(join(dir, OLDER_DIR))).toBe(false);
    expect(read(join(dir, "index.ts"))).toBe(before);
  });

  test("[server:older-content-frozen] given a version already frozen, when it is frozen again, then it is refused and the frozen copy and the list are left as they were", () => {
    const dir = frozenCopy();
    const index = read(join(dir, "index.ts"));
    const text = read(join(dir, OLDER_DIR, "1", "content.json"));
    const changed = { ...DATA, tuning: { turn: { refill: 2, cap: 9 } } };
    const again = freeze(dir, changed, SEALED, SEALED);
    expect(again.ok ? "" : again.problem).toContain('"1" is already frozen');
    expect(read(join(dir, "index.ts"))).toBe(index);
    expect(read(join(dir, OLDER_DIR, "1", "content.json"))).toBe(text);
  });

  test("[server:older-content-frozen] given an index.ts without the olderContents line in the form the freeze writes, when frozen, then it is refused and nothing is written", () => {
    const dir = contentCopy();
    writeFileSync(join(dir, "index.ts"), 'import type { Content } from "@japacity/sim";\nexport const olderContents: Content[] = [];\n');
    expect(freeze(dir, DATA, SEALED, SEALED)).toMatchObject({ ok: false });
    expect(existsSync(join(dir, OLDER_DIR))).toBe(false);
  });
});

describe("pnpm check:version, the frozen versions", () => {
  const listed = [{ version: "1", fingerprint: contentFingerprint(DATA) }];

  test("[server:older-content-frozen] given version 2 and version 1 frozen and listed, when checked, then it passes; given version 1 and nothing frozen, then it passes", () => {
    expect(checkFrozen("2", readFrozen(frozenCopy()), listed)).toEqual([]);
    expect(checkFrozen("1", readFrozen(contentCopy()), [])).toEqual([]);
  });

  test("[server:older-content-frozen] given a version below the current one not frozen, when checked, then it fails and says how to freeze it", () => {
    const problems = checkFrozen("3", readFrozen(frozenCopy()), listed);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('Content version "2" is below the current "3" and is not frozen');
    expect(problems[0]).toContain("pnpm content:freeze");
  });

  test("[server:older-content-frozen] given a frozen version not listed in olderContents, or a listed one that is not frozen or not the frozen content, when checked, then it fails and says to list the frozen copy", () => {
    const dir = frozenCopy();
    const unlisted = checkFrozen("2", readFrozen(dir), []);
    expect(unlisted).toHaveLength(1);
    expect(unlisted[0]).toContain('The frozen content "1" is not listed in `olderContents`');
    const other = checkFrozen("2", readFrozen(dir), [{ version: "1", fingerprint: contentFingerprint({ ...DATA, tuning: {} }) }]);
    expect(other).toHaveLength(1);
    expect(other[0]).toContain('`olderContents` lists a content "1" other than the frozen one');
    const twice = checkFrozen("2", readFrozen(dir), [...listed, ...listed]);
    expect(twice).toEqual(['`olderContents` lists the content "1" more than once. List each frozen version once.']);
    const notFrozen = checkFrozen("3", readFrozen(dir), [...listed, { version: "4", fingerprint: contentFingerprint(DATA) }]);
    expect(notFrozen).toEqual(expect.arrayContaining([expect.stringContaining('`olderContents` lists a content "4" that is not frozen')]));
  });

  test("[server:older-content-frozen] given a frozen version's content edited, reordered or its fingerprint changed, when checked, then it fails and says to restore it from git", () => {
    const edited = frozenCopy();
    const file = join(edited, OLDER_DIR, "1", "content.json");
    writeFileSync(file, read(file).replace('"cap":3', '"cap":4'));
    const reordered = frozenCopy();
    writeFileSync(join(reordered, OLDER_DIR, "1", "content.json"), `${JSON.stringify({ version: "1", route: DATA.route, tuning: DATA.tuning })}\n`);
    const resealed = frozenCopy();
    const sealFile = join(resealed, OLDER_DIR, "1", "seal.json");
    writeFileSync(sealFile, JSON.stringify({ ...readJson<FrozenSeal>(sealFile), fingerprint: "c".repeat(64) }));
    const missing = frozenCopy();
    rmSync(join(missing, OLDER_DIR, "1", "seal.json"));
    for (const dir of [edited, reordered, resealed, missing]) {
      const problems = checkFrozen("2", readFrozen(dir), listed);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('The frozen content "1"');
      expect(problems[0]).toContain("restore it from git");
    }
  });

  test("[server:older-content-frozen] given a frozen version at or above the current one, when checked, then it fails and says to raise the version", () => {
    const at = checkFrozen("1", readFrozen(frozenCopy()), listed);
    expect(at).toHaveLength(1);
    expect(at[0]).toContain('The frozen content "1" is not below the current version "1"');
    expect(at[0]).toContain("Raise `version`");
    const above = checkFrozen("2", readFrozen(frozenCopy({ ...DATA, version: "3" })), [{ version: "3", fingerprint: contentFingerprint(DATA) }]);
    expect(above).toEqual(expect.arrayContaining([expect.stringContaining('The frozen content "3" is not below the current version "2"')]));
  });

  test("[server:older-content-frozen] given a folder in older that is not a version, when checked, then it fails", () => {
    const dir = frozenCopy();
    mkdirSync(join(dir, OLDER_DIR, "one"));
    expect(checkFrozen("2", readFrozen(dir), listed)).toEqual([`${CONTENT_SOURCE}/${OLDER_DIR}/one is not named for a content version (a whole number from 1). Remove it.`]);
  });

  test("[server:older-content-frozen] given the repository as it is, when checked, then every version below the current one is frozen and listed, and every frozen one matches its fingerprint", () => {
    expect(checkFrozen(content.version, readFrozen(join(REPO_ROOT, CONTENT_SOURCE)), listedOf(olderContents))).toEqual([]);
  });

  test("[server:older-content-frozen] given today's sealed content, when frozen into a copy and loaded, then it is the live content: equal, its keys in the same order, and a content the engine accepts", () => {
    const seal = readJson<Seal>(join(REPO_ROOT, SEAL_FILE));
    const now = { version: content.version, fingerprint: fingerprint(content, simSources()) };
    const dir = contentCopy();
    const result = freeze(dir, content, now, seal);
    if (!result.ok) throw new Error(result.problem);
    const loaded: Content = frozenContent(JSON.parse(read(join(dir, OLDER_DIR, content.version, "content.json"))) as unknown);
    expect(loaded).toStrictEqual(content);
    expect(JSON.stringify(loaded)).toBe(JSON.stringify(content));
    expect(contentFingerprint(loaded)).toBe(contentFingerprint(content));
    expect(checkContent(loaded)).toEqual([]);
    expect(checkFrozen(String(Number(content.version) + 1), readFrozen(dir), listedOf([loaded]))).toEqual([]);
  });
});
