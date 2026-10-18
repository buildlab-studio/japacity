// The admin page is its own chunk, fetched only at /admin (moderation:admin-view-for-admin-list):
// the game imports only its address. The size check (tools/check/size.ts) holds the built chunks to the same.
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { ADMIN_PATH, adminAsked } from "./adminPath";

describe("the admin chunk", () => {
  test("[moderation:admin-view-for-admin-list] given the address, then only /admin, with or without a trailing slash, asks for the admin page", () => {
    expect(ADMIN_PATH).toBe("/admin");
    expect(adminAsked("/admin")).toBe(true);
    expect(adminAsked("/admin/")).toBe(true);
    expect(adminAsked("/")).toBe(false);
    expect(adminAsked("/admins")).toBe(false);
    expect(adminAsked("/invite/admin")).toBe(false);
  });

  test("[moderation:admin-view-for-admin-list] given the game's shell, then it loads the admin route lazily and imports nothing else of the admin page", () => {
    const app = readFileSync(join(import.meta.dirname, "..", "..", "app", "App.tsx"), "utf8");
    expect(app).toContain('lazy(() => import("../features/admin/AdminRoute")');
    const adminImports = [...app.matchAll(/^import [^;]* from "(\.\.\/features\/admin\/[^"]+)";/gm)].map((found) => found[1]);
    expect(adminImports).toEqual(["../features/admin/adminPath"]);
  });
});
