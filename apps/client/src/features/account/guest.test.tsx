import type { AccountView } from "@japacity/api";
import { content } from "@japacity/content";
import { time, type Id, type PlayerView } from "@japacity/sim";
import { start } from "@japacity/sim/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { heardBody } from "../../shared/net/guest";
import { engineView } from "../../shared/testing/fixtures";
import { PASSKEY_MARK_KEY, PASSKEY_OFFERED_KEY, secureAskedKey } from "../../shared/storage/storage";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { CHECK_AFTER_MS } from "./GuestStart";
import { browserLink, inAppBrowser } from "./inApp";
import { askMoment, GuestReminder, SecureAsk, SecureSheet } from "./Secure";
import { AccountSettings } from "./Settings";
import { loadLaterWords } from "../../shared/words/later";

// The account sheet's words ride a chunk of their own (engine:first-download-has-budget): added before the sheet is drawn, as its row adds them before it opens.
beforeAll(() => loadLaterWords("sheet"));

const OK: AuthResult = { ok: true };

let made = 0;

/** A fresh account id each time: an ask is made once per account and moment. */
function me(state: AccountView["state"], over: Partial<AccountView> = {}): AccountView {
  made += 1;
  return { id: `account-${String(made)}`, country: "NG", age: { passed: true, method: "declared" }, createdAt: 1, character: "c-1", sendUsageCounts: true, admin: false, state, username: "ada_lagos", renameFrom: 0, ways: state === "guest" ? { google: null, email: null, passkeys: 0 } : { google: null, email: "ada@example.com", passkeys: 0 }, ...over };
}

function fakeAccount(view: AccountView, over: Partial<AccountApi> = {}): AccountApi & { calls: string[] } {
  const calls: string[] = [];
  let held = view;
  return {
    calls,
    ageStatus: () => Promise.resolve("passed"),
    declareAge: () => Promise.resolve("passed"),
    usernameFree: () => Promise.resolve(null),
    startGuest: () => Promise.resolve({ ok: true }),
    view: () => (calls.push("view()"), Promise.resolve(held)),
    rename: (username) => (calls.push(`rename(${JSON.stringify(username)})`), (held = { ...held, username }), Promise.resolve({ ok: true })),
    sendCode: (email) => (calls.push(`sendCode(${JSON.stringify(email)})`), Promise.resolve(OK)),
    signInWithCode: (email, code) => (calls.push(`signInWithCode(${JSON.stringify(email)},${JSON.stringify(code)})`), (held = { ...held, state: "secured" }), Promise.resolve(OK)),
    dropNewLife: () => (calls.push("dropNewLife()"), Promise.resolve()),
    signInWithGoogle: () => (calls.push("signInWithGoogle()"), Promise.resolve(OK)),
    returnedFromGoogle: () => null,
    signInWithPasskey: () => Promise.resolve(OK),
    addPasskey: () => Promise.resolve(OK),
    email: () => Promise.resolve(null),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    deleteAccount: () => Promise.resolve(OK),
    signOut: () => (calls.push("signOut()"), Promise.resolve(OK)),
    signOutEverywhere: () => (calls.push("signOutEverywhere()"), Promise.resolve(OK)),
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: () => Promise.resolve({ ok: true, signedIn: true }),
    confirmWithPasskey: () => Promise.resolve(OK),
    ...over,
  };
}

function withChapter(view: PlayerView, done: Id<"chapter">[], current: Id<"chapter"> | null = view.chapter.current): PlayerView {
  return { ...view, chapter: { ...view.chapter, done, current } };
}

async function mount(account: AccountApi, ui: React.ReactElement, view: PlayerView = engineView(), earlyWin = false): Promise<GameStore> {
  const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) }, { account });
  await store.getState().refresh();
  store.setState({ earlyWin, moments: [], reportOpen: false });
  render(<GameProvider store={store}>{ui}</GameProvider>);
  return store;
}

const ANDROID_WHATSAPP = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1";
const IPHONE_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0";
const PLAIN_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";

describe("the in-app browsers", () => {
  test("[account:guest-secures-the-life] given the user agents of WhatsApp, X, Instagram, TikTok and Facebook's browser, then each is in-app; the phone's own browsers are not", () => {
    for (const agent of [ANDROID_WHATSAPP, IPHONE_INSTAGRAM, "Mozilla/5.0 (iPhone) Mobile Twitter for iPhone", "Mozilla/5.0 (Linux; Android 13) musical_ly_2023", "Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/400.0]"]) {
      expect(inAppBrowser(agent)).toBe(true);
    }
    for (const agent of [PLAIN_CHROME, "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1"]) expect(inAppBrowser(agent)).toBe(false);
  });

  test("[account:guest-secures-the-life] given an in-app browser, then Android gets a link that opens Chrome at the same address, the plain address where Chrome is not there, and an iPhone none", () => {
    expect(browserLink("https://japacity.test/?x=1", ANDROID_WHATSAPP)).toBe("intent://japacity.test/?x=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fjapacity.test%2F%3Fx%3D1;end");
    expect(browserLink("https://japacity.test/", IPHONE_INSTAGRAM)).toBeNull();
  });
});

describe("the securing sheet", () => {
  test("[account:guest-secures-the-life] given a guest in the phone's own browser where no passkey can be made, then Google comes first, and an emailed code keeps the life and says so", async () => {
    const account = fakeAccount(me("guest"), { passkeysWork: () => Promise.resolve(false) });
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={PLAIN_CHROME} />);
    const buttons = screen.getAllByRole("button").map((button) => button.textContent);
    expect(buttons.indexOf(say("ui.secure.google"))).toBeLessThan(buttons.indexOf(say("ui.secure.code.send")));
    expect(screen.getByText(say("ui.secure.why"))).toBeDefined();
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    expect(account.calls).toEqual(['sendCode("ada@example.test")', 'signInWithCode("ada@example.test","123456")', "view()"]);
    // Kept where no passkey can be made, the sheet says only that: the kept heading, the one line and the close, with no
    // reason, Google, email, passkey step or Not now.
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: say("ui.secure.done.title") })).toBeDefined();
    expect(within(sheet).queryByText(say("ui.secure.title"))).toBeNull();
    expect(within(sheet).queryByText(say("ui.secure.why"))).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.google") })).toBeNull();
    expect(within(sheet).queryByLabelText(say("ui.account.email.label"))).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.later") })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(within(sheet).queryByRole("heading", { name: say("ui.account.passkey.card.title") })).toBeNull();
    expect(within(sheet).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([say("ui.report.close")]);
  });

  test("[account:guest-secures-the-life] [account:code-form-forgives] given the email way chosen, when the code is sent, then the reason, Google and Or with your email step back, and the address, the code field, Save and a quiet Not now remain", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={say("ui.secure.ask.first-month")} agent={PLAIN_CHROME} />);
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    expect(await screen.findByLabelText(say("ui.account.code.label"))).toBeDefined();
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText(say("ui.secure.title"))).toBeDefined();
    expect(within(sheet).queryByText(say("ui.secure.ask.first-month"))).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.google") })).toBeNull();
    expect(within(sheet).queryByText(say("ui.secure.or"))).toBeNull();
    expect(within(sheet).getByText(/ada@example\.test/)).toBeDefined();
    expect(within(sheet).getByRole("button", { name: say("ui.secure.code.go") })).toBeDefined();
    const later = within(sheet).getByRole("button", { name: say("ui.secure.later") });
    expect(later.className).toContain("underline");
    expect(later.className).not.toContain("bg-accent");
    // Change goes back to the address, and the first step stands whole again with Google first.
    fireEvent.click(within(sheet).getByRole("button", { name: say("ui.account.code.change") }));
    expect(await within(sheet).findByRole("button", { name: say("ui.secure.google") })).toBeDefined();
    expect(within(sheet).getByText(say("ui.secure.ask.first-month"))).toBeDefined();
    expect(within(sheet).getByText(say("ui.secure.or"))).toBeDefined();
  });

  test("[account:guest-secures-the-life] [text:show-then-tell] given the save sheet's reasons, then the plain one and the visa ask's are one sentence each, and the first month's is two short ones", () => {
    const sentences = (line: string) => line.split(/[.?]\s+|[.?]$/).filter((part) => part.trim() !== "").length;
    expect(sentences(say("ui.secure.why"))).toBe(1);
    expect(sentences(say("ui.secure.ask.visa"))).toBe(1);
    expect(sentences(say("ui.secure.ask.first-month"))).toBe(2);
  });

  test("[account:guest-secures-the-life] given the first month's ask, when the life is kept by the emailed code, then the ask's reason goes with the rest and the kept state stands alone", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={say("ui.secure.ask.first-month")} agent={PLAIN_CHROME} />);
    expect(screen.getByText(say("ui.secure.ask.first-month"))).toBeDefined();
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    expect(screen.queryByText(say("ui.secure.ask.first-month"))).toBeNull();
    expect(screen.getByRole("heading", { name: say("ui.secure.done.title") })).toBeDefined();
  });

  test("[account:guest-secures-the-life] given a guest in the phone's own browser, then Google is offered on Google's own button: the G as Google gives it at the left, one of Google's texts, and the game's voice kept for the sheet", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={PLAIN_CHROME} />);
    const google = screen.getByRole("button", { name: say("ui.secure.google") });
    expect(google.getAttribute("data-google-button")).not.toBeNull();
    expect(google.className).toContain("google-button");
    expect(google.firstElementChild?.getAttribute("src")).toBe("/brand/google-g.svg");
    expect(say("ui.secure.google")).toBe("Continue with Google");
    expect(screen.getByText(say("ui.secure.title"))).toBeDefined();
    expect(screen.getByText(say("ui.secure.or"))).toBeDefined();
  });

  test("[account:start-screen-over-live-city] [account:guest-secures-the-life] given the save sheet, then no lockup stands on it: its title heads it, so Google and the email field stand higher", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={PLAIN_CHROME} />);
    expect(screen.getByText(say("ui.secure.title"))).toBeDefined();
    expect(screen.queryAllByRole("img", { name: say("ui.game") })).toEqual([]);
    expect(document.querySelector('img[src*="japacity-lockup"]')).toBeNull();
  });

  test("[account:guest-secures-the-life] given an in-app browser, then Google is not shown and the life is kept here by the code alone: no way out to another browser, where the life is not", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={ANDROID_WHATSAPP} />);
    expect(screen.queryByRole("button", { name: say("ui.secure.google") })).toBeNull();
    expect(screen.getByText(say("ui.secure.in-app"))).toBeDefined();
    expect(say("ui.secure.in-app")).toBe("Google does not open inside this app. Save this life with your email here, then open it in any browser.");
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.in-app.copy") })).toBeNull();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });

  test("[account:guest-secures-the-life] given an email that already has a life, when the code is typed, then the player is told it is taken and the life stays a guest's", async () => {
    const account = fakeAccount(me("guest"), { signInWithCode: () => Promise.resolve({ ok: false, why: "taken" }) });
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={PLAIN_CHROME} />);
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.account.fail.taken"))).toBeDefined();
    expect(screen.queryByText(say("ui.secure.done"))).toBeNull();
  });
});

describe("the Kept state's next step (account:passkey-offered-where-it-works)", () => {
  beforeEach(() => {
    localStorage.removeItem(PASSKEY_OFFERED_KEY);
    localStorage.removeItem(PASSKEY_MARK_KEY);
  });

  /** The life kept by the emailed code on the sheet the asks open. */
  async function keptByCode(account: AccountApi, agent = PLAIN_CHROME, closed: boolean[] = []): Promise<HTMLElement> {
    await mount(account, <SecureSheet account={account} open onOpenChange={(open) => closed.push(open)} reason={null} agent={agent} />);
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    return screen.getByRole("dialog");
  }

  test("[account:passkey-offered-where-it-works] [account:guest-secures-the-life] given a guest in a browser that can make a passkey, when the life is kept by the emailed code, then the Kept state says Saved and its line, then Sign in faster next time with Add a passkey as its main button and Not now, and the device is marked as offered", async () => {
    const sheet = await keptByCode(fakeAccount(me("guest")));
    const step = await within(sheet).findByRole("heading", { name: say("ui.account.passkey.card.title") });
    expect(say("ui.account.passkey.card.title")).toBe("Sign in faster next time");
    expect(within(sheet).getByRole("heading", { name: say("ui.secure.done.title") })).toBeDefined();
    expect(within(sheet).getByText(say("ui.account.passkey.card.line"))).toBeDefined();
    // Saved first, then the step under it.
    expect(within(sheet).getByText(say("ui.secure.done")).compareDocumentPosition(step) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const add = within(sheet).getByRole("button", { name: say("ui.account.passkey.add") });
    const later = within(sheet).getByRole("button", { name: say("ui.account.passkey.later") });
    expect(add.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(localStorage.getItem(PASSKEY_OFFERED_KEY)).not.toBeNull();
    expect(within(sheet).queryByText(say("ui.secure.why"))).toBeNull();
    expect(within(sheet).queryByLabelText(say("ui.account.email.label"))).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given the Kept state's step, when Not now is pressed, then the sheet closes and nothing is made", async () => {
    const closed: boolean[] = [];
    const calls: string[] = [];
    const sheet = await keptByCode(fakeAccount(me("guest"), { addPasskey: () => (calls.push("addPasskey()"), Promise.resolve(OK)) }), PLAIN_CHROME, closed);
    fireEvent.click(await within(sheet).findByRole("button", { name: say("ui.account.passkey.later") }));
    expect(closed).toEqual([false]);
    expect(calls).toEqual([]);
  });

  test("[account:passkey-offered-where-it-works] [account:passkey-added-in-place] given the Kept state's step, when Add a passkey is pressed, then the passkey is made at once, the step says it is added and the passkey mark is set", async () => {
    const calls: string[] = [];
    const sheet = await keptByCode(fakeAccount(me("guest"), { addPasskey: () => (calls.push("addPasskey()"), Promise.resolve(OK)) }));
    fireEvent.click(await within(sheet).findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await within(sheet).findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(calls).toEqual(["addPasskey()"]);
    expect(localStorage.getItem(PASSKEY_MARK_KEY)).toBe("1");
    expect(within(sheet).queryByRole("button", { name: say("ui.account.passkey.add") })).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.account.passkey.later") })).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] [account:passkey-errors-told-apart] given the Kept state's step, when the passkey prompt is cancelled, then nothing is said and the step stands; another failure is told in the step in its own words", async () => {
    const cancelled = await keptByCode(fakeAccount(me("guest"), { addPasskey: () => Promise.resolve({ ok: false, why: "cancelled" }) }));
    fireEvent.click(await within(cancelled).findByRole("button", { name: say("ui.account.passkey.add") }));
    await waitFor(() => expect(within(cancelled).getByRole("button", { name: say("ui.account.passkey.add") }).hasAttribute("disabled")).toBe(false));
    expect(within(cancelled).queryByRole("alert")).toBeNull();
    expect(within(cancelled).getByRole("button", { name: say("ui.account.passkey.later") })).toBeDefined();
    cleanup();
    localStorage.removeItem(PASSKEY_OFFERED_KEY);
    const here = await keptByCode(fakeAccount(me("guest"), { addPasskey: () => Promise.resolve({ ok: false, why: "already-here" }) }));
    fireEvent.click(await within(here).findByRole("button", { name: say("ui.account.passkey.add") }));
    expect((await within(here).findByRole("alert")).textContent).toBe(say("ui.account.fail.already-here"));
  });

  test("[account:passkey-offered-where-it-works] given the trip to Google came back having kept the life, then its Kept state offers the passkey as its next step too", async () => {
    const account = fakeAccount(me("secured", { ways: { google: "ada@example.com", email: "ada@example.com", passkeys: 0 } }));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} kept="google" agent={PLAIN_CHROME} />);
    const sheet = screen.getByRole("dialog");
    expect(await within(sheet).findByRole("heading", { name: say("ui.account.passkey.card.title") })).toBeDefined();
    expect(within(sheet).getByRole("button", { name: say("ui.account.passkey.add") })).toBeDefined();
  });

  test("[account:passkey-offered-where-it-works] given an account that holds a passkey, a device offered one before, or a browser that cannot make one, then the Kept state offers no passkey", async () => {
    const held = await keptByCode(fakeAccount(me("guest"), { signInWithCode: () => Promise.resolve(OK), view: () => Promise.resolve(me("secured", { ways: { google: null, email: "ada@example.test", passkeys: 1 } })) }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(within(held).queryByRole("heading", { name: say("ui.account.passkey.card.title") })).toBeNull();
    cleanup();
    localStorage.setItem(PASSKEY_OFFERED_KEY, "1");
    const offered = await keptByCode(fakeAccount(me("guest")));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(within(offered).queryByRole("heading", { name: say("ui.account.passkey.card.title") })).toBeNull();
    cleanup();
    localStorage.removeItem(PASSKEY_OFFERED_KEY);
    const cannot = await keptByCode(fakeAccount(me("guest"), { passkeysWork: () => Promise.resolve(false) }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(within(cannot).queryByRole("heading", { name: say("ui.account.passkey.card.title") })).toBeNull();
    expect(localStorage.getItem(PASSKEY_OFFERED_KEY)).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] [account:guest-secures-the-life] given an in-app browser, when the life is kept by the code, then the Kept state offers Open in my browser and no passkey", async () => {
    const sheet = await keptByCode(fakeAccount(me("guest")), ANDROID_WHATSAPP);
    expect(await within(sheet).findByRole("link", { name: say("ui.account.in-app.open") })).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(within(sheet).queryByRole("heading", { name: say("ui.account.passkey.card.title") })).toBeNull();
    expect(localStorage.getItem(PASSKEY_OFFERED_KEY)).toBeNull();
  });
});

describe("when the asks come", () => {
  /** A life with its first month played: the month's results told, as the authority answers after the first Sleep. */
  const firstMonth = (): PlayerView => {
    const game = start({ scenario: "scenario.banker", content });
    game.grant(1);
    game.endTurn();
    return game.view();
  };
  const firstLine = () => screen.queryByText(say("ui.secure.ask.first-month"));

  test("[account:guest-secures-the-life] given the view, then a month played is the first moment and the decision-day chapter the visa one; before any month is played there is none, the first chapter done or not", () => {
    expect(engineView().month).toBe(0);
    expect(askMoment(withChapter(engineView(), [], "chapter.find-your-feet"))).toBeNull();
    expect(askMoment(withChapter(engineView(), ["chapter.find-your-feet"], "chapter.build-the-file"))).toBeNull();
    expect(firstMonth().month).toBe(1);
    expect(askMoment(firstMonth())).toBe("first-month");
    expect(askMoment(withChapter(firstMonth(), ["chapter.find-your-feet", "chapter.build-the-file"], "chapter.decision-day"))).toBe("visa");
    expect(askMoment(null)).toBeNull();
  });

  test("[account:guest-secures-the-life] given a guest whose first month has ended, when its results are still open, then nothing is asked; once they are closed, the ask opens with the first month's reason, and closing the next month's results asks nothing again", async () => {
    const account = fakeAccount(me("guest"));
    // The month's end as the store holds it: the report opens with the view it reports on.
    const view = firstMonth();
    const store = createGameStore({ view: () => Promise.resolve(view), send: () => Promise.reject(new Error("unused")) }, { account });
    await store.getState().refresh();
    store.setState({ earlyWin: true, moments: [], reportOpen: true });
    render(<GameProvider store={store}><SecureAsk /></GameProvider>);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(firstLine()).toBeNull();
    act(() => store.setState({ reportOpen: false }));
    expect(await screen.findByText(say("ui.secure.ask.first-month"))).toBeDefined();
    expect(screen.getByRole("dialog", { name: say("ui.secure.title") })).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.later") }));
    await waitFor(() => expect(firstLine()).toBeNull());
    act(() => store.setState({ reportOpen: true }));
    act(() => store.setState({ reportOpen: false }));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(firstLine()).toBeNull();
  });

  test("[account:guest-secures-the-life] [guide:nothing-asked-before-early-win] given a guest past its first month but not its early win, then nothing is asked; once the win is in, the ask opens once", async () => {
    const view = me("guest");
    const account = fakeAccount(view);
    const store = await mount(account, <SecureAsk />, firstMonth(), false);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(firstLine()).toBeNull();
    act(() => store.setState({ earlyWin: true }));
    expect(await screen.findByText(say("ui.secure.ask.first-month"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.later") }));
    await waitFor(() => expect(firstLine()).toBeNull());
    act(() => store.setState({ reportOpen: true }));
    act(() => store.setState({ reportOpen: false }));
    expect(firstLine()).toBeNull();
  });

  test("[account:guest-secures-the-life] [guide:nothing-asked-before-early-win] given a guest whose first chapter is done before any month is played, then nothing is asked until a month's results are closed", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureAsk />, withChapter(engineView(), ["chapter.find-your-feet"], "chapter.build-the-file"), true);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[account:guest-secures-the-life] given a life that holds the first chapter's mark of the ask, when its first month is played, then the first month's ask is not made again", async () => {
    const view = me("guest");
    localStorage.setItem(secureAskedKey(view.id, "first-chapter"), "1");
    const account = fakeAccount(view);
    await mount(account, <SecureAsk />, firstMonth(), true);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(firstLine()).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("[account:guest-secures-the-life] given a chapter's card up over the world when the first ask is due, then the ask waits and opens once the card is gone", async () => {
    const card = document.createElement("div");
    card.setAttribute("role", "dialog");
    card.setAttribute("data-open", "");
    document.body.append(card);
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureAsk />, firstMonth(), true);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(firstLine()).toBeNull();
    card.remove();
    expect(await screen.findByText(say("ui.secure.ask.first-month"), undefined, { timeout: 2000 })).toBeDefined();
  });

  test("[account:guest-secures-the-life] [chapter:first-chapter-mission-card] given a brief's card still waiting for the place's first frame when the first ask is due, then the ask waits for the card as for an open sheet and opens once the card is handed", async () => {
    const pending = document.createElement("span");
    pending.setAttribute("data-brief-pending", "");
    document.body.append(pending);
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureAsk />, firstMonth(), true);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(firstLine()).toBeNull();
    pending.remove();
    expect(await screen.findByText(say("ui.secure.ask.first-month"), undefined, { timeout: 2000 })).toBeDefined();
  });

  test("[account:guest-secures-the-life] given a guest reaching the decision-day chapter after its win, then the visa ask opens; a secured account is never asked", async () => {
    const decision = withChapter(engineView(), ["chapter.find-your-feet", "chapter.build-the-file"], "chapter.decision-day");
    const guest = fakeAccount(me("guest"));
    await mount(guest, <SecureAsk />, decision, true);
    expect(await screen.findByText(say("ui.secure.ask.visa"))).toBeDefined();
    cleanup();
    const kept = fakeAccount(me("secured"));
    await mount(kept, <SecureAsk />, decision, true);
    await waitFor(() => expect(kept.calls).toContain("view()"));
    expect(screen.queryByText(say("ui.secure.ask.visa"))).toBeNull();
  });

  test("[account:social-needs-secured-account] given a guest-only refusal from any route, then the securing sheet opens with what to do, never a dead end", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureAsk />);
    act(() => heardBody({ ok: false, code: "guest-only", detail: "Secure this life with Google or an email code to buy lottery tickets." }));
    expect(await screen.findByText(say("reject.guest-only"))).toBeDefined();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });

  test("[account:guest-secures-the-life] given Google came back saying the method is taken, then the sheet opens and says so", async () => {
    const account = fakeAccount(me("guest"), { returnedFromGoogle: () => "taken" });
    await mount(account, <SecureAsk />);
    expect(await screen.findByText(say("ui.account.fail.taken"))).toBeDefined();
  });

  test("[account:guest-secures-the-life] given Google came back to the save sheet refused by the player or with a trip that did not finish, then the sheet opens and says it at its top, above Google's button, in the game's words", async () => {
    for (const [why, key] of [
      ["cancelled", "ui.account.fail.cancelled"],
      ["google", "ui.account.fail.google"],
    ] as const) {
      const account = fakeAccount(me("guest"), { returnedFromGoogle: () => why });
      await mount(account, <SecureAsk />);
      const sheet = await screen.findByRole("dialog", { name: say("ui.secure.title") });
      const said = within(sheet).getByText(say(key));
      expect(said.getAttribute("role")).toBe("alert");
      const google = within(sheet).getByRole("button", { name: say("ui.secure.google") });
      expect(said.compareDocumentPosition(google) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      cleanup();
    }
  });
});

describe("the quiet lines", () => {
  test("[account:guest-reminded-to-secure] given a guest, then the month report's line shows only after the first chapter, and never for a secured account", async () => {
    const before = fakeAccount(me("guest"));
    await mount(before, <GuestReminder afterFirstChapter />, withChapter(engineView(), []));
    await waitFor(() => expect(before.calls).toContain("view()"));
    expect(screen.queryByText(say("ui.guest.reminder"))).toBeNull();
    cleanup();
    await mount(fakeAccount(me("guest")), <GuestReminder afterFirstChapter />, withChapter(engineView(), ["chapter.find-your-feet"]));
    expect(await screen.findByText(say("ui.guest.reminder"))).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.guest.keep") })).toBeDefined();
    cleanup();
    const kept = fakeAccount(me("secured"));
    await mount(kept, <GuestReminder afterFirstChapter />, withChapter(engineView(), ["chapter.find-your-feet"]));
    await waitFor(() => expect(kept.calls).toContain("view()"));
    expect(screen.queryByText(say("ui.guest.reminder"))).toBeNull();
  });

  test("[account:guest-reminded-to-secure] [account:guest-secures-the-life] given a guest's settings, then the reminder shows and no passkey is offered; a secured account sees the passkey and no reminder", async () => {
    const guest = fakeAccount(me("guest"));
    await mount(guest, <AccountSettings account={guest} />);
    expect(await screen.findByText(say("ui.guest.reminder"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.passkey.add") })).toBeNull();
    cleanup();
    const kept = fakeAccount(me("secured"));
    await mount(kept, <AccountSettings account={kept} />);
    expect(await screen.findByRole("button", { name: say("ui.account.passkey.add") })).toBeDefined();
    expect(screen.queryByText(say("ui.guest.reminder"))).toBeNull();
  });
});

describe("deleting a guest life (account:player-deletes-account, account:guest-and-secured-states)", () => {
  test("[account:player-deletes-account] [account:guest-and-secured-states] given a guest, then its sheet has one costly row, Delete my account, and no Sign out: its life ends the same way either way", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <AccountSettings account={account} />);
    await screen.findByText(say("ui.guest.reminder"));
    expect(screen.getAllByRole("button", { name: say("ui.account.delete") })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: say("ui.account.sign-out") })).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.sign-out.all") })).toBeNull();
  });

  test("[account:player-deletes-account] [account:guest-and-secured-states] given a guest, when it deletes its account, then the step says first that this life on this phone ends with nothing of it saved, and only Delete for good inside it deletes the guest, with the deleted notice", async () => {
    const account = fakeAccount(me("guest"), { deleteAccount: (code) => (account.calls.push(`deleteAccount(${JSON.stringify(code)})`), Promise.resolve(OK)) });
    const store = await mount(account, <AccountSettings account={account} />);
    await screen.findByText(say("ui.guest.reminder"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete") }));
    expect(screen.getByRole("heading", { name: say("ui.account.delete") })).toBeDefined();
    expect(screen.getByText(say("ui.account.delete.guest"))).toBeDefined();
    expect(say("ui.account.delete.guest")).toMatch(/only on this phone/);
    expect(say("ui.account.delete.guest")).toMatch(/nothing of it is saved/);
    // A guest's step is its own: not the saved life's warning, which speaks of an account that can sign in.
    expect(screen.queryByText(say("ui.account.delete.warn"))).toBeNull();
    expect(account.calls.filter((call) => call.startsWith("deleteAccount") || call === "signOut()")).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete.confirm") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(true));
    expect(store.getState().accountNotice).toBe("ui.account.notice.deleted");
    expect(account.calls.filter((call) => call.startsWith("deleteAccount") || call === "signOut()")).toEqual(["deleteAccount(null)"]);
  });

  test("[world:costly-acts-confirmed] [account:player-deletes-account] given a guest deleting its account, then Save this life first is the main button and comes first, Delete for good wears the warning colour apart from it, and Save this life first opens the save sheet with the life still here", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <AccountSettings account={account} />);
    await screen.findByText(say("ui.guest.reminder"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.delete") }));
    const save = screen.getByRole("button", { name: say("ui.account.delete.save") });
    const go = screen.getByRole("button", { name: say("ui.account.delete.confirm") });
    expect(save.className).toContain("bg-accent");
    expect(go.className).not.toContain("bg-accent");
    expect(go.className).toContain("text-bad");
    expect(save.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(save.parentElement).not.toBe(go.parentElement);
    fireEvent.click(save);
    expect(await screen.findByRole("dialog", { name: say("ui.secure.title") })).toBeDefined();
    expect(account.calls.filter((call) => call.startsWith("deleteAccount") || call === "signOut()")).toEqual([]);
  });
});

describe("the username in the settings", () => {
  test("[account:username-and-unconfirmed-email] given the free change unused, when a new name is saved, then the server is asked and the new name shows", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <AccountSettings account={account} />);
    expect(await screen.findByText(say("ui.account.name.current", { name: "ada_lagos" }))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change") }));
    expect(screen.getByText(say("ui.account.name.free"))).toBeDefined();
    fireEvent.change(screen.getByLabelText(say("ui.account.name.label")), { target: { value: "Ada_Ibadan" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change.go") }));
    expect(await screen.findByText(say("ui.account.name.changed", { name: "Ada_Ibadan" }))).toBeDefined();
    expect(account.calls).toContain('rename("Ada_Ibadan")');
  });

  test("[account:username-typed-and-checked] given the rename box open, when a name is typed, then the server is asked once the typing rests and the box says free or taken; the player's own name says neither and is never asked", async () => {
    const asked: string[] = [];
    const account = fakeAccount(me("secured"), { usernameFree: (username) => (asked.push(username), Promise.resolve(username === "ada_kano" ? "taken" : "free")) });
    await mount(account, <AccountSettings account={account} />);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.name.change") }));
    const box = screen.getByLabelText(say("ui.account.name.label"));
    const check = () => document.querySelector("[data-rename-check]")?.textContent ?? "";
    // The box opens on the player's own name: nothing said, nothing asked.
    expect((box as HTMLInputElement).value).toBe("ada_lagos");
    // Leaving the rename is the step's plain Back, never the deletion's "Keep my account".
    expect(screen.getByRole("button", { name: say("ui.account.back") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: say("ui.account.delete.keep") })).toBeNull();
    await act(() => new Promise((resolve) => setTimeout(resolve, CHECK_AFTER_MS * 2)));
    expect(asked).toEqual([]);
    expect(check()).toBe("");
    fireEvent.change(box, { target: { value: "ada_ibadan" } });
    await waitFor(() => expect(check()).toBe(say("ui.account.name.available")));
    fireEvent.change(box, { target: { value: "ada_kano" } });
    await waitFor(() => expect(check()).toBe(say("ui.account.name.taken")));
    // Said where a screen reader hears it, as the player types.
    expect(document.querySelector("[data-rename-check]")?.getAttribute("role")).toBe("status");
    // The own name again, in any capitals, says neither free nor taken, and is not asked.
    fireEvent.change(box, { target: { value: "Ada_Lagos" } });
    await act(() => new Promise((resolve) => setTimeout(resolve, CHECK_AFTER_MS * 2)));
    expect(check()).toBe("");
    expect(asked).toEqual(["ada_ibadan", "ada_kano"]);
  });

  test("[account:username-typed-and-checked] given the rename box, when a name is typed fast in pieces, then the server is asked once, for the last; a name not of the rule's shape says so and asks nothing", async () => {
    const asked: string[] = [];
    const account = fakeAccount(me("secured"), { usernameFree: (username) => (asked.push(username), Promise.resolve("free")) });
    await mount(account, <AccountSettings account={account} />);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.name.change") }));
    const box = screen.getByLabelText(say("ui.account.name.label"));
    const check = () => document.querySelector("[data-rename-check]")?.textContent ?? "";
    for (const typed of ["a", "ad", "ada", "ada_", "ada_i", "ada_ib"]) fireEvent.change(box, { target: { value: typed } });
    await waitFor(() => expect(check()).toBe(say("ui.account.name.available")));
    expect(asked).toEqual(["ada_ib"]);
    fireEvent.change(box, { target: { value: "ada ib" } });
    expect(check()).toBe(say("ui.account.name.format"));
    await act(() => new Promise((resolve) => setTimeout(resolve, CHECK_AFTER_MS * 2)));
    expect(asked).toEqual(["ada_ib"]);
  });

  test("[account:username-typed-and-checked] given a name the box said was free, when someone takes it before saving, then saving says taken: saving is the check that counts", async () => {
    const account = fakeAccount(me("secured"), { usernameFree: () => Promise.resolve("free"), rename: () => Promise.resolve({ ok: false, why: "taken" }) });
    await mount(account, <AccountSettings account={account} />);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.name.change") }));
    const box = screen.getByLabelText(say("ui.account.name.label"));
    fireEvent.change(box, { target: { value: "ada_ibadan" } });
    await waitFor(() => expect(document.querySelector("[data-rename-check]")?.textContent).toBe(say("ui.account.name.available")));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change.go") }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", say("ui.account.name.taken"));
    expect(document.querySelector("[data-rename-check]")?.textContent).toBe("");
  });

  test("[account:username-and-unconfirmed-email] given a change made and the wait not over, then no change is offered and the day it opens is said", async () => {
    const until = Date.now() + 5 * time.DAY_MS;
    await mount(fakeAccount(me("secured", { renameFrom: until })), <AccountSettings account={fakeAccount(me("secured", { renameFrom: until }))} />);
    expect(await screen.findByText(/You changed it not long ago/)).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.name.change") })).toBeNull();
  });
});

describe("the free name, read (world:reach-and-read)", () => {
  test("[world:reach-and-read] given a free name typed in the rename box, then it is said in money in's green with a tick, never in the yellow", async () => {
    const account = fakeAccount(me("secured"), { usernameFree: () => Promise.resolve("free") });
    await mount(account, <AccountSettings account={account} />);
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.name.change") }));
    fireEvent.change(screen.getByLabelText(say("ui.account.name.label")), { target: { value: "ada_ibadan" } });
    await waitFor(() => expect(document.querySelector("[data-rename-check]")?.textContent).toBe(say("ui.account.name.available")));
    const line = document.querySelector("[data-rename-check]") as HTMLElement;
    expect(line.className.split(" ")).toContain("text-in");
    expect(line.className).not.toContain("text-action");
    expect(line.querySelector("svg")).not.toBeNull();
  });
});
