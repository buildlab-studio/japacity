import type { AccountView } from "@japacity/api";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import type { AccountApi, AgeStanding, AuthResult } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import { COLUMN_PX } from "../../shared/ui/lively/CentredColumn";
import { SHEET_COLUMN_PX } from "../../shared/ui/lively/SheetColumn";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { App } from "../../app/App";
import { AccountGate } from "./AccountGate";
import { answerAge } from "./age.testing";
import { YEARS_LISTED } from "./AgeScreen";
import { AccountSettings } from "./Settings";
import { StartTrouble } from "./StartTrouble";
import { TEST_SITE_KEY, type LoadTurnstile, type TurnstileOptions } from "./Turnstile";
import { WayToast } from "./WayToast";

const OK: AuthResult = { ok: true };

const SECURED: AccountView = { id: "account-1", country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: null, sendUsageCounts: true, admin: false, state: "secured", username: "ada_lagos", renameFrom: 0, ways: { google: null, email: "ada@example.com", passkeys: 0 } };
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

/** The server's own rule, standing in for it: 18 or over on today's date passes. The client never applies it. */
function serverAge(today: Date) {
  return (birth: string): AgeStanding => {
    const [year, month, day] = birth.split("-").map(Number) as [number, number, number];
    const eighteenth = Date.UTC(year + 18, month - 1, day);
    return eighteenth <= Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) ? "passed" : "refused";
  };
}

function fakeAccount(over: Partial<AccountApi> = {}): AccountApi & { calls: string[]; bots: (string | null)[] } {
  const calls: string[] = [];
  const bots: (string | null)[] = [];
  const log =
    <A extends unknown[]>(name: string, result: AuthResult = OK) =>
    (...args: A) => {
      calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`);
      return Promise.resolve(result);
    };
  return {
    calls,
    bots,
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: (birth) => (calls.push(`declareAge(${birth})`), Promise.resolve(serverAge(new Date())(birth))),
    startGuest: (username, bot) => (calls.push(`startGuest(${JSON.stringify(username)})`), bots.push(bot), Promise.resolve({ ok: true })),
    view: () => Promise.resolve(null),
    rename: (username) => (calls.push(`rename(${JSON.stringify(username)})`), Promise.resolve({ ok: true })),
    returnedFromGoogle: () => null,
    sendCode: (email, bot) => (bots.push(bot), log("sendCode")(email)),
    signInWithCode: (email, code, bot) => (bots.push(bot), log("signInWithCode")(email, code)),
    signInWithGoogle: (bot) => (bots.push(bot), log("signInWithGoogle")()),
    signInWithPasskey: log("signInWithPasskey"),
    addPasskey: log("addPasskey"),
    email: () => Promise.resolve("ada@example.test"),
    deleteAccount: log("deleteAccount"),
    signOut: () => (calls.push("signOut()"), Promise.resolve(OK)),
    signOutEverywhere: () => (calls.push("signOutEverywhere()"), Promise.resolve(OK)),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: (id) => (calls.push(`removePasskey(${id})`), Promise.resolve({ ok: true, signedIn: true })),
    confirmWithPasskey: log("confirmWithPasskey"),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: (on) => (calls.push(`setUsageCounts(${String(on)})`), Promise.resolve(true)),
    ...over,
  };
}

/** Cloudflare's widget as its always-pass test key behaves: the token comes at once, and again after each reset, unless `passAtOnce` is off and the test gives it. */
function fakeTurnstile({ passAtOnce = true }: { passAtOnce?: boolean } = {}) {
  const rendered: TurnstileOptions[] = [];
  let resets = 0;
  const load: LoadTurnstile = () =>
    Promise.resolve({
      render: (_container, options) => {
        rendered.push(options);
        if (passAtOnce) setTimeout(() => options.callback(DUMMY_TOKEN), 0);
        return "widget-1";
      },
      reset: () => {
        resets += 1;
        const last = rendered.at(-1);
        if (passAtOnce && last !== undefined) setTimeout(() => last.callback(DUMMY_TOKEN), 0);
      },
      remove: () => undefined,
    });
  return { load, rendered, resets: () => resets };
}

function signedOutStore(account: AccountApi): GameStore {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  store.getState().leave(null);
  return store;
}

/** `embedded`: inside the invite page, where the age screen comes first and the username stands under it. */
function gate(account: AccountApi, turnstile = fakeTurnstile(), agent?: string, embedded = false) {
  const store = signedOutStore(account);
  render(
    <GameProvider store={store}>
      <AccountGate load={turnstile.load} sitekey={TEST_SITE_KEY} embedded={embedded} {...(agent === undefined ? {} : { agent, href: "https://japacity.app/" })} />
    </GameProvider>,
  );
  return { store, turnstile };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function yearsAgo(years: number, extraDays = 0): string {
  const today = new Date();
  return isoDay(new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate() + extraDays)));
}

/** Play on the start screen (account:start-screen-over-live-city). */
async function play() {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.play") }));
}

/** "I already have a life here" on the start screen (account:start-screen-over-live-city). */
async function returning() {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.returning") }));
}

/** The wordmarks on screen: an image whose words are the game's name (account:start-screen-over-live-city). */
const wordmarks = () => screen.queryAllByRole("img", { name: say("ui.game") });

/** The one wordmark on screen, with the game's name as its words and its file for the look and the ground. */
function oneWordmark(ground: "light" | "dark"): void {
  const shown = wordmarks();
  expect(shown).toHaveLength(1);
  expect(say("ui.game")).toBe("Japacity");
  expect(shown[0]?.getAttribute("alt")).toBe("Japacity");
  expect(shown[0]?.getAttribute("src")).toMatch(new RegExp(`brand/japacity-lockup-${ground}\\.svg$`));
}

/** The start screen's three hooks as a player reads them, row by row (text:hook-not-explanation, account:two-lights-and-wink-lines). */
const START_HOOKS = [
  ["Last one out,", "off the light."],
  ["Not going?", "Keep the light on."],
  ["Japa is not by force.", "How ready are you?"],
];

const ageFields = () => [say("ui.account.age.day"), say("ui.account.age.month"), say("ui.account.age.year")].map((name) => screen.queryByRole("combobox", { name }));

describe("the start screen online", () => {
  // The hook in two rows, the three steps, Play with its second line, and the two lights over the scene, in place of a
  // sentence about the game.
  test("[account:start-screen-over-live-city] [text:hook-not-explanation] given a new browser, then the first screen is the start screen over the compound: no title over the figure and the lockup at the head of the sheet, the hook in two rows and the three steps where the sentence was, Play with its second line and I already have a life here, the two lights over the top, and nothing else asked", async () => {
    const account = fakeAccount();
    gate(account);
    const playButton = await screen.findByRole("button", { name: say("ui.account.start.play") });
    expect(playButton).toBeDefined();
    expect(playButton.textContent).toBe(`${say("ui.account.start.play")}${say("ui.account.start.play.then")}`);
    expect(say("ui.account.start.play.then")).toBe("Free · no sign-up");
    expect(screen.getByRole("button", { name: say("ui.account.start.returning") })).toBeDefined();
    const hook = screen.getByRole("heading", { level: 1 });
    expect(hook.children).toHaveLength(2);
    expect(START_HOOKS).toContainEqual([...hook.children].map((row) => row.textContent));
    expect(document.body.textContent).not.toMatch(/out of the country|land on your feet/);
    const steps = within(screen.getByRole("list", { name: say("ui.account.start.steps") })).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent?.trim())).toEqual(["Hustle", "Papers", "Fly"]);
    expect(steps.every((step) => step.querySelector("svg") !== null)).toBe(true);
    expect(document.querySelector('[data-gate="start"] [data-gate-over] [data-two-lights]')).not.toBeNull();
    expect(screen.queryByText(say("ui.game"))).toBeNull();
    oneWordmark("light");
    expect(document.querySelector('[data-gate-sheet="start"] [data-wordmark="light"]')).not.toBeNull();
    // The compound behind, as the door draws it, with the sheet over the bottom of it.
    expect(document.querySelector('[data-gate="start"] [data-front-scene]')).not.toBeNull();
    expect(document.querySelector('[data-gate="start"] [data-gate-sheet="start"]')).not.toBeNull();
    expect(ageFields()).toEqual([null, null, null]);
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.queryByLabelText(say("ui.account.email.label"))).toBeNull();
    expect(account.calls).toEqual([]);
  });

  test("[account:start-screen-over-live-city] given the shell's city behind, then it stands in the figure's place behind the start screen and the age screen, never dragged, and no compound is drawn", async () => {
    const store = signedOutStore(fakeAccount());
    render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} behind={<div data-test-city />} />
      </GameProvider>,
    );
    await screen.findByRole("button", { name: say("ui.account.start.play") });
    expect(document.querySelector('[data-gate="start"] [data-front-scene] [data-gate-scene] [data-test-city]')).not.toBeNull();
    expect(document.querySelector("[data-gate-scene]")?.className).toContain("pointer-events-none");
    expect(document.querySelector("[data-gate-standin]")).toBeNull();
    await play();
    await screen.findByRole("combobox", { name: say("ui.account.age.day") });
    expect(document.querySelector("[data-gate-scene] [data-test-city]")).not.toBeNull();
  });

  test("[account:start-screen-over-live-city] given the start screen, when Play is pressed, then the age screen follows, and its Back returns to the start screen", async () => {
    gate(fakeAccount());
    await play();
    expect(await screen.findByRole("combobox", { name: say("ui.account.age.day") })).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.start.play") })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
    expect(ageFields()).toEqual([null, null, null]);
  });

  test("[account:start-screen-over-live-city] given the start screen, when I already have a life here is pressed, then the ways back in show with no age screen and nothing is declared; Back returns to the start", async () => {
    const account = fakeAccount();
    gate(account);
    await returning();
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
    expect(ageFields()).toEqual([null, null, null]);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    expect(await screen.findByRole("button", { name: say("ui.account.start.returning") })).toBeDefined();
    expect(account.calls).toEqual([]);
  });

  test("[account:start-screen-over-live-city] given the ways back in, then Google comes first, the code by email next, and the passkey last", async () => {
    gate(fakeAccount());
    await returning();
    const google = await screen.findByRole("button", { name: say("ui.account.google") });
    const email = screen.getByLabelText(say("ui.account.email.label"));
    const passkey = screen.getByRole("button", { name: say("ui.account.passkey") });
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(email.compareDocumentPosition(passkey) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("[account:start-screen-over-live-city] given an in-app browser on Android, then Google is not shown, the code is, and the way out opens the phone's own browser", async () => {
    const agent = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36 WhatsApp/2.24.1";
    gate(fakeAccount(), fakeTurnstile(), agent);
    await returning();
    expect(await screen.findByText(say("ui.account.in-app"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
    expect(screen.getByRole("link", { name: say("ui.account.in-app.open") }).getAttribute("href")).toBe("intent://japacity.app/#Intent;scheme=https;end");
  });

  test("[account:start-screen-over-live-city] given an in-app browser on an iPhone, then Google is not shown and the page's address is offered to copy", async () => {
    const agent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
    const copied: string[] = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: (text: string) => (copied.push(text), Promise.resolve()) }, configurable: true });
    gate(fakeAccount(), fakeTurnstile(), agent);
    await returning();
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.in-app.copy") }));
    expect(await screen.findByText(say("ui.account.in-app.copied"))).toBeDefined();
    expect(copied).toEqual(["https://japacity.app/"]);
  });

  test("[account:start-screen-over-live-city] given a code for an address that holds no life, when it is typed on the ways back in, then the player is told to go back and Play, and stays signed out", async () => {
    const account = fakeAccount({ signInWithCode: () => Promise.resolve({ ok: false, why: "no-life" }) });
    const { store } = gate(account);
    await returning();
    fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: "new@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    expect(await screen.findByText(say("ui.account.fail.no-life"))).toBeDefined();
    expect(store.getState().signedOut).toBe(true);
  });

  test("[account:start-screen-over-live-city] given a player who signed out, then the start screen says so above the line", async () => {
    const account = fakeAccount();
    const store = signedOutStore(account);
    store.getState().leave("ui.account.notice.signed-out");
    render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    expect(await screen.findByRole("status")).toHaveProperty("textContent", say("ui.account.notice.signed-out"));
    expect(screen.getByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
  });

  test("[account:start-screen-over-live-city] given the game offline, then there is no start screen: the gate draws nothing and the door is the first screen", () => {
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) });
    const { container } = render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    expect(container.innerHTML).toBe("");
  });
});

/** True where the sheet of the given mark stands in the door's sheet column: centred, at most SHEET_COLUMN_PX wide on a wide screen. */
function sheetInLane(mark: string): boolean {
  const sheet = document.querySelector(`[data-gate-sheet="${mark}"]`);
  if (sheet === null) throw new Error(`No sheet marked ${mark}`);
  const column = sheet.closest("[data-sheet-column]");
  return column !== null && column.classList.contains("centred-column") && column.classList.contains(`max-w-[${String(SHEET_COLUMN_PX)}px]`);
}

describe("the door's sheets on a desktop", () => {
  test("[account:start-screen-over-live-city] given the sheet column, then it is wider than the thumbs' lane, at a reading width", () => {
    expect(SHEET_COLUMN_PX).toBeGreaterThan(COLUMN_PX);
    expect(SHEET_COLUMN_PX).toBeGreaterThanOrEqual(560);
    expect(SHEET_COLUMN_PX).toBeLessThanOrEqual(640);
  });

  test("[account:start-screen-over-live-city] given the start screen, then its sheet stands in the sheet column, centred at a reading width, while the scene behind and the two lights over it stay the whole window's", async () => {
    const store = signedOutStore(fakeAccount());
    render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} behind={<div data-test-city />} />
      </GameProvider>,
    );
    await screen.findByRole("button", { name: say("ui.account.start.play") });
    expect(sheetInLane("start")).toBe(true);
    expect(document.querySelector("[data-test-city]")?.closest("[data-sheet-column]")).toBeNull();
    expect(document.querySelector("[data-two-lights]")?.closest("[data-sheet-column]")).toBeNull();
  });

  test("[account:age-screen-refuses-minors] [account:start-screen-over-live-city] given the age screen, then its sheet stands in the sheet column with its three fields and Continue inside it", async () => {
    gate(fakeAccount());
    await play();
    await screen.findByRole("combobox", { name: say("ui.account.age.day") });
    expect(sheetInLane("age")).toBe(true);
    const form = document.querySelector("[data-age-screen]");
    expect(form?.closest("[data-sheet-column]")).not.toBeNull();
    expect(form?.querySelectorAll("select")).toHaveLength(3);
  });

  test("[account:start-screen-over-live-city] given the ways back in, then its sheet stands in the sheet column", async () => {
    gate(fakeAccount());
    await returning();
    await screen.findByRole("heading", { name: say("ui.account.returning.title") });
    expect(sheetInLane("returning")).toBe(true);
  });

  test("[server:signups-off-shows-full] given sign-ups switched off, then the full screen's sheet stands in the sheet column", async () => {
    gate(fakeAccount({ ageStatus: () => Promise.resolve({ full: true, retryAfter: 30 }) }));
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    expect(sheetInLane("other")).toBe(true);
  });

  test("[server:no-platform-error-page] given the server out of reach for a new visitor, then the start screen's frame keeps its sheet in the sheet column", () => {
    render(<StartTrouble trouble={null} />);
    expect(sheetInLane("start-trouble")).toBe(true);
  });
});

describe("the wordmark on the account screens", () => {
  test("[account:start-screen-over-live-city] given the start screen, and then the age screen, then neither carries a title over the figure, the start screen holds the lockup at the head of its sheet and the age screen none", async () => {
    gate(fakeAccount());
    await screen.findByRole("button", { name: say("ui.account.start.play") });
    oneWordmark("light");
    expect(document.querySelector("[data-start-name]")).toBeNull();
    await play();
    await screen.findByRole("combobox", { name: say("ui.account.age.day") });
    expect(wordmarks()).toEqual([]);
    expect(screen.queryByText(say("ui.game"))).toBeNull();
  });

  test("[account:start-screen-over-live-city] given the ways back in, then the wordmark tops the screen once over the figure, its words the game's name; Back to the start takes it away", async () => {
    gate(fakeAccount());
    await returning();
    await screen.findByRole("heading", { name: say("ui.account.returning.title") });
    oneWordmark("dark");
    expect(document.querySelector('[data-gate="start"] [data-wordmark="dark"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    await screen.findByRole("button", { name: say("ui.account.start.play") });
    oneWordmark("light");
  });

  test("[account:start-screen-over-live-city] [server:signups-off-shows-full] given sign-ups switched off, then the full screen carries the wordmark once", async () => {
    gate(fakeAccount({ ageStatus: () => Promise.resolve({ full: true, retryAfter: 30 }) }));
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    oneWordmark("dark");
    expect(document.querySelector("[data-account-top] [data-wordmark='dark']")).not.toBeNull();
  });
});

describe("the age screen", () => {
  test("[account:age-screen-refuses-minors] given a new browser, when Play is pressed, then the age screen comes before any way in: three fields, none filled in, and no hint of the age needed", async () => {
    gate(fakeAccount());
    await play();
    await screen.findByRole("combobox", { name: say("ui.account.age.day") });
    const fields = ageFields() as HTMLSelectElement[];
    expect(fields.map((field) => field.value)).toEqual(["", "", ""]);
    // Every day and every month, and the year list runs from this year back, so no field draws a line at any age.
    const [day, month, year] = fields as [HTMLSelectElement, HTMLSelectElement, HTMLSelectElement];
    const listed = (field: HTMLSelectElement) => [...field.options].filter((option) => option.value !== "").map((option) => option.value);
    expect(listed(day)).toEqual(Array.from({ length: 31 }, (_, index) => String(index + 1)));
    expect(listed(month)).toEqual(Array.from({ length: 12 }, (_, index) => String(index + 1)));
    const thisYear = new Date().getFullYear();
    expect(listed(year)).toEqual(Array.from({ length: YEARS_LISTED }, (_, index) => String(thisYear - index)));
    // The words on the screen, the lists apart, say nothing of the age needed.
    const form = document.querySelector("[data-age-screen]") as HTMLElement;
    const words = [...form.querySelectorAll("h1, p, legend, button")].map((node) => node.textContent).join(" ");
    expect(words).not.toMatch(/18|eighteen|old enough|adult/i);
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
  });

  test("[account:age-screen-refuses-minors] [account:guest-and-secured-states] given a date of birth exactly 18 years ago today, then the client sends it as typed and the server's answer opens the username, with no sign-in method at the door", async () => {
    const account = fakeAccount();
    gate(account);
    const birth = yearsAgo(18);
    await play();
    await answerAge(birth);
    expect(await screen.findByLabelText(say("ui.account.name.label"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.queryByLabelText(say("ui.account.email.label"))).toBeNull();
    expect(account.calls).toEqual([`declareAge(${birth})`]);
  });

  test("[account:age-screen-refuses-minors] given a date of birth one day short of 18, then the client sends it all the same and shows the server's refusal plainly, with no way in", async () => {
    const account = fakeAccount();
    gate(account);
    const birth = yearsAgo(18, 1);
    await play();
    await answerAge(birth);
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(account.calls).toEqual([`declareAge(${birth})`]);
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
  });

  test("[account:age-screen-refuses-minors] given no date picked, or only part of one, then nothing is sent and the player is asked for all three", async () => {
    const account = fakeAccount();
    gate(account);
    await play();
    await answerAge("");
    expect(await screen.findByText(say("ui.account.age.empty"))).toBeDefined();
    fireEvent.change(screen.getByRole("combobox", { name: say("ui.account.age.day") }), { target: { value: "12" } });
    fireEvent.change(screen.getByRole("combobox", { name: say("ui.account.age.month") }), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
    expect(await screen.findByText(say("ui.account.age.empty"))).toBeDefined();
    expect(account.calls).toEqual([]);
  });

  test("[account:age-screen-refuses-minors] given a browser refused before, then the refusal shows without asking again", async () => {
    gate(fakeAccount({ ageStatus: () => Promise.resolve("refused") }));
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(ageFields()).toEqual([null, null, null]);
    expect(screen.queryByRole("button", { name: say("ui.account.start.play") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.start.returning") })).toBeNull();
  });

  test("[account:bot-check-on-guest-creation] given the age screen, then it shows no bot check: that comes with the username, where the account is made, and its token goes with the guest start", async () => {
    const account = fakeAccount();
    const { turnstile } = gate(account, fakeTurnstile({ passAtOnce: false }), undefined, true);
    await screen.findByRole("combobox", { name: say("ui.account.age.day") });
    expect(turnstile.rendered).toHaveLength(0);
    await answerAge(yearsAgo(30));
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    act(() => turnstile.rendered[0]?.callback(DUMMY_TOKEN));
    fireEvent.change(screen.getByLabelText(say("ui.account.name.label")), { target: { value: "ada_lagos" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.go") }));
    await waitFor(() => expect(account.bots).toEqual([DUMMY_TOKEN]));
    await waitFor(() => expect(turnstile.resets()).toBe(1));
  });

  test("[account:age-screen-refuses-minors] given a date the server does not believe, then the player is asked to check it and the screen stays", async () => {
    gate(fakeAccount({ declareAge: () => Promise.resolve("bad-date") }));
    await play();
    // The thirty-first of February: three fields can be picked into a date no calendar has.
    await answerAge("1990-02-31");
    expect(await screen.findByText(say("ui.account.age.bad-date"))).toBeDefined();
    expect(screen.getByRole("combobox", { name: say("ui.account.age.year") })).toBeDefined();
  });

  test("[server:signups-off-shows-full] given sign-ups switched off, then the gate shows the full screen with no form, and once the server's wait is over it asks again and opens the age screen", async () => {
    let asked = 0;
    gate(fakeAccount({ ageStatus: () => Promise.resolve(asked++ === 0 ? { full: true, retryAfter: 1 } : "unasked") }));
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    expect(ageFields()).toEqual([null, null, null]);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.start.play") })).toBeNull();
    await screen.findByRole("button", { name: say("ui.account.start.play") }, { timeout: 3000 });
    await play();
    expect(await screen.findByRole("combobox", { name: say("ui.account.age.day") })).toBeDefined();
    expect(asked).toBe(2);
  });

  test("[server:signups-off-shows-full] given sign-ups switched off when the age is declared, then the full screen shows instead of the username", async () => {
    gate(fakeAccount({ declareAge: () => Promise.resolve({ full: true, retryAfter: 30 }) }));
    await play();
    await answerAge(yearsAgo(30));
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    expect(screen.queryByLabelText(say("ui.account.name.label"))).toBeNull();
  });
});

describe("the guest start inside the invite page", () => {
  const passed = (over: Partial<AccountApi> = {}) => fakeAccount({ ageStatus: () => Promise.resolve("passed"), ...over });
  const inside = (account: AccountApi) => gate(account, fakeTurnstile(), undefined, true);

  async function pick(name: string) {
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.go") }));
  }

  test("[account:guest-and-secured-states] [account:guest-reminded-to-secure] given the age screen passed, when a username is picked, then the guest line is said once and the guest life starts at once", async () => {
    const account = passed();
    const { store } = inside(account);
    await screen.findByLabelText(say("ui.account.name.label"));
    expect(screen.getAllByText(say("ui.guest.reminder"))).toHaveLength(1);
    await pick(" ada_lagos ");
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.calls).toEqual(['startGuest("ada_lagos")']);
  });

  test("[account:username-and-unconfirmed-email] [account:guest-floods-are-capped] given each refusal, then the player is told plainly and stays on the screen; no username typed sends nothing", async () => {
    const answers = ["taken", "reserved", "blocked", "format", "too-many", "bot-check"] as const;
    let at = 0;
    const account = passed({ startGuest: () => Promise.resolve({ ok: false, why: answers[at++] ?? "refused" }) });
    const { store } = inside(account);
    await pick("");
    expect(await screen.findByText(say("ui.account.name.empty"))).toBeDefined();
    for (const key of ["ui.account.name.taken", "ui.account.name.reserved", "ui.account.name.blocked", "ui.account.name.format", "ui.account.guest.too-many", "ui.account.bot.failed"]) {
      await pick("ada_lagos");
      expect(await screen.findByText(say(key))).toBeDefined();
    }
    expect(store.getState().signedOut).toBe(true);
  });

  test("[account:age-screen-refuses-minors] given an age answer that ran out, when the username is sent, then the age screen asks again", async () => {
    inside(passed({ startGuest: () => Promise.resolve({ ok: false, why: "expired" }) }));
    await pick("ada_lagos");
    expect(await screen.findByRole("combobox", { name: say("ui.account.age.day") })).toBeDefined();
  });
});

describe("the ways back in", () => {
  const kept = (over: Partial<AccountApi> = {}) => fakeAccount({ ageStatus: () => Promise.resolve("passed"), ...over });

  const comeBack = returning;

  test("[account:sign-in-without-secret] given a player who kept a life, then Google, a passkey and an email code are offered, and nothing in the feature asks for a secret word", async () => {
    gate(kept());
    await comeBack();
    expect(await screen.findByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.passkey") })).toBeDefined();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
    // Vitest runs from the repository root.
    const folder = join(process.cwd(), "apps/client/src/features/account");
    const banned = ["pass", "word"].join("");
    const files = readdirSync(folder).filter((name) => !name.endsWith(".test.tsx"));
    expect(files).toContain("SignIn.tsx");
    expect(files.filter((name) => readFileSync(join(folder, name), "utf8").toLowerCase().includes(banned))).toEqual([]);
  });

  test("[account:email-code-is-short-lived] given an email, when a code is asked for and the 6 digits typed, then the account signs in and the game comes back", async () => {
    const account = kept();
    const { store } = gate(account);
    await comeBack();
    fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: " ada@example.test " } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    fireEvent.change(code, { target: { value: "12 34 5" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    expect(await screen.findByText(say("ui.account.code.short"))).toBeDefined();
    fireEvent.change(code, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.calls).toEqual(['sendCode("ada@example.test")', 'signInWithCode("ada@example.test","123456")']);
  });

  test("[account:email-code-is-short-lived] given a wrong code, then the player is told and stays signed out", async () => {
    const account = kept({ signInWithCode: () => Promise.resolve({ ok: false, why: "wrong-code" }) });
    const { store } = gate(account);
    await comeBack();
    fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    expect(await screen.findByText(say("ui.account.fail.wrong-code"))).toBeDefined();
    expect(store.getState().signedOut).toBe(true);
  });

  test("[account:bot-check-on-guest-creation] given a returning player, then no bot check shows and no token goes with Google, a passkey or a code", async () => {
    const account = kept();
    gate(account);
    await comeBack();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.google") }));
    await waitFor(() => expect(account.calls).toContain("signInWithGoogle()"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey") }));
    await waitFor(() => expect(account.calls).toContain("signInWithPasskey()"));
    expect(screen.queryByText(say("ui.account.bot"))).toBeNull();
    expect(account.bots).toEqual([null]);
  });

  test("[account:guest-and-secured-states] given a sign-in that finds no life, then the player is told and can go back to start one", async () => {
    gate(kept({ signInWithPasskey: () => Promise.resolve({ ok: false, why: "no-life" }) }));
    await comeBack();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey") }));
    expect(await screen.findByText(say("ui.account.fail.no-life"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
  });

  test("[account:guest-and-secured-states] given Google came back having found no life, then the ways back in show with the reason", async () => {
    gate(kept({ returnedFromGoogle: () => "no-life" }));
    expect(await screen.findByText(say("ui.account.fail.no-life"))).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.google") })).toBeDefined();
  });

  test("[account:passkey-needs-signed-in-session] given the ways back in, then none adds a passkey: that is offered only in the settings of a kept account", async () => {
    const account = kept({ view: () => Promise.resolve({ ...SECURED }) });
    gate(account);
    await comeBack();
    await screen.findByRole("button", { name: say("ui.account.passkey") });
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.add") })).toBeNull();
    cleanUpAndSettings(account);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(account.calls).toEqual(["addPasskey()"]);
  });
});

describe("adding a passkey", () => {
  test("[account:passkey-needs-signed-in-session] given an admin on a code session, when a passkey is added in the settings, then the server's refusal is told as: sign in with the passkey first", async () => {
    const account = fakeAccount({ addPasskey: () => Promise.resolve({ ok: false, why: "passkey-first" }) });
    cleanUpAndSettings(account);
    // The browser is asked first whether it can make a passkey (account:passkey-offered-where-it-works).
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.fail.passkey-first"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.passkey.added"))).toBeNull();
  });
});

function cleanUpAndSettings(account: AccountApi): GameStore {
  document.body.innerHTML = "";
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  render(
    <GameProvider store={store}>
      <AccountSettings account={account} />
    </GameProvider>,
  );
  return store;
}

describe("deleting the account", () => {
  const notFresh: AuthResult = { ok: false, why: "not-fresh" };

  function askToDelete() {
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete") }));
    expect(screen.getByText(say("ui.account.delete.warn"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete.confirm") }));
  }

  async function sendAndType(code: string) {
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: code } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete.code.go") }));
  }

  test("[account:player-deletes-account] given a fresh session, when deletion is confirmed, then the server deletes it with no code and the player is told at the sign-in screen", async () => {
    const account = fakeAccount();
    const store = cleanUpAndSettings(account);
    askToDelete();
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.deleted");
    expect(account.calls).toEqual(["deleteAccount(null)"]);
  });

  test("[account:player-deletes-account] given a session older than the server allows, when the code the server's email sends is typed, then it goes with the deletion, never through a sign-in, and the account goes", async () => {
    const answers: AuthResult[] = [notFresh, OK];
    const account = fakeAccount();
    const store = cleanUpAndSettings({ ...account, deleteAccount: (code) => (account.calls.push(`deleteAccount(${JSON.stringify(code)})`), Promise.resolve(answers.shift() ?? OK)) });
    askToDelete();
    expect(await screen.findByText(say("ui.account.delete.fresh"))).toBeDefined();
    expect(store.getState().signedOut).toBe(false);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.delete.code", { email: "ada@example.test" }) }));
    await sendAndType("654321");
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.deleted");
    expect(account.calls).toEqual(["deleteAccount(null)", 'sendCode("ada@example.test")', 'deleteAccount("654321")']);
  });

  test("[account:player-deletes-account] given a code the server refuses, then bad-code is said in words, the account stays, and a second code goes through", async () => {
    const answers: AuthResult[] = [notFresh, { ok: false, why: "bad-code" }, OK];
    const account = fakeAccount();
    const store = cleanUpAndSettings({ ...account, deleteAccount: (code) => (account.calls.push(`deleteAccount(${JSON.stringify(code)})`), Promise.resolve(answers.shift() ?? OK)) });
    askToDelete();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.delete.code", { email: "ada@example.test" }) }));
    await sendAndType("111111");
    expect(await screen.findByText(say("ui.account.fail.bad-code"))).toBeDefined();
    expect(store.getState().signedOut).toBe(false);
    await sendAndType("222222");
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(account.calls.filter((call) => call.startsWith("deleteAccount"))).toEqual(["deleteAccount(null)", 'deleteAccount("111111")', 'deleteAccount("222222")']);
  });

  test("[account:player-deletes-account] given a stale session on an account holding a passkey, then a sign-in with one of its own passkeys makes it fresh and the deletion goes with no code", async () => {
    const answers: AuthResult[] = [notFresh, OK];
    const account = fakeAccount({ view: () => Promise.resolve({ ...SECURED, ways: { ...SECURED.ways, passkeys: 1 } }) });
    const store = cleanUpAndSettings({ ...account, deleteAccount: (code) => (account.calls.push(`deleteAccount(${JSON.stringify(code)})`), Promise.resolve(answers.shift() ?? OK)) });
    askToDelete();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(account.calls).toEqual(["deleteAccount(null)", "confirmWithPasskey()", "deleteAccount(null)"]);
  });
});

describe("the delete confirmation's passkey", () => {
  test("[account:player-deletes-account] given a stale session on an account that holds no passkey, then the confirmation offers no passkey, only the code and Google", async () => {
    const account = fakeAccount({ view: () => Promise.resolve(SECURED), deleteAccount: () => Promise.resolve({ ok: false, why: "not-fresh" }) });
    cleanUpAndSettings(account);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete.confirm") }));
    expect(await screen.findByRole("button", { name: say("ui.account.delete.code", { email: "ada@example.test" }) })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
  });
});

describe("the shell online", () => {
  test("[server:commands-only-through-route] given the server says no one is signed in, then the app shows the account screens instead of the game", async () => {
    const account = fakeAccount();
    const store = createGameStore(
      {
        view: () => {
          store.getState().heard({ kind: "signed-out" });
          return Promise.reject(Object.assign(new Error("no session"), { reported: "signed-out" }));
        },
        send: () => Promise.reject(new Error("unused")),
      },
      { account },
    );
    render(<App store={store} />);
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
    expect(screen.queryByText(say("ui.failed", { why: "no session" }))).toBeNull();
  });
});

describe("the signed-out notice goes when the player moves on (account:guest-and-secured-states)", () => {
  function signedOut(account: AccountApi = fakeAccount()) {
    const store = signedOutStore(account);
    store.getState().leave("ui.account.notice.signed-out");
    render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} />
        <WayToast account={account} />
      </GameProvider>,
    );
    return store;
  }
  const notice = () => screen.queryByText(say("ui.account.notice.signed-out"));

  test("[account:guest-and-secured-states] given a player who signed out, when I already have a life here is tapped, then the notice is gone from the ways back in, and stays gone back on the start screen", async () => {
    signedOut();
    expect(await screen.findByText(say("ui.account.notice.signed-out"))).toBeDefined();
    await returning();
    expect(await screen.findByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(notice()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    expect(await screen.findByRole("button", { name: say("ui.account.start.play") })).toBeDefined();
    expect(notice()).toBeNull();
  });

  test("[account:guest-and-secured-states] given a player who signed out, when Play is tapped, then the age screen opens with no notice", async () => {
    signedOut();
    expect(await screen.findByText(say("ui.account.notice.signed-out"))).toBeDefined();
    await play();
    expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
    expect(notice()).toBeNull();
  });

  test("[account:guest-and-secured-states] [account:guest-secures-the-life] given a player who signed out, when a life is opened again by a code, then the notice is gone, the sheet closes into the life and the world says Signed in with your email", async () => {
    const account = fakeAccount({ view: () => Promise.resolve(SECURED) });
    const store = signedOut(account);
    await returning();
    fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(store.getState().accountNotice).toBeNull();
    await waitFor(() => expect(document.querySelector("[data-way-toast]")?.textContent).toBe(say("ui.account.toast.in.email")));
    expect(say("ui.account.toast.in.email")).toBe("Signed in with your email");
  });

  test("[account:guest-secures-the-life] given Google came back because its address was kept by a code, then the ways back in show and point to the code, never the library's code", async () => {
    gate(fakeAccount({ returnedFromGoogle: () => "not-linked" }));
    expect(await screen.findByText(say("ui.account.fail.not-linked"))).toBeDefined();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });
});
