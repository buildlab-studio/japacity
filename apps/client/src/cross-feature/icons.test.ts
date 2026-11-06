// Every icon name an act or an ask can carry has its own picture in the phone's icon set (world:one-action-one-sheet): an
// ask's card shows its icon in the corner, and a name the set does not hold would fall back to the settings cog. The
// names are read from the client's own code: each `icon` an ask, a sheet's spec or an app is given, its literal names and
// the named constants it reads. The moments keep their own icon set (shared/moment), so they are not read here.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, test } from "vitest";

import { iconOf } from "../features/phone/PhoneIcon";

const SRC = join(import.meta.dirname, "..");
/** The moments' faces carry names from their own set, drawn by the moment's card. */
const OWN_SET = ["shared/moment/"];
const SOURCE = /\.tsx?$/;
const TEST = /\.(test|testing)\.tsx?$/;

function sourceFiles(directory: string, found: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) sourceFiles(path, found);
    else if (SOURCE.test(entry.name) && !TEST.test(entry.name)) found.push(path);
  }
  return found;
}

/** A string in a place an `icon` can take it: right after `icon: `, or a branch of a conditional (`? "a" : "b"`), never a compared value. */
const BRANCH = /(?:icon:|\?|:)\s*"([a-z][a-z0-9-]*)"/g;
/** A named icon constant (`SCHOOL_ICON = "landmark"`). */
const NAMED = /\b([A-Z][A-Z_]*ICON[A-Z_]*)\s*=\s*"([a-z][a-z0-9-]*)"/g;
/** The phone's apps' icons by app (`ICON: Record<AppId, string>`), one `<app>: "<name>"` a line. */
const APP_ICONS = /const ICON: Record<AppId, string> = \{([^}]*)\}/;

function namesCarried(): Map<string, string[]> {
  const files = sourceFiles(SRC).filter((path) => !OWN_SET.some((own) => relative(SRC, path).startsWith(own)));
  const named = new Map<string, string>();
  for (const path of files) for (const [, name, icon] of readFileSync(path, "utf8").matchAll(NAMED)) if (name !== undefined && icon !== undefined) named.set(name, icon);
  const carried = new Map<string, string[]>();
  const carry = (icon: string, where: string): void => {
    carried.set(icon, [...(carried.get(icon) ?? []), where]);
  };
  for (const path of files) {
    const where = relative(SRC, path);
    const source = readFileSync(path, "utf8");
    for (const line of source.split("\n")) {
      const at = line.search(/\bicon: /);
      if (at < 0) continue;
      // The value up to the property's end, the first comma or brace after `icon: ` (an icon name holds neither).
      const value = line.slice(at).split(/[,}]/)[0] ?? "";
      for (const [, icon] of value.matchAll(BRANCH)) if (icon !== undefined) carry(icon, where);
      for (const [constant, icon] of named) if (new RegExp(`\\b${constant}\\b`).test(value)) carry(icon, where);
    }
    const apps = APP_ICONS.exec(source)?.[1];
    if (apps !== undefined) for (const [, icon] of apps.matchAll(/:\s*"([a-z][a-z0-9-]*)"/g)) if (icon !== undefined) carry(icon, where);
  }
  return carried;
}

describe("the icons acts and asks carry", () => {
  test("[world:one-action-one-sheet] given the client's code, when the icon names its asks, sheets and apps carry are read, then the act card's hand, the bank's landmark and every app's icon are among them", () => {
    const carried = namesCarried();
    expect(["hand", "landmark", "ticket", "settings", "briefcase", "plane"].filter((name) => !carried.has(name))).toEqual([]);
  });

  test("[world:one-action-one-sheet] given every icon name an act or an ask can carry, when its icon is looked up in the phone's set, then each has its own picture and none falls back to the settings cog", () => {
    const missing = [...namesCarried()].filter(([name]) => iconOf(name) === null).map(([name, where]) => `${name}: ${[...new Set(where)].join(", ")}`);
    expect(missing).toEqual([]);
  });
});
