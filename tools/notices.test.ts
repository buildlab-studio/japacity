import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { CLIENT_ROOT, NOTICES_PATH, noticesFile, shippedPackages } from "./notices";
import { REPO_ROOT } from "./repo";

describe("the repository's account of the makers and the shipped code", () => {
  test("[R-GUIDE-008] given the client's dependencies, when NOTICES.md is read, then it is what pnpm notices writes from them, so it is never stale", () => {
    const packages = shippedPackages(CLIENT_ROOT);
    expect(readFileSync(NOTICES_PATH, "utf8")).toBe(noticesFile(packages));
    const names = packages.map((shipped) => shipped.name);
    expect(names).toContain("react");
    expect(names.filter((name) => name.startsWith("@japacity/") || name.includes("vite"))).toEqual([]);
    expect(noticesFile(packages)).toMatch(/\| react \| 19\.3\.\d+ \| MIT \|/);
    // A dependency added, dropped or moved to another version changes the file, so the test above fails until it is written again.
    expect(noticesFile([...packages, { name: "a-new-package", version: "1.0.0", license: "MIT" }])).not.toBe(noticesFile(packages));
    expect(noticesFile(packages.slice(1))).not.toBe(noticesFile(packages));
  });

  test("[R-GUIDE-008] given the repository, when its licence files are read, then LICENSE names the makers and LICENSES.md points to the notices", () => {
    const holders = /^Copyright \(c\) \d{4} (.+)$/m.exec(readFileSync(join(REPO_ROOT, "LICENSE"), "utf8"))?.[1];
    expect(holders).toMatch(/\S and Japacity contributors$/);
    expect(readFileSync(join(REPO_ROOT, "LICENSES.md"), "utf8")).toContain("[NOTICES.md](NOTICES.md)");
  });
});
