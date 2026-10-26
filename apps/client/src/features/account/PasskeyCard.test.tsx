// The passkey offered right after a way in (account:passkey-offered-where-it-works): the small card that follows the welcome
// line over the world, where a passkey can be made, once per device, never over a sheet or a moment, and what its two
// buttons do.
import type { AccountView } from "@japacity/api";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore, type GameStore } from "../../authority/store";
import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { PASSKEY_MARK_KEY, PASSKEY_OFFERED_KEY } from "../../shared/storage/storage";
import { accountView, engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { loadLaterWords } from "../../shared/words/later";
import { say } from "../../shared/words/text";
import { SAID_TOAST_MS } from "../../shared/world/SaidToast";
import { tellWay, WayToast, type Way } from "./WayToast";

beforeAll(() => loadLaterWords("sheet"));

const OK: AuthResult = { ok: true };
const WHATSAPP = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function fakeAccount(view: AccountView = accountView(), over: Partial<AccountApi> = {}): AccountApi & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
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
    addPasskey: () => (calls.push("addPasskey()"), Promise.resolve(OK)),
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
    ...over,
  };
}

async function world(account: AccountApi, extra: React.ReactNode = null): Promise<GameStore> {
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  await store.getState().refresh();
  store.setState({ earlyWin: true, moments: [], reportOpen: false });
  render(
    <GameProvider store={store}>
      <WayToast account={account} />
      {extra}
    </GameProvider>,
  );
  return store;
}

/** The way's welcome line told and gone, as the world tells it once a way in is done. */
async function told(account: AccountApi, way: Way): Promise<void> {
  act(() => tellWay(account, way));
  expect(document.querySelector("[data-way-toast]")).not.toBeNull();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SAID_TOAST_MS);
  });
}

const card = () => document.querySelector<HTMLElement>("[data-passkey-card]");

/** Long enough for the card's fetch and its looks at the screen to have shown it, were it due. */
async function settled(): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1500);
  });
}

describe("the card after a way in (account:passkey-offered-where-it-works)", () => {
  test("[account:passkey-offered-where-it-works] given a guest that kept its life by the code, once the welcome line has been told, then the card follows it with its title, line, Add a passkey as the main button and Not now, and the offer is marked on this device", async () => {
    const account = fakeAccount();
    await world(account);
    await told(account, "kept.email");
    const shown = await screen.findByText(say("ui.account.passkey.card.title"));
    expect(card()?.contains(shown)).toBe(true);
    expect(say("ui.account.passkey.card.title")).toBe("Sign in faster next time");
    expect(say("ui.account.passkey.card.line")).toBe("Use your face, fingerprint or screen lock instead of a code.");
    expect(screen.getByText(say("ui.account.passkey.card.line"))).toBeDefined();
    const add = screen.getByRole("button", { name: say("ui.account.passkey.add") });
    expect(add.className).toMatch(/\bbg-accent\b/);
    const later = screen.getByRole("button", { name: say("ui.account.passkey.later") });
    expect(add.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(localStorage.getItem(PASSKEY_OFFERED_KEY)).not.toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given the welcome line still up, then the card waits for it to be told", async () => {
    const account = fakeAccount();
    await world(account);
    act(() => tellWay(account, "kept.google"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SAID_TOAST_MS - 500);
    });
    expect(card()).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(await screen.findByText(say("ui.account.passkey.card.title"))).toBeDefined();
  });

  test.each<Way>(["kept.google", "kept.email", "in.google", "in.email"])("[account:passkey-offered-where-it-works] given the way %s and an account with no passkey, then the card follows its line", async (way) => {
    const account = fakeAccount();
    await world(account);
    await told(account, way);
    expect(await screen.findByText(say("ui.account.passkey.card.title"))).toBeDefined();
  });

  test("[account:passkey-offered-where-it-works] given a sign-in by passkey, then nothing is offered", async () => {
    const account = fakeAccount();
    await world(account);
    await told(account, "in.passkey");
    await settled();
    expect(card()).toBeNull();
    expect(localStorage.getItem(PASSKEY_OFFERED_KEY)).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given an admin's account that holds a passkey, then nothing is offered", async () => {
    const account = fakeAccount(accountView({ admin: true, ways: { google: null, email: "ada@example.com", passkeys: 1 } }));
    await world(account);
    await told(account, "in.email");
    await settled();
    expect(card()).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given a browser that cannot make a passkey, then nothing is offered", async () => {
    const account = fakeAccount(accountView(), { passkeysWork: () => Promise.resolve(false) });
    await world(account);
    await told(account, "kept.email");
    await settled();
    expect(card()).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given an in-app browser, then nothing is offered, whatever the browser says", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(WHATSAPP);
    const account = fakeAccount();
    await world(account);
    await told(account, "kept.email");
    await settled();
    expect(card()).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given a device the card was offered on before, then it never asks again there", async () => {
    localStorage.setItem(PASSKEY_OFFERED_KEY, "1");
    const account = fakeAccount();
    await world(account);
    await told(account, "in.google");
    await settled();
    expect(card()).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] given an open sheet when the line has been told, then the card waits for it to close", async () => {
    const account = fakeAccount();
    const { rerender } = render(<div role="dialog" data-open />);
    await world(account);
    await told(account, "kept.email");
    await settled();
    expect(card()).toBeNull();
    rerender(<div />);
    expect(await screen.findByText(say("ui.account.passkey.card.title"))).toBeDefined();
  });

  test("[account:passkey-offered-where-it-works] given a moment that holds the screen when the line has been told, then the card waits for it to close", async () => {
    const account = fakeAccount();
    const store = await world(account);
    act(() => store.setState({ reportOpen: true }));
    await told(account, "kept.email");
    await settled();
    expect(card()).toBeNull();
    act(() => store.setState({ reportOpen: false }));
    expect(await screen.findByText(say("ui.account.passkey.card.title"))).toBeDefined();
  });

  test("[account:passkey-offered-where-it-works] given Not now, then the card goes, and a later way in on this device offers nothing", async () => {
    const account = fakeAccount();
    await world(account);
    await told(account, "kept.email");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.later") }));
    await waitFor(() => expect(card()).toBeNull());
    expect(account.calls).not.toContain("addPasskey()");
    await told(account, "in.email");
    await settled();
    expect(card()).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] [account:passkey-in-email-autofill] given Add a passkey, then the passkey is made at once, the card says so and the passkey mark is set", async () => {
    const account = fakeAccount();
    await world(account);
    await told(account, "kept.email");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    expect(await screen.findByText(say("ui.account.passkey.added"))).toBeDefined();
    expect(say("ui.account.passkey.added")).toBe("Passkey added. Use it next time you sign in.");
    expect(account.calls).toEqual(["addPasskey()"]);
    expect(localStorage.getItem(PASSKEY_MARK_KEY)).toBe("1");
  });

  test("[account:passkey-offered-where-it-works] [account:passkey-errors-told-apart] given the passkey prompt cancelled, then the card closes quietly", async () => {
    const account = fakeAccount(accountView(), { addPasskey: () => Promise.resolve({ ok: false, why: "cancelled" }) });
    await world(account);
    await told(account, "kept.email");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    await waitFor(() => expect(card()).toBeNull());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(localStorage.getItem(PASSKEY_MARK_KEY)).toBeNull();
  });

  test("[account:passkey-offered-where-it-works] [account:passkey-errors-told-apart] given any other failure, then it is told in the card in its own words, as the sheet tells it", async () => {
    const account = fakeAccount(accountView(), { addPasskey: () => Promise.resolve({ ok: false, why: "already-here" }) });
    await world(account);
    await told(account, "kept.email");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.passkey.add") }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(say("ui.account.fail.already-here"));
    expect(card()?.contains(alert)).toBe(true);
  });
});
