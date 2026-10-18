// The shell's composition online (App.tsx): signed out, the door after the age screen holds the guest start (account.md R-ACCOUNT-029): the page
// has the username, filled in from the name and changed there, and the guest line once; Begin makes the guest life
// with the unseen bot check's token, then the character, then the game opens on it.
import type { Id } from "@japacity/sim";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { GameProvider } from "./authority/GameProvider";
import { createGameStore, type GameStore } from "./authority/store";
import { AccountGate } from "./features/account/AccountGate";
import { answerAge } from "./features/account/age.testing";
import { usernameFrom, withDigits } from "./features/account/GuestStart";
import { TEST_SITE_KEY, type LoadTurnstile, type TurnstileOptions } from "./features/account/Turnstile";
import { ScenarioView } from "./features/scenario/ScenarioView";
import type { AccountApi, GuestAnswer } from "./shared/net/auth";
import { reportedError } from "./shared/net/http";
import { engineView } from "./shared/testing/fixtures";
import { say } from "./shared/words/text";
// Registers Testing Library's cleanup for this file.
import "./shared/testing/render";

afterEach(() => {
  localStorage.clear();
});

const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function fakeAccount(startGuest: (username: string) => GuestAnswer = () => ({ ok: true })): AccountApi & { calls: string[]; bots: (string | null)[] } {
  const calls: string[] = [];
  const bots: (string | null)[] = [];
  const ok = () => Promise.resolve({ ok: true } as const);
  return {
    calls,
    bots,
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: (birth) => (calls.push(`declareAge(${birth})`), Promise.resolve("passed")),
    startGuest: (username, bot) => (calls.push(`startGuest(${username})`), bots.push(bot), Promise.resolve(startGuest(username))),
    view: () => Promise.resolve(null),
    rename: ok,
    returnedFromGoogle: () => null,
    sendCode: (_email, bot) => (calls.push("sendCode()"), bots.push(bot), ok()),
    signInWithCode: () => (calls.push("signInWithCode()"), ok()),
    signInWithGoogle: () => (calls.push("signInWithGoogle()"), ok()),
    signInWithPasskey: () => (calls.push("signInWithPasskey()"), ok()),
    addPasskey: ok,
    email: () => Promise.resolve(null),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    deleteAccount: ok,
    signOut: () => Promise.resolve(),
  };
}

/** The widget as the always-pass test key behaves, unless `passAtOnce` is off and the test gives the token. */
function fakeTurnstile({ passAtOnce = true }: { passAtOnce?: boolean } = {}) {
  const rendered: TurnstileOptions[] = [];
  const load: LoadTurnstile = () =>
    Promise.resolve({
      render: (_container, options) => {
        rendered.push(options);
        if (passAtOnce) setTimeout(() => options.callback(TOKEN), 0);
        return "widget-1";
      },
      reset: () => {
        const last = rendered.at(-1);
        if (passAtOnce && last !== undefined) setTimeout(() => last.callback(TOKEN), 0);
      },
      remove: () => undefined,
    });
  return { load, rendered };
}

/** The gate as the shell draws it online, signed out, with the door after the age screen. */
/** `failFirstLife`: the first character's start fails, with this error when one is given. */
function online(account: AccountApi, turnstile: { load: LoadTurnstile } = fakeTurnstile(), { failFirstLife = false, botWaitMs }: { failFirstLife?: boolean | Error; botWaitMs?: number } = {}) {
  const lives: Id<"scenario">[] = [];
  const life = {
    newLife: (scenario: Id<"scenario">) => {
      lives.push(scenario);
      if (failFirstLife !== false && lives.length === 1) return Promise.reject(failFirstLife === true ? new Error("unreachable") : failFirstLife);
      return Promise.resolve(engineView());
    },
  };
  const store: GameStore = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account, life, lifeAgain: false });
  store.getState().leave(null);
  render(
    <GameProvider store={store}>
      <AccountGate load={turnstile.load} sitekey={TEST_SITE_KEY} door={(guest) => <ScenarioView guest={guest} />} {...(botWaitMs === undefined ? {} : { botWaitMs })} />
    </GameProvider>,
  );
  return { store, lives };
}

const stage = (): string | null => document.querySelector("[data-gate]")?.getAttribute("data-gate") ?? null;
const next = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
const usernameBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("ui.account.name.label") });

/** Play, the age screen passed, and the door's name as it was filled in. */
async function toTheDoor(): Promise<string> {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.play") }));
  await answerAge("1990-05-17");
  const name = await screen.findByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
  return name.value;
}

/** Next, Print my page: the page. */
function toThePage(): void {
  fireEvent.click(next(say("ui.door.next")));
  fireEvent.click(next(say("ui.door.next")));
}

describe("the username a name fills in", () => {
  test("[R-ACCOUNT-024] given names from the door, then the username keeps their letters and digits, joins the words with underscores, drops the marks, and stays 3 to 20 long", () => {
    expect(usernameFrom("Adaeze Okafor")).toBe("Adaeze_Okafor");
    expect(usernameFrom("Ọlámídé")).toBe("Olamide");
    expect(usernameFrom("Chi-Chi O'Neil")).toBe("Chi_Chi_O_Neil");
    expect(usernameFrom("Al")).toBe("Al_00");
    expect(usernameFrom("Oluwadamilare Babatunde")).toBe("Oluwadamilare_Babatu");
    for (const name of ["Adaeze Okafor", "Ọlámídé", "Al", "Oluwadamilare Babatunde", "Ẹ"]) expect(usernameFrom(name)).toMatch(/^[A-Za-z0-9_]{3,20}$/);
    expect(withDigits("Oluwadamilare_Babatu", "042")).toBe("Oluwadamilare_Ba_042");
    expect(withDigits("Oluwadamilare_Babatu", "042").length).toBe(20);
  });
});

describe("the guest start at Begin", () => {
  test("[R-ACCOUNT-029] [R-ACCOUNT-021] [R-ACCOUNT-027] given Play and the age passed, then the door follows with no way in; the page holds the username filled from the name and the guest line once; Begin makes the guest with the token, then the life, and the game opens", async () => {
    const account = fakeAccount();
    const turnstile = fakeTurnstile();
    const { store, lives } = online(account, turnstile);
    const name = await toTheDoor();
    expect(stage()).toBe("you");
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.queryByLabelText(say("ui.account.email.label"))).toBeNull();
    // Nothing of the username before the page: never a screen of its own.
    expect(screen.queryByRole("textbox", { name: say("ui.account.name.label") })).toBeNull();
    toThePage();
    expect(stage()).toBe("page");
    expect(usernameBox().value).toBe(usernameFrom(name));
    expect(screen.getAllByText(say("ui.guest.reminder"))).toHaveLength(1);
    expect(account.calls).toEqual(["declareAge(1990-05-17)"]);
    // The unseen check is up by the time the page is read.
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.calls).toEqual(["declareAge(1990-05-17)", `startGuest(${usernameFrom(name)})`]);
    expect(account.bots).toEqual([TOKEN]);
    expect(lives).toHaveLength(1);
  });

  test("[R-ACCOUNT-024] given the username changed on the page, then Begin sends it as typed; one not of the rule's shape is said and sends nothing; the server's refusal is said by it and Begin can be pressed again", async () => {
    const answers: GuestAnswer[] = [{ ok: false, why: "reserved" }, { ok: true }];
    const account = fakeAccount(() => answers.shift() ?? { ok: true });
    const { store, lives } = online(account);
    await toTheDoor();
    toThePage();
    fireEvent.change(usernameBox(), { target: { value: "ada lagos" } });
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.format"))).toBeDefined();
    fireEvent.change(usernameBox(), { target: { value: "" } });
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.empty"))).toBeDefined();
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual([]);
    fireEvent.change(usernameBox(), { target: { value: "staff_ada" } });
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.reserved"))).toBeDefined();
    expect(stage()).toBe("page");
    expect(lives).toEqual([]);
    fireEvent.change(usernameBox(), { target: { value: "Ada_Lagos" } });
    expect(screen.queryByText(say("ui.account.name.reserved"))).toBeNull();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(["startGuest(staff_ada)", "startGuest(Ada_Lagos)"]);
  });

  test("[R-ACCOUNT-024] given a filled username someone holds, then Begin tries once more with digits after it; a typed one someone holds is said, never changed", async () => {
    const filled = fakeAccount((username) => (/_\d{3}$/.test(username) ? { ok: true } : { ok: false, why: "taken" }));
    const { store } = online(filled);
    const name = await toTheDoor();
    toThePage();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    const asked = filled.calls.filter((call) => call.startsWith("startGuest"));
    expect(asked).toHaveLength(2);
    expect(asked[0]).toBe(`startGuest(${usernameFrom(name)})`);
    expect(asked[1]).toMatch(/^startGuest\([A-Za-z0-9_]{3,16}_\d{3}\)$/);
  });

  test("[R-ACCOUNT-024] given a typed username someone holds, then the page says so and sends no other", async () => {
    const typed = fakeAccount(() => ({ ok: false, why: "taken" }));
    online(typed);
    await toTheDoor();
    toThePage();
    fireEvent.change(usernameBox(), { target: { value: "ada_lagos" } });
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.taken"))).toBeDefined();
    expect(typed.calls.filter((call) => call.startsWith("startGuest"))).toEqual(["startGuest(ada_lagos)"]);
  });

  test("[R-ACCOUNT-029] [R-ACCOUNT-013] given the unseen check's token not yet in, when Begin is pressed, then the guest start waits for the token and goes with it, and nothing about the check is said", async () => {
    const account = fakeAccount();
    const turnstile = fakeTurnstile({ passAtOnce: false });
    const { store } = online(account, turnstile);
    await toTheDoor();
    // The age screen runs no check: it comes with the guest life.
    expect(turnstile.rendered).toHaveLength(0);
    toThePage();
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    expect(turnstile.rendered[0]?.appearance).toBe("interaction-only");
    expect(document.body.textContent).not.toMatch(/check|person|robot/i);
    fireEvent.click(next(say("ui.door.begin")));
    await act(() => Promise.resolve());
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual([]);
    act(() => turnstile.rendered[0]?.callback(TOKEN));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.bots).toEqual([TOKEN]);
  });

  test("[R-ACCOUNT-013] given the guest start's page, when the widget is rendered, then it carries the action guest, the one the server asks siteverify's pass to name", async () => {
    const turnstile = fakeTurnstile({ passAtOnce: false });
    online(fakeAccount(), turnstile);
    await toTheDoor();
    toThePage();
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    expect(turnstile.rendered[0]?.action).toBe("guest");
  });

  test("[R-ACCOUNT-029] given a script that never loads, when Begin is pressed, then the guest start goes at once without a token, for the server to judge", async () => {
    const account = fakeAccount();
    const { store } = online(account, { load: () => new Promise(() => undefined) });
    await toTheDoor();
    toThePage();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.bots).toEqual([null]);
  });

  test("[R-ACCOUNT-012] given an age answer that ran out by Begin, then the age screen asks again, and after it the run is back at the page", async () => {
    const answers: GuestAnswer[] = [{ ok: false, why: "expired" }, { ok: true }];
    const account = fakeAccount(() => answers.shift() ?? { ok: true });
    const { store } = online(account);
    await toTheDoor();
    toThePage();
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByRole("combobox", { name: say("ui.account.age.day") })).toBeDefined();
    await answerAge("1990-05-17");
    expect(await screen.findByRole("textbox", { name: say("ui.account.name.label") })).toBeDefined();
    expect(stage()).toBe("page");
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
  });

  test("[R-ACCOUNT-021] [R-ACCOUNT-015] given the guest made but the life not started, when Begin is pressed again, then no second guest is asked for and the life starts", async () => {
    const account = fakeAccount();
    const { store, lives } = online(account, fakeTurnstile(), { failFirstLife: true });
    await toTheDoor();
    toThePage();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(lives).toHaveLength(1));
    await waitFor(() => expect(next(say("ui.door.begin")).hasAttribute("disabled")).toBe(false));
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(lives).toHaveLength(2);
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toHaveLength(1);
  });

  test("[R-ACCOUNT-021] given the guest made but the server answering the character's start signed-out, then the page says the life did not start, and the next Begin makes the guest again and the life starts", async () => {
    const account = fakeAccount();
    const { store, lives } = online(account, fakeTurnstile(), { failFirstLife: reportedError({ ok: false, code: "signed-out", detail: "Sign in first." }) });
    await toTheDoor();
    toThePage();
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.guest.lost"))).toBeDefined();
    expect(lives).toHaveLength(1);
    await waitFor(() => expect(next(say("ui.door.begin")).hasAttribute("disabled")).toBe(false));
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(lives).toHaveLength(2);
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toHaveLength(2);
  });
});
