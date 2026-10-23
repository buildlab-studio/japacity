// The account sheet and the dedication page, with their words, ride chunks of their own (engine:first-download-has-budget;
// account:username-and-unconfirmed-email, account:player-deletes-account, account:dedication-page-and-its-doors): no module of the game imports
// their tables but the loader, by a dynamic import, nor the sheet but its row, by a dynamic import; and the row opens the sheet only once both
// are in, so no key or empty line ever shows.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { uiAccountSheetText } from "@japacity/content/ui/account-sheet";
import { uiDedicationText } from "@japacity/content/ui/dedication";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import { forgetDedication, setDedicationServer } from "../../shared/dedication/lights";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import type { Api } from "../../shared/net/http";
import { accountView, engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { hasWords, say, words } from "../../shared/words/text";
import { AccountButton } from "./AccountButton";
import { DedicationLater } from "./DedicationLater";
import { loadLaterWords } from "../../shared/words/later";

/** The client's source folder. */
const SRC = join(import.meta.dirname, "..", "..");
/** Content's entry, which a first visit loads: it never names the later tables. */
const CONTENT_INDEX = join(SRC, "..", "..", "..", "packages", "content", "src", "index.ts");
const SHEET = join(SRC, "features", "account", "Settings");

/** Every module under a folder, the tests left out. */
function sources(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.(test|testing)\.tsx?$/.test(name) ? [path] : [];
  });
}

/** A key of any table, as a line on screen would show it when its words are missing. */
const KEY = /\bui\.[a-z-]+\.[a-z-]+/;

/** A line of a table, or a throw when the table has no such key. */
function lineOf(table: Readonly<Record<string, string>>, key: string): string {
  const line = table[key];
  if (line === undefined) throw new Error(`No line for ${key}.`);
  return line;
}

const OK: AuthResult = { ok: true };

function fakeAccount(): AccountApi {
  const view = accountView();
  return {
    ageStatus: () => Promise.resolve("passed"),
    declareAge: () => Promise.resolve("passed"),
    usernameFree: () => Promise.resolve(null),
    startGuest: () => Promise.resolve({ ok: true }),
    view: () => Promise.resolve(view),
    rename: () => Promise.resolve({ ok: true }),
    sendCode: () => Promise.resolve(OK),
    signInWithCode: () => Promise.resolve(OK),
    signInWithGoogle: () => Promise.resolve(OK),
    returnedFromGoogle: () => null,
    signInWithPasskey: () => Promise.resolve(OK),
    addPasskey: () => Promise.resolve(OK),
    email: () => Promise.resolve(null),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    deleteAccount: () => Promise.resolve(OK),
    signOut: () => Promise.resolve(OK),
    signOutEverywhere: () => Promise.resolve(OK),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: () => Promise.resolve({ ok: true, signedIn: true }),
    confirmWithPasskey: () => Promise.resolve(OK),
  };
}

describe("the account sheet's words, which a first visit does not carry", () => {
  test("[engine:first-download-has-budget] [account:username-and-unconfirmed-email] [account:dedication-page-and-its-doors] given the sheet's and the dedication's words and the sheet's code, when the game's modules are read, then only the loader names the tables and only the row names the sheet, each by a dynamic import", () => {
    const files = sources(SRC);
    const loader = readFileSync(join(SRC, "shared", "words", "later.ts"), "utf8");
    for (const [table, file] of [["account-sheet", "ui.accountSheet.text"], ["dedication", "ui.dedication.text"]] as const) {
      const naming = files.filter((path) => readFileSync(path, "utf8").includes(`@japacity/content/ui/${table}`));
      expect(naming.map((path) => path.slice(SRC.length + 1))).toEqual(["shared/words/later.ts"]);
      expect(loader).toContain(`import("@japacity/content/ui/${table}")`);
      expect(readFileSync(CONTENT_INDEX, "utf8")).not.toContain(file);
    }
    const importing = files.filter((path) => [...readFileSync(path, "utf8").matchAll(/\bfrom "(\.[^"]+)"/g)].some(([, spec]) => resolve(dirname(path), spec ?? "") === SHEET));
    expect(importing.map((path) => path.slice(SRC.length + 1))).toEqual([]);
    expect(readFileSync(join(SRC, "features", "account", "AccountButton.tsx"), "utf8")).toContain('import("./Settings")');
  });

  test("[engine:first-download-has-budget] [account:player-deletes-account] given the account's row, when it is tapped before the sheet's words are in, then the sheet opens only once they are, and no key shows at any moment", async () => {
    expect(hasWords("ui.account.delete")).toBe(false);
    expect(words("ui.account.delete")).toBe("ui.account.delete");
    const account = fakeAccount();
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    await store.getState().refresh();
    store.setState({ earlyWin: false, moments: [], reportOpen: false });
    const shown: string[] = [];
    const watch = new MutationObserver(() => shown.push(document.body.textContent));
    watch.observe(document.body, { childList: true, subtree: true, characterData: true });
    render(
      <GameProvider store={store}>
        <AccountButton />
      </GameProvider>,
    );
    const row = document.querySelector("[data-account-row]");
    if (row === null) throw new Error("The account's row is missing.");
    fireEvent.click(row);
    // Tapped before the words are in: nothing opens yet.
    expect(hasWords("ui.account.delete")).toBe(false);
    expect(screen.queryByRole("dialog")).toBeNull();
    const sheet = await screen.findByRole("dialog", { name: say("ui.account.settings") });
    expect(hasWords("ui.account.delete")).toBe(true);
    expect(within(sheet).getByRole("button", { name: lineOf(uiAccountSheetText, "ui.account.delete") })).toBeDefined();
    expect(within(sheet).getByRole("button", { name: lineOf(uiAccountSheetText, "ui.account.sign-out") })).toBeDefined();
    shown.push(document.body.textContent);
    watch.disconnect();
    expect(shown.filter((text) => KEY.test(text))).toEqual([]);
  });

  test("[engine:first-download-has-budget] [account:dedication-page-and-its-doors] given the dedication page asked open, then nothing of it is drawn until its words are in, and then it reads in them", async () => {
    expect(hasWords("ui.dedication.page")).toBe(false);
    setDedicationServer({ get: () => Promise.resolve({ ok: true, count: 0, lights: [] }) } as unknown as Api);
    const shown: string[] = [];
    const watch = new MutationObserver(() => shown.push(`${document.body.textContent} ${[...document.querySelectorAll("[aria-label]")].map((node) => node.getAttribute("aria-label")).join(" ")}`));
    watch.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    render(<DedicationLater open onClose={() => undefined} />);
    expect(document.body.textContent).toBe("");
    const page = await screen.findByRole("dialog", { name: lineOf(uiDedicationText, "ui.dedication.page") });
    expect(hasWords("ui.dedication.page")).toBe(true);
    expect(page).toBeDefined();
    watch.disconnect();
    expect(shown.filter((text) => KEY.test(text))).toEqual([]);
    forgetDedication();
  });

  test("[engine:first-download-has-budget] given each later table asked for, twice at once, then every key of it reads in its words", async () => {
    await Promise.all([loadLaterWords("sheet"), loadLaterWords("sheet"), loadLaterWords("dedication"), loadLaterWords("dedication")]);
    for (const table of [uiAccountSheetText, uiDedicationText]) expect(Object.keys(table).filter((key) => words(key) !== table[key])).toEqual([]);
  });
});
