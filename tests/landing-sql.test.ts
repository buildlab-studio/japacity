import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, test } from "vitest";

const FILES = ["index.ts", "join.ts", "page.ts"].map((name) => fileURLToPath(new URL(`../apps/landing/src/${name}`, import.meta.url)));

describe("the holding page's reach into its table", () => {
  test("given the Worker's source, when its SQL is read, then the only statement inserts, and nothing selects, updates, deletes or drops", () => {
    const source = FILES.map((file) => readFileSync(file, "utf8")).join("\n");
    const statements = source.match(/"(INSERT|SELECT|DELETE|UPDATE|DROP)[^"]*"/g) ?? [];
    expect(statements).toEqual(['"INSERT OR IGNORE INTO waitlist (email, joined_at) VALUES (?1, ?2)"']);
    expect(source).not.toMatch(/SELECT|DELETE|UPDATE|DROP/);
  });
});
