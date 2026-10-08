import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import type { AccountApi, AgeStanding, AuthResult } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { App } from "../../App";
import { AccountGate } from "./AccountGate";
import { AccountSettings } from "./Settings";
import { TEST_SITE_KEY, type LoadTurnstile, type TurnstileOptions } from "./Turnstile";

const OK: AuthResult = { ok: true };
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
    declareAge: (birth, bot) => (calls.push(`declareAge(${birth})`), bots.push(bot), Promise.resolve(serverAge(new Date())(birth))),
    sendCode: (email, bot) => (bots.push(bot), log("sendCode")(email)),
    signInWithCode: (email, code, bot) => (bots.push(bot), log("signInWithCode")(email, code)),
    signInWithGoogle: (bot) => (bots.push(bot), log("signInWithGoogle")()),
    signInWithPasskey: log("signInWithPasskey"),
    addPasskey: log("addPasskey"),
    email: () => Promise.resolve("ada@example.test"),
    deleteAccount: log("deleteAccount"),
    signOut: () => (calls.push("signOut()"), Promise.resolve()),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: (on) => (calls.push(`setUsageCounts(${String(on)})`), Promise.resolve(true)),
    ...over,
  };
}

function fakeTurnstile() {
  const rendered: TurnstileOptions[] = [];
  let resets = 0;
  const load: LoadTurnstile = () =>
    Promise.resolve({
      render: (_container, options) => (rendered.push(options), "widget-1"),
      reset: () => {
        resets += 1;
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

function gate(account: AccountApi, turnstile = fakeTurnstile()) {
  const store = signedOutStore(account);
  render(
    <GameProvider store={store}>
      <AccountGate load={turnstile.load} sitekey={TEST_SITE_KEY} />
    </GameProvider>,
  );
  return { store, turnstile };
}

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

function yearsAgo(years: number, extraDays = 0): string {
  const today = new Date();
  return isoDay(new Date(Date.UTC(today.getUTCFullYear() - years, today.getUTCMonth(), today.getUTCDate() + extraDays)));
}

async function answerAge(birth: string) {
  const input = await screen.findByLabelText(say("ui.account.age.label"));
  fireEvent.change(input, { target: { value: birth } });
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.go") }));
}

describe("the age screen", () => {
  test("[R-ACCOUNT-012] given a new browser, then the age screen comes before any way in, with no date filled in and no hint of the age needed", async () => {
    gate(fakeAccount());
    const input = await screen.findByLabelText<HTMLInputElement>(say("ui.account.age.label"));
    expect(input.value).toBe("");
    expect(input.getAttribute("min")).toBeNull();
    expect(input.getAttribute("max")).toBeNull();
    expect(input.getAttribute("placeholder")).toBeNull();
    expect(document.body.textContent).not.toMatch(/18|eighteen|old enough|adult/i);
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
  });

  test("[R-ACCOUNT-012] given a date of birth exactly 18 years ago today, then the client sends it as typed and the server's answer opens the ways in", async () => {
    const account = fakeAccount();
    gate(account);
    const birth = yearsAgo(18);
    await answerAge(birth);
    expect(await screen.findByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(account.calls).toEqual([`declareAge(${birth})`]);
  });

  test("[R-ACCOUNT-012] given a date of birth one day short of 18, then the client sends it all the same and shows the server's refusal plainly, with no way in", async () => {
    const account = fakeAccount();
    gate(account);
    const birth = yearsAgo(18, 1);
    await answerAge(birth);
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(account.calls).toEqual([`declareAge(${birth})`]);
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
  });

  test("[R-ACCOUNT-012] given no date typed, then nothing is sent and the player is asked for one", async () => {
    const account = fakeAccount();
    gate(account);
    await answerAge("");
    expect(await screen.findByText(say("ui.account.age.empty"))).toBeDefined();
    expect(account.calls).toEqual([]);
  });

  test("[R-ACCOUNT-012] given a browser refused before, then the refusal shows without asking again", async () => {
    gate(fakeAccount({ ageStatus: () => Promise.resolve("refused") }));
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(screen.queryByLabelText(say("ui.account.age.label"))).toBeNull();
  });

  test("[R-ACCOUNT-013] given the bot check passed on the age screen, then its token goes with the date", async () => {
    const account = fakeAccount();
    const { turnstile } = gate(account);
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    act(() => turnstile.rendered[0]?.callback(DUMMY_TOKEN));
    await answerAge(yearsAgo(30));
    expect(await screen.findByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(account.bots).toEqual([DUMMY_TOKEN]);
  });

  test("[R-ACCOUNT-012] [R-ACCOUNT-013] given a date the server does not believe, then the player is asked to check it, the screen stays and the spent token's widget is reset", async () => {
    const { turnstile } = gate(fakeAccount({ declareAge: () => Promise.resolve("bad-date") }));
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    act(() => turnstile.rendered[0]?.callback(DUMMY_TOKEN));
    await answerAge("1800-01-01");
    expect(await screen.findByText(say("ui.account.age.bad-date"))).toBeDefined();
    expect(screen.getByLabelText(say("ui.account.age.label"))).toBeDefined();
    await waitFor(() => expect(turnstile.resets()).toBe(1));
  });

  test("[R-SERVER-032] given sign-ups switched off, then the gate shows the full screen with no form, and once the server's wait is over it asks again and opens the age screen", async () => {
    let asked = 0;
    gate(fakeAccount({ ageStatus: () => Promise.resolve(asked++ === 0 ? { full: true, retryAfter: 1 } : "unasked") }));
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    expect(screen.queryByLabelText(say("ui.account.age.label"))).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(await screen.findByLabelText(say("ui.account.age.label"), {}, { timeout: 3000 })).toBeDefined();
    expect(asked).toBe(2);
  });

  test("[R-SERVER-032] given sign-ups switched off when the age is declared, then the full screen shows instead of the ways in", async () => {
    gate(fakeAccount({ declareAge: () => Promise.resolve({ full: true, retryAfter: 30 }) }));
    await answerAge(yearsAgo(30));
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
  });

  test("[R-ACCOUNT-011] given a region that is not open, then it is refused before the age screen", async () => {
    gate(fakeAccount({ ageStatus: () => Promise.resolve("region-closed") }));
    expect(await screen.findByText(say("ui.account.region-closed"))).toBeDefined();
    expect(screen.queryByLabelText(say("ui.account.age.label"))).toBeNull();
  });
});

describe("the ways in", () => {
  const passed = () => fakeAccount({ ageStatus: () => Promise.resolve("passed") });

  test("[R-ACCOUNT-001] given the age screen passed, then Google, a passkey and an email code are offered, and nothing in the feature asks for a secret word", async () => {
    gate(passed());
    expect(await screen.findByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.passkey") })).toBeDefined();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
    // Vitest runs from the repository root.
    const folder = join(process.cwd(), "apps/client/src/features/account");
    const banned = ["pass", "word"].join("");
    const files = readdirSync(folder).filter((name) => name !== "account.test.tsx");
    expect(files).toContain("SignIn.tsx");
    expect(files.filter((name) => readFileSync(join(folder, name), "utf8").toLowerCase().includes(banned))).toEqual([]);
  });

  test("[R-ACCOUNT-002] given an email, when a code is asked for and the 6 digits typed, then the account signs in and the game comes back", async () => {
    const account = passed();
    const { store } = gate(account);
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

  test("[R-ACCOUNT-002] given a wrong code, then the player is told and stays signed out", async () => {
    const account = fakeAccount({ ageStatus: () => Promise.resolve("passed"), signInWithCode: () => Promise.resolve({ ok: false, why: "wrong-code" }) });
    const { store } = gate(account);
    fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    expect(await screen.findByText(say("ui.account.fail.wrong-code"))).toBeDefined();
    expect(store.getState().signedOut).toBe(true);
  });

  test("[R-ACCOUNT-013] given the bot check passed with the test key, then its token goes with the code request and the widget is reset for the next try", async () => {
    const account = passed();
    const { turnstile } = gate(account);
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    expect(turnstile.rendered[0]?.sitekey).toBe(TEST_SITE_KEY);
    act(() => turnstile.rendered[0]?.callback(DUMMY_TOKEN));
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    await screen.findByLabelText(say("ui.account.code.label"));
    expect(account.bots).toEqual([DUMMY_TOKEN]);
    await waitFor(() => expect(turnstile.resets()).toBe(1));
  });

  test("[R-ACCOUNT-013] given Google chosen with a token, then the token goes with it; a passkey, which never makes an account, sends none", async () => {
    const account = passed();
    const { turnstile } = gate(account);
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    act(() => turnstile.rendered[0]?.callback(DUMMY_TOKEN));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.google") }));
    await waitFor(() => expect(account.calls).toContain("signInWithGoogle()"));
    expect(account.bots).toEqual([DUMMY_TOKEN]);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey") }));
    await waitFor(() => expect(account.calls).toContain("signInWithPasskey()"));
    expect(account.bots).toEqual([DUMMY_TOKEN]);
  });

  test("[R-ACCOUNT-003] given the ways in, then none adds a passkey: that is offered only in the settings of a signed-in account", async () => {
    const account = passed();
    gate(account);
    await screen.findByRole("button", { name: say("ui.account.passkey") });
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.add") })).toBeNull();
    cleanUpAndSettings(account);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(account.calls).toEqual(["addPasskey()"]);
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

  test("[R-ACCOUNT-016] given a fresh session, when deletion is confirmed, then the server deletes it with no code and the player is told at the sign-in screen", async () => {
    const account = fakeAccount();
    const store = cleanUpAndSettings(account);
    askToDelete();
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.deleted");
    expect(account.calls).toEqual(["deleteAccount(null)"]);
  });

  test("[R-ACCOUNT-016] given a session older than the server allows, when the code the server's email sends is typed, then it goes with the deletion, never through a sign-in, and the account goes", async () => {
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

  test("[R-ACCOUNT-016] given a code the server refuses, then bad-code is said in words, the account stays, and a second code goes through", async () => {
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

  test("[R-ACCOUNT-016] given a stale session, then a passkey sign-in makes it fresh and the deletion goes with no code", async () => {
    const answers: AuthResult[] = [notFresh, OK];
    const account = fakeAccount();
    const store = cleanUpAndSettings({ ...account, deleteAccount: (code) => (account.calls.push(`deleteAccount(${JSON.stringify(code)})`), Promise.resolve(answers.shift() ?? OK)) });
    askToDelete();
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(account.calls).toEqual(["deleteAccount(null)", "signInWithPasskey()", "deleteAccount(null)"]);
  });
});

describe("the shell online", () => {
  test("[R-SERVER-001] given the server says no one is signed in, then the app shows the account screens instead of the game", async () => {
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
    expect(await screen.findByLabelText(say("ui.account.age.label"))).toBeDefined();
    expect(screen.queryByText(say("ui.failed", { why: "no session" }))).toBeNull();
  });
});
