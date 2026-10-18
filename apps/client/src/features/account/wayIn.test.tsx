// The way in for a returning player (account:start-screen-over-live-city, account:age-screen-refuses-minors, account:guest-secures-the-life,
// account:code-form-forgives, account:passkey-in-email-autofill, account:bot-check-on-guest-creation): the two doors and the kept mark that
// turns them round, the age screen's one sign-in line, the kept life a guest can open instead, the in-app browsers, the
// code form, the passkey in the email field's autofill, and the bot check's and the cookie's own words.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, onTestFinished, test, vi } from "vitest";

import { GameProvider, useGame } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import { KEPT_MARK_KEY, PASSKEY_MARK_KEY } from "../../shared/kept/storage";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { accountView, engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { answerAge } from "./age.testing";
import { CodeForm, RESEND_WAIT_S } from "./CodeForm";
import { inAppBrowser } from "./inApp";
import { askWaysBackIn, doneWaysBackIn, keptHere, passkeyHere } from "./marks";
import { GuestReminder, SecureSheet } from "./Secure";
import { SignIn } from "./SignIn";
import { refreshAccount } from "./standing";
import { StartScreen } from "./StartScreen";
import { TEST_SITE_KEY, type LoadTurnstile, type TurnstileOptions } from "./Turnstile";
import { WayToast, tellWay } from "./WayToast";

const OK: AuthResult = { ok: true };
const DUMMY_TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

beforeEach(() => {
  localStorage.clear();
  doneWaysBackIn();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fakeAccount(over: Partial<AccountApi> = {}): AccountApi & { calls: string[] } {
  const calls: string[] = [];
  const log = (name: string, result: AuthResult = OK) => (...args: unknown[]) => (calls.push(`${name}(${args.map((arg) => JSON.stringify(arg)).join(",")})`), Promise.resolve(result));
  return {
    calls,
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: (birth) => (calls.push(`declareAge(${birth})`), Promise.resolve("passed")),
    startGuest: (username) => (calls.push(`startGuest(${JSON.stringify(username)})`), Promise.resolve({ ok: true })),
    view: () => Promise.resolve(null),
    rename: () => Promise.resolve({ ok: true }),
    returnedFromGoogle: () => null,
    sendCode: (email) => log("sendCode")(email),
    signInWithCode: (email, code) => log("signInWithCode")(email, code),
    signInWithGoogle: (_bot, trip) => log("signInWithGoogle")(trip),
    signInWithPasskey: log("signInWithPasskey"),
    addPasskey: log("addPasskey"),
    email: () => Promise.resolve(null),
    deleteAccount: log("deleteAccount"),
    signOut: () => (calls.push("signOut()"), Promise.resolve({ ok: true })),
    signOutEverywhere: () => (calls.push("signOutEverywhere()"), Promise.resolve(OK)),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: (id) => (calls.push(`removePasskey(${id})`), Promise.resolve({ ok: true, signedIn: true })),
    confirmWithPasskey: log("confirmWithPasskey"),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    ...over,
  };
}

/** Cloudflare's widget as its always-pass test key behaves, or as told: a script that does not load, a widget that errs or asks for a tap. */
function fakeTurnstile({ loads = () => true, pass = true, onRender }: { loads?: (attempt: number) => boolean; pass?: boolean; onRender?: (options: TurnstileOptions) => void } = {}) {
  let attempts = 0;
  const load: LoadTurnstile = () => {
    attempts += 1;
    if (!loads(attempts)) return Promise.reject(new Error("Turnstile did not load."));
    return Promise.resolve({
      render: (_container, options) => {
        onRender?.(options);
        if (pass) setTimeout(() => options.callback(DUMMY_TOKEN), 0);
        return "widget-1";
      },
      reset: () => undefined,
      remove: () => undefined,
    });
  };
  return { load, attempts: () => attempts };
}

function signedOutStore(account: AccountApi): GameStore {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  store.getState().leave(null);
  return store;
}

function gate(account: AccountApi, { turnstile = fakeTurnstile(), embedded = false, botWaitMs }: { turnstile?: ReturnType<typeof fakeTurnstile>; embedded?: boolean; botWaitMs?: number } = {}) {
  const store = signedOutStore(account);
  render(
    <GameProvider store={store}>
      <AccountGate load={turnstile.load} sitekey={TEST_SITE_KEY} embedded={embedded} {...(botWaitMs === undefined ? {} : { botWaitMs })} />
    </GameProvider>,
  );
  return store;
}

const button = (key: string) => screen.findByRole("button", { name: say(key) });

describe("the two doors of the start screen (account:start-screen-over-live-city)", () => {
  test("[account:start-screen-over-live-city] given a browser no kept life was open in, then Play comes first and I already have a life here under it, a full-width outlined button as tall as Play, never a text link", async () => {
    gate(fakeAccount());
    const play = await button("ui.account.start.play");
    const returning = screen.getByRole("button", { name: say("ui.account.start.returning") });
    expect(play.compareDocumentPosition(returning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(returning.className).toMatch(/\bw-full\b/);
    expect(returning.className).toMatch(/\bh-\[58px\]/);
    expect(returning.className).toMatch(/\bborder-2\b/);
    expect(document.querySelector("[data-start-screen]")?.getAttribute("data-start-screen")).toBe("new");
  });

  test("[account:start-screen-over-live-city] given a browser a kept life was open in, then the doors turn round: Sign in to my life first, Start a new life under it, the hook and the steps unchanged; each goes where it says", async () => {
    localStorage.setItem(KEPT_MARK_KEY, "1");
    const account = fakeAccount();
    gate(account);
    const back = await button("ui.account.start.kept.returning");
    const fresh = screen.getByRole("button", { name: say("ui.account.start.kept.play") });
    expect(back.compareDocumentPosition(fresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(back.className).toMatch(/\bbtn-main\b/);
    expect(screen.queryByRole("button", { name: say("ui.account.start.play") })).toBeNull();
    expect(document.querySelector("[data-start-hook]")).not.toBeNull();
    expect(document.querySelector("[data-start-screen]")?.getAttribute("data-start-screen")).toBe("kept");
    fireEvent.click(back);
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    fireEvent.click(await button("ui.account.start.kept.play"));
    expect(await screen.findByRole("heading", { name: say("ui.account.age.title") })).toBeDefined();
    expect(say("ui.account.start.kept.returning")).toBe("Sign in to my life");
    expect(say("ui.account.start.kept.play")).toBe("Start a new life");
  });

  test("[account:start-screen-over-live-city] given a kept life read in this browser, then the mark is set with no account data in it; a guest's sets none, and signing out never clears it", async () => {
    await refreshAccount(fakeAccount({ view: () => Promise.resolve(accountView({ state: "guest" })) }));
    expect(keptHere()).toBe(false);
    await refreshAccount(fakeAccount({ view: () => Promise.resolve(accountView({ state: "secured" })) }));
    expect(keptHere()).toBe(true);
    expect(localStorage.getItem(KEPT_MARK_KEY)).toBe("1");
    const store = signedOutStore(fakeAccount());
    store.getState().leave("ui.account.notice.signed-out");
    expect(keptHere()).toBe(true);
  });

  test("[account:start-screen-over-live-city] given the start screen alone, then each door calls its own way", () => {
    const played = vi.fn();
    const returned = vi.fn();
    render(<StartScreen kept onPlay={played} onReturning={returned} />);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.kept.returning") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.kept.play") }));
    expect(returned).toHaveBeenCalledOnce();
    expect(played).toHaveBeenCalledOnce();
  });

  test("[account:start-screen-over-live-city] given a move to another screen, then the focus goes to its heading; the screen the gate opened on keeps the page's own", async () => {
    gate(fakeAccount());
    await button("ui.account.start.play");
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.play") }));
    const age = await screen.findByRole("heading", { name: say("ui.account.age.title") });
    await waitFor(() => expect(document.activeElement).toBe(age));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.age.returning") }));
    const ways = await screen.findByRole("heading", { name: say("ui.account.returning.title") });
    await waitFor(() => expect(document.activeElement).toBe(ways));
  });

  test("[account:start-screen-over-live-city] given a player who signed out, then the notice is said through a live region mounted before its words, and the region stays when they go", async () => {
    const store = signedOutStore(fakeAccount());
    store.getState().leave("ui.account.notice.signed-out");
    render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    const region = await screen.findByText(say("ui.account.notice.signed-out"));
    expect(region.getAttribute("role")).toBe("status");
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.play") }));
    await waitFor(() => expect(region.textContent).toBe(""));
    expect(region.isConnected).toBe(true);
  });

  test("[account:guest-secures-the-life] given the line over the world, then it is read through one live region mounted before it; the toast itself is for the eye", () => {
    const account = fakeAccount();
    render(<WayToast account={account} />);
    const region = document.querySelector("[data-way-said]");
    expect(region?.getAttribute("role")).toBe("status");
    expect(region?.textContent).toBe("");
    act(() => tellWay(account, "kept.email"));
    expect(region?.textContent).toBe(say("ui.account.toast.kept.email"));
    expect(document.querySelector("[data-way-toast]")?.closest("[aria-hidden]")).not.toBeNull();
  });
});

describe("the age screen's one sign-in line (account:age-screen-refuses-minors)", () => {
  test("[account:age-screen-refuses-minors] given the age screen after Play, then one quiet line under its fields turns back to the ways back in, with nothing sent", async () => {
    const account = fakeAccount();
    gate(account);
    fireEvent.click(await button("ui.account.start.play"));
    const line = await button("ui.account.age.returning");
    expect(say("ui.account.age.returning")).toBe("Already have a life here? Sign in.");
    expect(screen.getAllByText(say("ui.account.age.returning"))).toHaveLength(1);
    expect(line.className).not.toMatch(/\bbtn-main\b/);
    fireEvent.click(line);
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(account.calls.some((call) => call.startsWith("declareAge"))).toBe(false);
  });
});

/** The keep sheet while signed in as a guest, and the account screens once the guest has left. */
function KeepThenGate({ account, taken = false }: { account: AccountApi; taken?: boolean }) {
  const out = useGame((state) => state.signedOut);
  return out ? <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} /> : <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} taken={taken} />;
}

async function signedInGuest(account: AccountApi, ui: React.ReactElement): Promise<GameStore> {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  await store.getState().refresh();
  store.setState({ earlyWin: false, moments: [], reportOpen: false });
  render(<GameProvider store={store}>{ui}</GameProvider>);
  return store;
}

describe("a guest who has a kept life already (account:guest-secures-the-life)", () => {
  const guest = (over: Partial<AccountApi> = {}) =>
    fakeAccount({ view: () => Promise.resolve(accountView({ state: "guest" })), signInWithCode: () => Promise.resolve({ ok: false, why: "taken" }), ...over });

  test("[account:guest-secures-the-life] given a code to an address that already has a life, then the refusal offers Open my kept life with what it costs; it signs the guest out and opens the ways back in with the address filled in", async () => {
    const account = guest();
    const store = await signedInGuest(account, <KeepThenGate account={account} />);
    fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    expect(await screen.findByText(say("ui.account.fail.taken"))).toBeDefined();
    expect(screen.getByText(say("ui.secure.taken.ends"))).toBeDefined();
    expect(say("ui.secure.taken.ends")).toBe("This life on this phone ends if you do.");
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.taken.open") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(account.calls).toContain("signOut()");
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.email.label")).value).toBe("ada@example.test");
    expect(store.getState().accountNotice).toBeNull();
  });

  test("[account:guest-secures-the-life] [account:sign-out-ends-the-session] given Open my kept life when the sign-out does not reach the server, then the guest stays in and is told, and the ways back in do not open", async () => {
    const account = guest({ signOut: () => Promise.resolve({ ok: false, why: "sign-out" }) });
    const store = await signedInGuest(account, <KeepThenGate account={account} taken />);
    fireEvent.click(await button("ui.secure.taken.open"));
    expect(await screen.findByText(say("ui.account.fail.sign-out"))).toBeDefined();
    expect(store.getState().signedOut).toBe(false);
    expect(screen.queryByRole("heading", { name: say("ui.account.returning.title") })).toBeNull();
  });

  test("[account:guest-secures-the-life] given Google came back saying its address already has a life, then the sheet offers the kept life too, with no address to fill", async () => {
    const account = guest();
    const store = await signedInGuest(account, <KeepThenGate account={account} taken />);
    fireEvent.click(await button("ui.secure.taken.open"));
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.email.label")).value).toBe("");
    expect(store.getState().signedOut).toBe(true);
  });

  test("[account:guest-secures-the-life] given a guest's account sheet, then I already have a life here is offered; a first press says this life ends, a second opens the ways back in", async () => {
    const account = guest();
    const store = await signedInGuest(
      account,
      <>
        <GuestReminder />
        <Gone />
      </>,
    );
    fireEvent.click(await button("ui.account.start.returning"));
    expect(account.calls).not.toContain("signOut()");
    expect(screen.getByText(say("ui.secure.taken.ends"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.taken.open") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(account.calls).toContain("signOut()");
  });

  test("[account:guest-secures-the-life] given the month report's line after the first chapter, then it carries no way to another life", async () => {
    await signedInGuest(guest(), <GuestReminder afterFirstChapter returning={false} />);
    expect(screen.queryByRole("button", { name: say("ui.account.start.returning") })).toBeNull();
  });
});

/** Stands in for the shell's gate: says when the guest has left. */
function Gone() {
  const out = useGame((state) => state.signedOut);
  return out ? <p>gone</p> : null;
}

const ANDROID_WHATSAPP = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0";
const PLAIN_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("the in-app browsers, widened (account:guest-secures-the-life)", () => {
  const notHome = () => false;
  const IOS_APP = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

  test.each([
    ["Snapchat", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/12.0"],
    ["LinkedIn", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 LinkedInApp"],
    ["Line", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Line/13.0.0"],
    ["WeChat", "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 MicroMessenger/8.0"],
    ["an Android web view", "Mozilla/5.0 (Linux; Android 14; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36"],
    ["an iPhone app's own web view", IOS_APP],
  ])("[account:guest-secures-the-life] given %s, then it is an in-app browser", (_name, agent) => {
    expect(inAppBrowser(agent, notHome)).toBe(true);
  });

  test.each([
    ["Safari on an iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"],
    ["Chrome on an iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1"],
    ["Firefox on an iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120.0 Mobile/15E148"],
    ["Edge on an iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/120.0 Mobile/15E148"],
    ["Chrome on Android", PLAIN_CHROME],
  ])("[account:guest-secures-the-life] given %s, then it is the phone's own browser", (_name, agent) => {
    expect(inAppBrowser(agent, notHome)).toBe(false);
  });

  test("[account:guest-secures-the-life] given the game opened from an iPhone's home screen, whose user agent carries no Safari mark, then it is not an in-app browser", () => {
    expect(inAppBrowser(IOS_APP, () => true)).toBe(false);
  });
});

describe("the way out of an in-app browser (account:guest-secures-the-life)", () => {
  function startIn(agent: string) {
    const store = signedOutStore(fakeAccount());
    render(
      <GameProvider store={store}>
        <AccountGate load={fakeTurnstile().load} sitekey={TEST_SITE_KEY} agent={agent} href="https://japacity.app/" />
      </GameProvider>,
    );
  }

  test("[account:guest-secures-the-life] given the start screen inside an app's browser on Android, then a quiet line under the doors says where the life is saved, Open in my browser opens Chrome or the plain address, and Play still works", async () => {
    startIn(ANDROID_WHATSAPP);
    expect(await screen.findByText(say("ui.account.in-app.start"))).toBeDefined();
    expect(say("ui.account.in-app.start")).toBe("Opened inside an app? Your life is saved in the browser you play in.");
    const out = screen.getByRole("link", { name: say("ui.account.in-app.open") });
    expect(out.getAttribute("href")).toBe("intent://japacity.app/#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fjapacity.app%2F;end");
    const returning = screen.getByRole("button", { name: say("ui.account.start.returning") });
    expect(returning.compareDocumentPosition(out) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.play") }));
    expect(await screen.findByRole("heading", { name: say("ui.account.age.title") })).toBeDefined();
  });

  test("[account:guest-secures-the-life] given the start screen inside an app's browser on an iPhone, then Open in my browser opens a small sheet that says how, in one line, with the address to copy", async () => {
    startIn(IPHONE_INSTAGRAM);
    fireEvent.click(await button("ui.account.in-app.open"));
    const sheet = await screen.findByRole("dialog", { name: say("ui.account.in-app.open") });
    expect(within(sheet).getByText(say("ui.account.in-app.how"))).toBeDefined();
    expect(within(sheet).getByRole("button", { name: say("ui.account.in-app.copy") })).toBeDefined();
  });

  test("[account:guest-secures-the-life] given the start screen in the phone's own browser, then there is no such line", async () => {
    startIn(PLAIN_CHROME);
    await button("ui.account.start.play");
    expect(screen.queryByText(say("ui.account.in-app.start"))).toBeNull();
    expect(screen.queryByRole("link", { name: say("ui.account.in-app.open") })).toBeNull();
  });

  test("[account:guest-secures-the-life] given a life kept inside an app's browser, then the kept sheet adds Open in my browser; kept in the phone's own browser it does not", async () => {
    const account = fakeAccount({ view: () => Promise.resolve(accountView({ state: "secured" })) });
    await signedInGuest(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} kept="google" agent={ANDROID_WHATSAPP} />);
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    expect(screen.getByRole("link", { name: say("ui.account.in-app.open") })).toBeDefined();
  });

  test("[account:guest-secures-the-life] given a life kept in the phone's own browser, then the kept sheet carries no way out", async () => {
    const account = fakeAccount({ view: () => Promise.resolve(accountView({ state: "secured" })) });
    await signedInGuest(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} kept="google" agent={PLAIN_CHROME} />);
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    expect(screen.queryByRole("link", { name: say("ui.account.in-app.open") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.in-app.open") })).toBeNull();
  });

  test("[account:passkey-in-email-autofill] [account:guest-secures-the-life] given the ways back in inside an app's browser, then no passkey is offered: no button, no autofill, not first even where one was used", async () => {
    let asks = 0;
    const account = fakeAccount({ signInWithPasskeyAutofill: () => ((asks += 1), Promise.resolve(OK)) });
    render(<SignIn account={account} onSignedIn={() => undefined} autofill={() => Promise.resolve(true)} passkeyUsed agent={ANDROID_WHATSAPP} href="https://japacity.app/" />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(asks).toBe(0);
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.first") })).toBeNull();
    expect(screen.getByLabelText(say("ui.account.email.label")).getAttribute("autocomplete")).toBe("email");
  });
});

describe("the code form forgives (account:code-form-forgives)", () => {
  function form(over: Partial<AccountApi> = {}) {
    const account = fakeAccount(over);
    const signedIn = vi.fn();
    render(<CodeForm account={account} onSignedIn={signedIn} />);
    return { account, signedIn };
  }

  function sendTo(address: string) {
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: address } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
  }

  test("[account:code-form-forgives] given the email field, then it is named email, not capitalised or spell-checked; an address that is not one's shape is told so and nothing is sent", async () => {
    const { account } = form();
    const field = screen.getByLabelText(say("ui.account.email.label"));
    expect(field.getAttribute("name")).toBe("email");
    expect(field.getAttribute("autocapitalize")).toBe("none");
    expect(field.getAttribute("spellcheck")).toBe("false");
    sendTo("ada@");
    expect(await screen.findByText(say("ui.account.email.shape"))).toBeDefined();
    expect(account.calls).toEqual([]);
  });

  test("[account:code-form-forgives] given a code sent, then the code field takes the focus, the line says where it went with the spam hint, and Wrong email? Change it goes back with the address filled", async () => {
    const { account } = form();
    sendTo("ada@exmaple.test");
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    await waitFor(() => expect(document.activeElement).toBe(code));
    expect(screen.getByRole("status").textContent).toBe(say("ui.account.code.sent", { email: "ada@exmaple.test" }));
    expect(screen.getByText(say("ui.account.code.spam"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.change") }));
    const email = await screen.findByLabelText(say("ui.account.email.label"));
    expect((email as HTMLInputElement).value).toBe("ada@exmaple.test");
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(account.calls).toEqual(['sendCode("ada@exmaple.test")']);
  });

  test("[account:code-form-forgives] given a code pasted with a space in it, then all six digits stay and it goes by itself, once", async () => {
    const { account, signedIn } = form();
    sendTo("ada@example.test");
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    expect(code.getAttribute("maxlength")).toBeNull();
    expect(code.getAttribute("pattern")).toBe("\\d{6}");
    expect(code.getAttribute("autocomplete")).toBe("one-time-code");
    fireEvent.change(code, { target: { value: "123 456" } });
    expect((code as HTMLInputElement).value).toBe("123456");
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.go") }));
    await waitFor(() => expect(signedIn).toHaveBeenCalledOnce());
    expect(account.calls).toEqual(['sendCode("ada@example.test")', 'signInWithCode("ada@example.test","123456")']);
  });

  test("[account:code-form-forgives] given a code sent, then Send a new code waits 30 seconds, counting down; after a new one the line says to use the newest", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { account } = form();
    sendTo("ada@example.test");
    await screen.findByLabelText(say("ui.account.code.label"));
    const again = screen.getByRole("button", { name: say("ui.account.code.again.wait", { seconds: String(RESEND_WAIT_S) }) });
    expect((again as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("button", { name: say("ui.account.code.again.wait", { seconds: String(RESEND_WAIT_S - 1) }) })).toBeDefined();
    for (let second = 1; second < RESEND_WAIT_S; second += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }
    const ready = screen.getByRole("button", { name: say("ui.account.code.again") });
    expect((ready as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(ready);
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe(say("ui.account.code.resent", { email: "ada@example.test" })));
    expect(say("ui.account.code.resent", { email: "x" })).toContain("Use the newest code.");
    expect(account.calls).toEqual(['sendCode("ada@example.test")', 'sendCode("ada@example.test")']);
  });

  test("[account:code-form-forgives] given the line that says where the code went, then it is one live region mounted before the code is sent", () => {
    form();
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });
});

describe("the passkey in the email field's autofill (account:passkey-in-email-autofill)", () => {
  const can = () => Promise.resolve(true);
  const cannot = () => Promise.resolve(false);

  test("[account:passkey-in-email-autofill] given a browser that offers passkeys in autofill, then the email field asks for them, the ask starts once, and a passkey picked there signs in and marks this browser", async () => {
    let asks = 0;
    const account = fakeAccount({ signInWithPasskeyAutofill: () => ((asks += 1), Promise.resolve(OK)) });
    const signedIn = vi.fn();
    render(<SignIn account={account} onSignedIn={signedIn} autofill={can} passkeyUsed={false} />);
    expect(screen.getByLabelText(say("ui.account.email.label")).getAttribute("autocomplete")).toBe("username webauthn");
    await waitFor(() => expect(signedIn).toHaveBeenCalledWith("passkey"));
    expect(asks).toBe(1);
    expect(passkeyHere()).toBe(true);
    expect(localStorage.getItem(PASSKEY_MARK_KEY)).toBe("1");
  });

  test("[account:passkey-in-email-autofill] given a browser that cannot, then no autofill ask is made and the passkey button stays", async () => {
    let asks = 0;
    const account = fakeAccount({ signInWithPasskeyAutofill: () => ((asks += 1), Promise.resolve(OK)) });
    render(<SignIn account={account} onSignedIn={() => undefined} autofill={cannot} passkeyUsed={false} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(asks).toBe(0);
    expect(screen.getByRole("button", { name: say("ui.account.passkey") })).toBeDefined();
  });

  test("[account:passkey-in-email-autofill] given an autofill ask cancelled or refused, then nothing is said", async () => {
    const account = fakeAccount({ signInWithPasskeyAutofill: () => Promise.resolve({ ok: false, why: "cancelled" }) });
    const signedIn = vi.fn();
    render(<SignIn account={account} onSignedIn={signedIn} autofill={can} passkeyUsed={false} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(signedIn).not.toHaveBeenCalled();
  });

  test("[account:passkey-in-email-autofill] given a passkey used in this browser before, then Sign in with a passkey comes first, before Google, as wide as the sheet; the quiet button goes", async () => {
    const account = fakeAccount();
    const signedIn = vi.fn();
    render(<SignIn account={account} onSignedIn={signedIn} autofill={cannot} passkeyUsed agent={PLAIN_CHROME} />);
    const first = screen.getByRole("button", { name: say("ui.account.passkey.first") });
    const google = screen.getByRole("button", { name: say("ui.account.google") });
    expect(first.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first.className).toMatch(/\bw-full\b/);
    expect(screen.queryByRole("button", { name: say("ui.account.passkey") })).toBeNull();
    fireEvent.click(first);
    await waitFor(() => expect(signedIn).toHaveBeenCalledWith("passkey"));
  });

  test("[account:passkey-in-email-autofill] given the passkey button used, then this browser is marked and the next ways back in put the passkey first", async () => {
    gate(fakeAccount({ ageStatus: () => Promise.resolve("passed") }));
    fireEvent.click(await button("ui.account.start.returning"));
    fireEvent.click(await button("ui.account.passkey"));
    await waitFor(() => expect(passkeyHere()).toBe(true));
  });
});

describe("the bot check and the cookie say what is wrong (account:bot-check-on-guest-creation)", () => {
  const inside = (account: AccountApi, turnstile: ReturnType<typeof fakeTurnstile>) => gate(account, { turnstile, embedded: true, botWaitMs: 50 });

  async function begin() {
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "ada_lagos" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.go") }));
  }

  test("[account:bot-check-on-guest-creation] given the check's script that could not load, then Begin says so in its own words, and the script is asked for again on the next Begin", async () => {
    const turnstile = fakeTurnstile({ loads: (attempt) => attempt > 3 });
    const account = fakeAccount({ ageStatus: () => Promise.resolve("passed"), startGuest: (_name, bot) => Promise.resolve(bot === null ? { ok: false, why: "bot-check" } : { ok: true }) });
    const store = inside(account, turnstile);
    await waitFor(() => expect(turnstile.attempts()).toBeGreaterThanOrEqual(2));
    await begin();
    expect(await screen.findByText(say("ui.account.bot.unloaded"))).toBeDefined();
    const before = turnstile.attempts();
    await begin();
    await waitFor(() => expect(turnstile.attempts()).toBeGreaterThan(before));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
  });

  test("[account:bot-check-on-guest-creation] given a widget that errs in this browser, then Begin says to reload or try another browser, not to try again", async () => {
    const turnstile = fakeTurnstile({ pass: false, onRender: (options) => setTimeout(() => options["error-callback"]("300030"), 0) });
    inside(fakeAccount({ ageStatus: () => Promise.resolve("passed"), startGuest: () => Promise.resolve({ ok: false, why: "bot-check" }) }), turnstile);
    await begin();
    expect(await screen.findByText(say("ui.account.bot.error"))).toBeDefined();
  });

  test("[account:bot-check-on-guest-creation] given Cloudflare needs a tap, then the widget is brought into view", async () => {
    const scrolled = vi.fn();
    const before = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
    Element.prototype.scrollIntoView = scrolled;
    onTestFinished(() => {
      if (before === undefined) Reflect.deleteProperty(Element.prototype, "scrollIntoView");
      else Object.defineProperty(Element.prototype, "scrollIntoView", before);
    });
    const turnstile = fakeTurnstile({ pass: false, onRender: (options) => setTimeout(() => options["before-interactive-callback"]?.(), 0) });
    inside(fakeAccount({ ageStatus: () => Promise.resolve("passed") }), turnstile);
    await waitFor(() => expect(scrolled).toHaveBeenCalled());
    expect((scrolled.mock.contexts[0] as Element).hasAttribute("data-turnstile")).toBe(true);
  });

  test("[account:bot-check-on-guest-creation] given the age answer found gone twice in a row, then the age screen says the browser is not keeping the sign-in; the first time only that the answer ran out", async () => {
    const account = fakeAccount({ ageStatus: () => Promise.resolve("passed"), startGuest: () => Promise.resolve({ ok: false, why: "expired" }) });
    inside(account, fakeTurnstile());
    await begin();
    expect(await screen.findByText(say("ui.account.guest.expired"))).toBeDefined();
    await answerAge("1990-05-01");
    await begin();
    expect(await screen.findByText(say("ui.account.cookies"))).toBeDefined();
    expect(say("ui.account.cookies")).toBe("This browser is not keeping the game's sign-in. Private browsing or blocked cookies can do this. Open Japacity in Chrome or Safari, or allow cookies for this site.");
  });

  test("[account:bot-check-on-guest-creation] given a browser with cookies off, then the age screen says so at once", async () => {
    vi.stubGlobal("navigator", { ...navigator, cookieEnabled: false, userAgent: navigator.userAgent });
    gate(fakeAccount());
    fireEvent.click(await button("ui.account.start.play"));
    expect(await screen.findByText(say("ui.account.cookies"))).toBeDefined();
  });
});

describe("the ways back in handed over (account:guest-secures-the-life)", () => {
  test("[account:guest-secures-the-life] given the ways back in asked for with an address, then the gate opens on them with it filled in, once", async () => {
    askWaysBackIn("ada@example.test");
    gate(fakeAccount());
    const field = await screen.findByLabelText(say("ui.account.email.label"));
    expect((field as HTMLInputElement).value).toBe("ada@example.test");
    const sheet = document.querySelector("[data-sign-in]");
    expect(sheet).not.toBeNull();
    expect(within(sheet as HTMLElement).getByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
  });
});
