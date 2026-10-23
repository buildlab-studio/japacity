import type { AccountView } from "@japacity/api";
import { time, type Id, type PlayerView } from "@japacity/sim";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { heardBody } from "../../shared/net/guest";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { browserLink, inAppBrowser } from "./inApp";
import { askMoment, GuestReminder, SecureAsk, SecureSheet } from "./Secure";
import { AccountSettings } from "./Settings";

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
  test("[account:guest-secures-the-life] given a guest in the phone's own browser, then Google comes first, and an emailed code keeps the life and says so", async () => {
    const account = fakeAccount(me("guest"));
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
    // Kept, the sheet says only that: the kept heading, the one line and the close, with no reason, Google, email or
    // Not now.
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByRole("heading", { name: say("ui.secure.done.title") })).toBeDefined();
    expect(within(sheet).queryByText(say("ui.secure.title"))).toBeNull();
    expect(within(sheet).queryByText(say("ui.secure.why"))).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.google") })).toBeNull();
    expect(within(sheet).queryByLabelText(say("ui.account.email.label"))).toBeNull();
    expect(within(sheet).queryByRole("button", { name: say("ui.secure.later") })).toBeNull();
    expect(within(sheet).getAllByRole("button").map((button) => button.getAttribute("aria-label"))).toEqual([say("ui.report.close")]);
  });

  test("[account:guest-secures-the-life] given the first-chapter ask, when the life is kept by the emailed code, then the ask's reason goes with the rest and the kept state stands alone", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={say("ui.secure.ask.first-chapter")} agent={PLAIN_CHROME} />);
    expect(screen.getByText(say("ui.secure.ask.first-chapter"))).toBeDefined();
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.send") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.code.go") }));
    expect(await screen.findByText(say("ui.secure.done"))).toBeDefined();
    expect(screen.queryByText(say("ui.secure.ask.first-chapter"))).toBeNull();
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

  test("[account:start-screen-over-live-city] [account:guest-secures-the-life] given the keep-this-life sheet, then the wordmark tops it once, above the sheet's title, its words the game's name", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureSheet account={account} open onOpenChange={() => undefined} reason={null} agent={PLAIN_CHROME} />);
    const marks = screen.getAllByRole("img", { name: say("ui.game") });
    expect(marks).toHaveLength(1);
    expect(marks[0]?.getAttribute("alt")).toBe("Japacity");
    expect(marks[0]?.getAttribute("src")).toMatch(/brand\/japacity-lockup-light\.svg$/);
    const title = screen.getByText(say("ui.secure.title"));
    expect(marks[0]!.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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

describe("when the asks come", () => {
  const firstDone = () => withChapter(engineView(), ["chapter.find-your-feet"], "chapter.build-the-file");

  test("[account:guest-secures-the-life] given the view, then the first chapter done is the first moment and the decision-day chapter the visa one; before either there is none", () => {
    expect(askMoment(withChapter(engineView(), [], "chapter.find-your-feet"))).toBeNull();
    expect(askMoment(firstDone())).toBe("first-chapter");
    expect(askMoment(withChapter(engineView(), ["chapter.find-your-feet", "chapter.build-the-file"], "chapter.decision-day"))).toBe("visa");
    expect(askMoment(null)).toBeNull();
  });

  test("[account:guest-secures-the-life] [guide:nothing-asked-before-early-win] given a guest past its first chapter but not its early win, then nothing is asked; once the win is in, the ask opens once", async () => {
    const view = me("guest");
    const account = fakeAccount(view);
    const store = await mount(account, <SecureAsk />, firstDone(), false);
    await waitFor(() => expect(account.calls).toContain("view()"));
    expect(screen.queryByText(say("ui.secure.ask.first-chapter"))).toBeNull();
    act(() => store.setState({ earlyWin: true }));
    expect(await screen.findByText(say("ui.secure.ask.first-chapter"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.secure.later") }));
    await waitFor(() => expect(screen.queryByText(say("ui.secure.ask.first-chapter"))).toBeNull());
    act(() => store.setState({ reportOpen: true }));
    act(() => store.setState({ reportOpen: false }));
    expect(screen.queryByText(say("ui.secure.ask.first-chapter"))).toBeNull();
  });

  test("[account:guest-secures-the-life] given a chapter's card up over the world when the first ask is due, then the ask waits and opens once the card is gone", async () => {
    const card = document.createElement("div");
    card.setAttribute("role", "dialog");
    card.setAttribute("data-open", "");
    document.body.append(card);
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureAsk />, withChapter(engineView(), ["chapter.find-your-feet"]), true);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.queryByText(say("ui.secure.ask.first-chapter"))).toBeNull();
    card.remove();
    expect(await screen.findByText(say("ui.secure.ask.first-chapter"), undefined, { timeout: 2000 })).toBeDefined();
  });

  test("[account:guest-secures-the-life] [chapter:first-chapter-mission-card] given the first brief's card still waiting for the place's first frame when the first ask is due, then the ask waits for the card as for an open sheet and opens once the card is handed", async () => {
    const pending = document.createElement("span");
    pending.setAttribute("data-brief-pending", "");
    document.body.append(pending);
    const account = fakeAccount(me("guest"));
    await mount(account, <SecureAsk />, withChapter(engineView(), ["chapter.find-your-feet"]), true);
    await waitFor(() => expect(account.calls).toContain("view()"));
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(screen.queryByText(say("ui.secure.ask.first-chapter"))).toBeNull();
    pending.remove();
    expect(await screen.findByText(say("ui.secure.ask.first-chapter"), undefined, { timeout: 2000 })).toBeDefined();
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

describe("signing out of a guest life", () => {
  test("[account:guest-and-secured-states] given a guest, when it signs out, then it is told first that the life has no way back, and only a second press signs out", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <AccountSettings account={account} />);
    await screen.findByText(say("ui.guest.reminder"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.sign-out") }));
    expect(screen.getByText(say("ui.guest.sign-out"))).toBeDefined();
    expect(account.calls).not.toContain("signOut()");
    fireEvent.click(screen.getByRole("button", { name: say("ui.guest.sign-out.go") }));
    await waitFor(() => expect(account.calls).toContain("signOut()"));
  });
});

describe("the username in the settings", () => {
  test("[account:username-and-unconfirmed-email] given the free change unused, when a new name is saved, then the server is asked and the new name shows", async () => {
    const account = fakeAccount(me("guest"));
    await mount(account, <AccountSettings account={account} />);
    expect(await screen.findByText(say("ui.account.name.current", { name: "ada_lagos" }))).toBeDefined();
    expect(screen.getByText(say("ui.account.name.free"))).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change") }));
    fireEvent.change(screen.getByLabelText(say("ui.account.name.label")), { target: { value: "Ada_Ibadan" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.change.go") }));
    expect(await screen.findByText(say("ui.account.name.changed", { name: "Ada_Ibadan" }))).toBeDefined();
    expect(account.calls).toContain('rename("Ada_Ibadan")');
  });

  test("[account:username-and-unconfirmed-email] given a change made and the wait not over, then no change is offered and the day it opens is said", async () => {
    const until = Date.now() + 5 * time.DAY_MS;
    await mount(fakeAccount(me("secured", { renameFrom: until })), <AccountSettings account={fakeAccount(me("secured", { renameFrom: until }))} />);
    expect(await screen.findByText(/You changed it not long ago/)).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.name.change") })).toBeNull();
  });
});
