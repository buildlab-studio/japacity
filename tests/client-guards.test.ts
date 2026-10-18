// Two guards on what the site serves and how a page writes itself. React escapes every string it
// renders, so the one way a player's words could become markup is code that sets raw HTML; none may, so a player's
// words can never run as script on another player's page. And the served folder holds only what the page uses.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { filesUnder, REPO_ROOT } from "../tools/repo";

/** The ways a script can turn a string into markup. */
const RAW_HTML = /\bdangerouslySetInnerHTML\b|\.innerHTML\b|\.outerHTML\s*=|\binsertAdjacentHTML\b|\bdocument\.write(?:ln)?\s*\(|\bcreateContextualFragment\b|\bsrcdoc\b/;
const SOURCE = /\.(?:ts|tsx|js|jsx|mjs|html)$/;
/** Tests clear the page between runs with `innerHTML = ""`; they never ship. */
const TEST_FILE = /\.(?:test|spec)\.(?:ts|tsx)$/;

/** Every file under a folder, as paths from the repository's root. */
function filesAt(folder: string): string[] {
  return filesUnder(join(REPO_ROOT, folder)).map((path) => join(folder, path));
}

/** Every line of the shipped sources under `folders` that sets raw HTML, as `path:line`. */
function rawHtmlLines(folders: readonly string[]): string[] {
  return folders.flatMap((folder) =>
    filesAt(folder)
      .filter((path) => SOURCE.test(path) && !TEST_FILE.test(path))
      .flatMap((path) =>
        readFileSync(join(REPO_ROOT, path), "utf8")
          .split("\n")
          .flatMap((line, index) => (RAW_HTML.test(line) ? [`${path}:${String(index + 1)}`] : [])),
      ),
  );
}

describe("what the site serves", () => {
  test("[engine:browser-authority-for-dev-only] given the client's sources, then no file sets raw HTML (dangerouslySetInnerHTML, innerHTML, insertAdjacentHTML and the like)", () => {
    expect(RAW_HTML.test('<div dangerouslySetInnerHTML={{ __html: words }} />')).toBe(true);
    expect(RAW_HTML.test("node.innerHTML = words;")).toBe(true);
    expect(RAW_HTML.test('node.insertAdjacentHTML("beforeend", words);')).toBe(true);
    expect(RAW_HTML.test("node.textContent = words;")).toBe(false);
    expect(rawHtmlLines(["apps/client/src"])).toEqual([]);
  });

  test("[engine:first-download-has-budget] given the client's served folder, then it holds no markdown: notes live beside it, never where the site serves them", () => {
    const served = filesAt("apps/client/public");
    expect(served.length).toBeGreaterThan(0);
    expect(served.filter((path) => /\.(?:md|markdown)$/i.test(path))).toEqual([]);
    expect(filesAt("apps/client/brand")).toContain("apps/client/brand/README.md");
  });
});
