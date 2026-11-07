// The shell's composition online (App.tsx): signed out, the door after the age screen holds the guest start (account:start-screen-over-live-city): the page
// has the username box, empty for the player to type their own and checked with the server as they type
// (account:username-typed-and-checked), and the guest line once; Begin makes the guest life with the unseen bot check's
// token, then the character, then the game opens on it.
import type { Id } from "@japacity/sim";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../authority/GameProvider";
import { createGameStore, type GameStore } from "../authority/store";
import { AccountGate } from "../features/account/AccountGate";
import { answerAge } from "../features/account/age.testing";
import { TEST_SITE_KEY, type LoadTurnstile, type TurnstileOptions } from "../features/account/Turnstile";
import { FrontDoor } from "../features/front-door/FrontDoor";
import type { AccountApi, FreeAnswer, GuestAnswer } from "../shared/net/auth";
import { reportedError } from "../shared/net/http";
import { accountView, engineView } from "../shared/testing/fixtures";
import { stubPointer } from "../shared/testing/pointer";
import { lookOf, namesFor } from "../shared/front-door/looks";
import { DOOR_KEY } from "../shared/storage/storage";
import { say } from "../shared/words/text";
// Registers Testing Library's cleanup for this file.
import "../shared/testing/render";

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const TOKEN = "XXXX.DUMMY.TOKEN.XXXX";

function fakeAccount(startGuest: (username: string) => GuestAnswer = () => ({ ok: true }), usernameFree: (username: string) => FreeAnswer | null = () => null): AccountApi & { calls: string[]; bots: (string | null)[] } {
  const calls: string[] = [];
  const bots: (string | null)[] = [];
  const ok = () => Promise.resolve({ ok: true } as const);
  return {
    calls,
    bots,
    ageStatus: () => Promise.resolve("unasked"),
    declareAge: (birth) => (calls.push(`declareAge(${birth})`), Promise.resolve("passed")),
    startGuest: (username, bot) => (calls.push(`startGuest(${username})`), bots.push(bot), Promise.resolve(startGuest(username))),
    usernameFree: (username) => (calls.push(`usernameFree(${username})`), Promise.resolve(usernameFree(username))),
    view: () => Promise.resolve(null),
    rename: ok,
    returnedFromGoogle: () => null,
    sendCode: (_email, bot) => (calls.push("sendCode()"), bots.push(bot), ok()),
    signInWithCode: () => (calls.push("signInWithCode()"), ok()),
    dropNewLife: () => (calls.push("dropNewLife()"), Promise.resolve()),
    signInWithGoogle: () => (calls.push("signInWithGoogle()"), ok()),
    signInWithPasskey: () => (calls.push("signInWithPasskey()"), ok()),
    addPasskey: ok,
    email: () => Promise.resolve(null),
    usageCounts: () => Promise.resolve(null),
    setUsageCounts: () => Promise.resolve(true),
    deleteAccount: ok,
    signOut: ok,
    signOutEverywhere: ok,
    passkeysWork: () => Promise.resolve(true),
    passkeys: () => Promise.resolve([]),
    removePasskey: () => Promise.resolve({ ok: true, signedIn: true }),
    confirmWithPasskey: ok,
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
      <AccountGate load={turnstile.load} sitekey={TEST_SITE_KEY} door={(guest) => <FrontDoor guest={guest} />} {...(botWaitMs === undefined ? {} : { botWaitMs })} />
    </GameProvider>,
  );
  return { store, lives };
}

const stage = (): string | null => document.querySelector("[data-gate]")?.getAttribute("data-gate") ?? null;
const next = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}`) });
const usernameBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: say("ui.account.name.label") });

/** Play, the age screen passed, and the door's name: rolled with the dice, since the box starts empty, unless `roll` is false. */
async function toTheDoor(roll = true): Promise<string> {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.play") }));
  await answerAge("1990-05-17");
  const name = await screen.findByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
  if (roll) fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
  return name.value;
}

/** Next, Print my page: the page. */
function toThePage(): void {
  fireEvent.click(next(say("ui.door.next")));
  fireEvent.click(next(say("ui.door.next")));
}

/** The player types their own username on the page. */
function typeUsername(username = "ada_lagos"): void {
  fireEvent.change(usernameBox(), { target: { value: username } });
}

/** The account's calls but the box's checks, which follow the typing. */
const sent = (account: { calls: string[] }): string[] => account.calls.filter((call) => !call.startsWith("usernameFree"));

describe("the username box (account:username-typed-and-checked)", () => {
  test("[account:username-typed-and-checked] [account:start-screen-over-live-city] given Play and the age passed, when the page shows, then the username box is empty whatever the name on the door, with no suggestion and no dice or reroll beside it", async () => {
    const account = fakeAccount();
    online(account);
    const name = await toTheDoor();
    expect(name).not.toBe("");
    toThePage();
    expect(usernameBox().value).toBe("");
    expect(usernameBox().placeholder).toBe("");
    const fields = document.querySelector("[data-guest-fields]");
    expect(fields?.querySelectorAll("button")).toHaveLength(0);
    // A new name rolled on the door leaves the box as the player left it.
    typeUsername("my_own_name");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.edit.you") }));
    fireEvent.click(await screen.findByRole("button", { name: say("ui.door.reroll") }));
    toThePage();
    expect(usernameBox().value).toBe("my_own_name");
  });

  test("[account:username-typed-and-checked] given Play and the age passed on a desktop, when Where you live opens, then the username box, the first field to fill there, takes the focus; the door's first screen gave it to the character name box", async () => {
    stubPointer("fine");
    online(fakeAccount());
    await toTheDoor(false);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: say("prologue.door.name.title") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    toThePage();
    expect(document.activeElement).toBe(usernameBox());
    expect(usernameBox().hasAttribute("data-first-field")).toBe(true);
  });

  test("[account:username-typed-and-checked] given a name typed in pieces, when the typing pauses, then the server is asked once, for the last, and the box says it is free; a held one is said taken", async () => {
    const account = fakeAccount(undefined, (username) => (username === "ada_lagos" ? "taken" : "free"));
    online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada");
    typeUsername("ada_l");
    typeUsername("ada_lag");
    expect(await screen.findByText(say("ui.account.name.available"))).toBeDefined();
    expect(account.calls.filter((call) => call.startsWith("usernameFree"))).toEqual(["usernameFree(ada_lag)"]);
    typeUsername("ada_lagos");
    expect(await screen.findByText(say("ui.account.name.taken"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.name.available"))).toBeNull();
    expect(account.calls.filter((call) => call.startsWith("usernameFree"))).toEqual(["usernameFree(ada_lag)", "usernameFree(ada_lagos)"]);
    // Said where a screen reader hears it, as the player types.
    expect(screen.getByText(say("ui.account.name.taken")).closest("[role=status]")).not.toBeNull();
  });

  test("[account:username-typed-and-checked] [account:username-and-unconfirmed-email] given a name not of the rule's shape, when it is typed, then the box says the shape and asks the server nothing; a name the server's word checks refuse is said by its problem, never free", async () => {
    const account = fakeAccount(undefined, (username) => (username.startsWith("staff") ? "reserved" : "blocked"));
    online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada lagos");
    expect(await screen.findByText(say("ui.account.name.format"))).toBeDefined();
    typeUsername("ab");
    await act(() => new Promise((resolve) => setTimeout(resolve, 600)));
    expect(account.calls.filter((call) => call.startsWith("usernameFree"))).toEqual([]);
    typeUsername("staff_ada");
    expect(await screen.findByText(say("ui.account.name.reserved"))).toBeDefined();
    typeUsername("big_ashawo");
    expect(await screen.findByText(say("ui.account.name.blocked"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.name.available"))).toBeNull();
  });

  test("[account:username-typed-and-checked] given a check the server could not answer, when the typing pauses, then the box says nothing of it and Begin still sends the name", async () => {
    const account = fakeAccount();
    const { store } = online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    await waitFor(() => expect(account.calls).toContain("usernameFree(ada_lagos)"));
    expect(screen.queryByText(say("ui.account.name.available"))).toBeNull();
    expect(screen.queryByText(say("ui.account.name.taken"))).toBeNull();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(sent(account)).toEqual(["declareAge(1990-05-17)", "startGuest(ada_lagos)"]);
  });
});

describe("the page's username on a small phone", () => {
  test("[prologue:front-door-three-screens] [account:username-and-unconfirmed-email] [account:guest-reminded-to-secure] given the door's page online, then the username box stands over the homes, the line on who sees it shows while the box is empty or typed in and goes once a name is left in it, and the guest line stands once, under Begin", async () => {
    const account = fakeAccount(undefined, () => "free");
    online(account);
    await toTheDoor();
    toThePage();
    const fields = document.querySelector("[data-guest-fields]")!;
    const homes = document.querySelector("[data-door-home]")!;
    expect(fields.compareDocumentPosition(homes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const said = (): string | null => document.getElementById("guest-username-said")?.textContent ?? null;
    expect(said()).toBe(say("ui.account.name.intro"));
    fireEvent.focus(usernameBox());
    typeUsername("ada_lagos");
    expect(said()).toBe(say("ui.account.name.intro"));
    expect(await screen.findByText(say("ui.account.name.available"))).toBeDefined();
    fireEvent.blur(usernameBox());
    expect(said()).toBeNull();
    expect(screen.getByText(say("ui.account.name.available"))).toBeDefined();
    // The guest line, once, in the foot under Begin.
    const lines = screen.getAllByText(say("ui.guest.reminder"));
    expect(lines).toHaveLength(1);
    const foot = document.querySelector("[data-door-foot]")!;
    expect(foot.contains(lines[0]!)).toBe(true);
    expect(next(say("ui.door.begin")).compareDocumentPosition(lines[0]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fields.contains(lines[0]!)).toBe(false);
  });
});

describe("Enter and a refused Begin (account:username-typed-and-checked)", () => {
  /** Each element brought into view, in order. */
  const brought: Element[] = [];
  beforeEach(() => {
    brought.length = 0;
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: function (this: Element) {
        brought.push(this);
      },
    });
  });
  afterEach(() => {
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  });

  /** The words the box's description points at, as the reader hears them under it. */
  const describedBy = (): string =>
    (usernameBox().getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ");

  test("[account:username-typed-and-checked] given a username typed on the page, when Enter is pressed in the box, then it is Begin: the guest is made with that name and the game opens", async () => {
    const account = fakeAccount();
    const { store } = online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    fireEvent.keyDown(usernameBox(), { key: "Enter", code: "Enter" });
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(sent(account)).toEqual(["declareAge(1990-05-17)", "startGuest(ada_lagos)"]);
  });

  test("[account:username-typed-and-checked] given Enter pressed while a key is composed, or with a modifier, then nothing is sent", async () => {
    const account = fakeAccount();
    online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    fireEvent.keyDown(usernameBox(), { key: "Enter", code: "Enter", isComposing: true });
    fireEvent.keyDown(usernameBox(), { key: "Enter", code: "Enter", shiftKey: true });
    await act(() => Promise.resolve());
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual([]);
  });

  test("[account:username-typed-and-checked] given Play and the age passed on a touch phone, when the door's first screen and then Where you live open, then neither box takes the focus, so no keyboard rises over the homes; Begin with the username empty then focuses its box", async () => {
    stubPointer("coarse");
    online(fakeAccount());
    await toTheDoor(false);
    expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: say("prologue.door.name.title") }));
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    toThePage();
    expect(document.activeElement).not.toBe(usernameBox());
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.empty"))).toBeDefined();
    expect(document.activeElement).toBe(usernameBox());
    expect(brought).toContain(usernameBox());
  });

  test("[account:username-typed-and-checked] given the box empty, when Begin is pressed, then the box is brought into view and focused, with the reason under it", async () => {
    const account = fakeAccount();
    online(account);
    await toTheDoor();
    toThePage();
    const begin = next(say("ui.door.begin"));
    begin.focus();
    fireEvent.click(begin);
    expect(await screen.findByText(say("ui.account.name.empty"))).toBeDefined();
    expect(document.activeElement).toBe(usernameBox());
    expect(brought).toContain(usernameBox());
    expect(describedBy()).toContain(say("ui.account.name.empty"));
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual([]);
  });

  test("[account:username-typed-and-checked] given a name the server refuses at Begin as taken, then the box is brought into view and focused, with the reason under it", async () => {
    const account = fakeAccount(() => ({ ok: false, why: "taken" }));
    online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    const begin = next(say("ui.door.begin"));
    begin.focus();
    fireEvent.click(begin);
    expect(await screen.findByText(say("ui.account.name.taken"))).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(usernameBox()));
    expect(brought).toContain(usernameBox());
    expect(describedBy()).toContain(say("ui.account.name.taken"));
  });

  test("[account:username-typed-and-checked] given a Begin refused for no fault of the name (too many lives from here), then the box and its reason are brought into view but the focus stays, so no keyboard rises over the reason", async () => {
    const account = fakeAccount(() => ({ ok: false, why: "too-many" }));
    online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    const begin = next(say("ui.door.begin"));
    begin.focus();
    fireEvent.click(begin);
    expect(await screen.findByText(say("ui.account.guest.too-many"))).toBeDefined();
    await waitFor(() => expect(brought).toContain(usernameBox()));
    expect(document.activeElement).not.toBe(usernameBox());
  });
});

describe("a pass held (account:age-screen-refuses-minors)", () => {
  test("[account:age-screen-refuses-minors] given a browser whose age pass still holds, when the game opens again before Begin, then the door's step shows without the start screen or the age screen, and nothing is declared", async () => {
    const account = { ...fakeAccount(), ageStatus: () => Promise.resolve("passed" as const) };
    online(account);
    expect(await screen.findByRole("textbox", { name: say("prologue.door.name.title") })).toBeDefined();
    expect(stage()).toBe("you");
    expect(screen.queryByRole("button", { name: say("ui.account.start.play") })).toBeNull();
    expect(screen.queryByRole("combobox", { name: say("ui.account.age.day") })).toBeNull();
    expect(account.calls).toEqual([]);
  });

  test("[account:age-screen-refuses-minors] given a browser whose age pass still holds and a run kept at the page, when the game opens again, then the page shows as it was left, the username as typed", async () => {
    const first = fakeAccount();
    online(first);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    cleanup();
    const again = { ...fakeAccount(), ageStatus: () => Promise.resolve("passed" as const) };
    online(again);
    expect((await screen.findByRole<HTMLInputElement>("textbox", { name: say("ui.account.name.label") })).value).toBe("ada_lagos");
    expect(stage()).toBe("page");
    expect(again.calls.filter((call) => call.startsWith("declareAge"))).toEqual([]);
  });
});

describe("the guest start at Begin", () => {
  test("[account:start-screen-over-live-city] [account:guest-and-secured-states] [account:guest-reminded-to-secure] [account:username-typed-and-checked] given Play and the age passed, then the door follows with no way in; the page holds the username box, empty, and the guest line once; Begin makes the guest with the token and the name typed, then the life, and the game opens", async () => {
    const account = fakeAccount();
    const turnstile = fakeTurnstile();
    const { store, lives } = online(account, turnstile);
    await toTheDoor();
    expect(stage()).toBe("you");
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
    expect(screen.queryByLabelText(say("ui.account.email.label"))).toBeNull();
    // Nothing of the username before the page: never a screen of its own.
    expect(screen.queryByRole("textbox", { name: say("ui.account.name.label") })).toBeNull();
    toThePage();
    expect(stage()).toBe("page");
    expect(usernameBox().value).toBe("");
    expect(screen.getAllByText(say("ui.guest.reminder"))).toHaveLength(1);
    expect(account.calls).toEqual(["declareAge(1990-05-17)"]);
    // The unseen check is up by the time the page is read.
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    typeUsername("ada_lagos");
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(sent(account)).toEqual(["declareAge(1990-05-17)", "startGuest(ada_lagos)"]);
    expect(account.bots).toEqual([TOKEN]);
    expect(lives).toHaveLength(1);
  });

  test("[account:username-and-unconfirmed-email] given the username changed on the page, then Begin sends it as typed; one not of the rule's shape is said and sends nothing; the server's refusal is said by it and Begin can be pressed again", async () => {
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

  test("[account:username-typed-and-checked] given a name the box said was free, when someone takes it before Begin, then Begin says taken and sends no other name", async () => {
    const account = fakeAccount(() => ({ ok: false, why: "taken" }), () => "free");
    online(account);
    await toTheDoor();
    toThePage();
    typeUsername("ada_lagos");
    expect(await screen.findByText(say("ui.account.name.available"))).toBeDefined();
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.taken"))).toBeDefined();
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(["startGuest(ada_lagos)"]);
    expect(usernameBox().value).toBe("ada_lagos");
  });

  test("[account:username-and-unconfirmed-email] given a typed username someone holds, then the page says so and sends no other", async () => {
    const typed = fakeAccount(() => ({ ok: false, why: "taken" }));
    online(typed);
    await toTheDoor();
    toThePage();
    fireEvent.change(usernameBox(), { target: { value: "ada_lagos" } });
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByText(say("ui.account.name.taken"))).toBeDefined();
    expect(typed.calls.filter((call) => call.startsWith("startGuest"))).toEqual(["startGuest(ada_lagos)"]);
  });

  test("[account:start-screen-over-live-city] [account:bot-check-on-guest-creation] given the unseen check's token not yet in, when Begin is pressed, then the guest start waits for the token and goes with it, and nothing about the check is said", async () => {
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
    typeUsername();
    fireEvent.click(next(say("ui.door.begin")));
    await act(() => Promise.resolve());
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual([]);
    act(() => turnstile.rendered[0]?.callback(TOKEN));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.bots).toEqual([TOKEN]);
  });

  test("[account:bot-check-on-guest-creation] given the guest start's page, when the widget is rendered, then it carries the action guest, the one the server asks siteverify's pass to name", async () => {
    const turnstile = fakeTurnstile({ passAtOnce: false });
    online(fakeAccount(), turnstile);
    await toTheDoor();
    toThePage();
    await waitFor(() => expect(turnstile.rendered).toHaveLength(1));
    expect(turnstile.rendered[0]?.action).toBe("guest");
  });

  test("[account:start-screen-over-live-city] given a script that never loads, when Begin is pressed, then the guest start goes at once without a token, for the server to judge", async () => {
    const account = fakeAccount();
    const { store } = online(account, { load: () => new Promise(() => undefined) });
    await toTheDoor();
    toThePage();
    typeUsername();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.bots).toEqual([null]);
  });

  test("[account:age-screen-refuses-minors] given an age answer that ran out by Begin, then the age screen asks again, and after it the run is back at the page", async () => {
    const answers: GuestAnswer[] = [{ ok: false, why: "expired" }, { ok: true }];
    const account = fakeAccount(() => answers.shift() ?? { ok: true });
    const { store } = online(account);
    await toTheDoor();
    toThePage();
    typeUsername();
    fireEvent.click(next(say("ui.door.begin")));
    expect(await screen.findByRole("combobox", { name: say("ui.account.age.day") })).toBeDefined();
    await answerAge("1990-05-17");
    expect(await screen.findByRole("textbox", { name: say("ui.account.name.label") })).toBeDefined();
    expect(stage()).toBe("page");
    expect(usernameBox().value).toBe("ada_lagos");
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
  });

  test("[account:guest-and-secured-states] [account:one-character-per-account] given the guest made but the life not started, when Begin is pressed again, then no second guest is asked for and the life starts", async () => {
    const account = fakeAccount();
    const { store, lives } = online(account, fakeTurnstile(), { failFirstLife: true });
    await toTheDoor();
    toThePage();
    typeUsername();
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(lives).toHaveLength(1));
    await waitFor(() => expect(next(say("ui.door.begin")).hasAttribute("disabled")).toBe(false));
    fireEvent.click(next(say("ui.door.begin")));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(lives).toHaveLength(2);
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toHaveLength(1);
  });

  test("[account:guest-and-secured-states] given the guest made but the server answering the character's start signed-out, then the page says the life did not start, and the next Begin makes the guest again and the life starts", async () => {
    const account = fakeAccount();
    const { store, lives } = online(account, fakeTurnstile(), { failFirstLife: reportedError({ ok: false, code: "signed-out", detail: "Sign in first." }) });
    await toTheDoor();
    toThePage();
    typeUsername();
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

describe("the door's name on Play's path (prologue:front-door-builds-a-person)", () => {
  test("[prologue:front-door-builds-a-person] given Play, where the username is asked on the door's last page, when the door opens, then the name box is empty with the pool's suggestion as its placeholder whatever the account would say, and the username box is still empty", async () => {
    const account = { ...fakeAccount(), view: () => Promise.resolve(accountView({ username: "olamide_88", character: null })) };
    online(account);
    const filled = await toTheDoor(false);
    expect(filled).toBe("");
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: say("prologue.door.name.title") });
    const sex = lookOf(document.querySelector("[data-gate]")?.getAttribute("data-look"))!.sex;
    const roll = (JSON.parse(localStorage.getItem(DOOR_KEY) ?? "{}") as { roll?: number }).roll ?? -1;
    expect(box.placeholder).toBe(namesFor(sex, roll)[0]);
    expect(box.placeholder).not.toBe("Olamide");
    fireEvent.click(screen.getByRole("button", { name: say("ui.door.reroll") }));
    toThePage();
    expect(usernameBox().value).toBe("");
  });
});
