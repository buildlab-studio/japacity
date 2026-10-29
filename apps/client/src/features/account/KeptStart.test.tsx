// The life that came by the code on the ways back in (account:sign-in-without-secret, account:guest-secures-the-life,
// account:age-screen-refuses-minors, account:bot-check-on-guest-creation, account:guest-reminded-to-secure): the right code for an
// address no account uses hands the gate to the age screen under a line that says why, then the username's own step, whose
// Continue makes the account kept by the email; a proof that ran out is told with the code form inline, the username kept.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi, AuthResult, GuestAnswer } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { answerAge } from "./age.testing";
import { answers, codeAccount, type Faked } from "./code.testing";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";
import { WayToast } from "./WayToast";

const EMAIL = "new@example.test";
const NEW_LIFE: AuthResult = { ok: true, newLife: true };

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Turnstile's stand-in: a token a moment after the widget is drawn, and a fresh one a moment after each reset, as Turnstile gives. */
const passing: LoadTurnstile = () => {
  let solved: (() => void) | null = null;
  return Promise.resolve({
    render: (_container, options) => {
      solved = () => setTimeout(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"), 0);
      solved();
      return "widget-1";
    },
    reset: () => solved?.(),
    remove: () => undefined,
  });
};

/** The guest start answering in order, each call kept with whether it came by the code; ok after the answers run out. */
function starting(account: () => Faked, ...given: GuestAnswer[]): AccountApi["startGuest"] {
  return (username, _bot, proved) => {
    account().calls.push(`startGuest(${JSON.stringify(username)}${proved === true ? ',"proved"' : ""})`);
    return Promise.resolve(given.shift() ?? { ok: true, email: "kept" });
  };
}

/** The gate signed out over the world's line, with the account seam given. */
function gate(over: Partial<AccountApi> = {}, guest: GuestAnswer[] = []) {
  let account: Faked | null = null;
  account = codeAccount({ signInWithCode: answers(NEW_LIFE), startGuest: starting(() => account as Faked, ...guest), ...over });
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  store.getState().leave(null);
  render(
    <GameProvider store={store}>
      <AccountGate load={passing} sitekey={TEST_SITE_KEY} />
      <WayToast account={account} />
    </GameProvider>,
  );
  return { account, store };
}

/** Sign in, the address, its code: the right code for an address no account uses. */
async function proveByCode(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.returning") }));
  fireEvent.change(await screen.findByLabelText(say("ui.account.email.label")), { target: { value: EMAIL } });
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
  fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
}

async function answerTheAge(): Promise<void> {
  expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
  await answerAge(`${String(new Date().getUTCFullYear() - 30)}-03-12`);
}

/** The username typed on its own step, its check let rest, and Continue pressed. */
async function chooseAndContinue(username: string): Promise<void> {
  fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: username } });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.kept.go") }));
}

const line = () => document.querySelector("[data-kept-line]")?.textContent ?? null;

describe("the right code for an address no account uses", () => {
  test("[account:sign-in-without-secret] given the code step answering new-life, then the age screen follows under the line that says why, with Use another email, its own intro and no line back to the ways back in", async () => {
    gate();
    await proveByCode();
    expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
    expect(line()).toBe(`${say("ui.account.kept.why", { email: EMAIL })} ${say("ui.account.kept.other")}`);
    expect(say("ui.account.kept.why", { email: EMAIL })).toBe("No life is saved with new@example.test yet. Let's start one.");
    expect(screen.getByRole("button", { name: say("ui.account.kept.other") })).toBeDefined();
    expect(screen.getByText(say("ui.account.age.intro.kept"))).toBeDefined();
    expect(screen.queryByText(say("ui.account.age.intro"))).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.age.returning") })).toBeNull();
  });

  test("[account:sign-in-without-secret] given the age screen of a life that came by the code, when Use another email is pressed, then the proof is dropped and the ways back in open with the address emptied and focused", async () => {
    const { account } = gate();
    await proveByCode();
    await screen.findByText(say("ui.account.age.title"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.kept.other") }));
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(screen.getByRole("heading").textContent).toBe(say("ui.account.returning.title"));
    expect(account.calls).toContain("dropNewLife()");
  });

  test("[account:sign-in-without-secret] given the age screen of a life that came by the code, when its back arrow is pressed, then the proof is dropped and the ways back in open with the address filled in", async () => {
    const { account } = gate();
    await proveByCode();
    await screen.findByText(say("ui.account.age.title"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.back") }));
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe(EMAIL);
    expect(account.calls).toContain("dropNewLife()");
  });

  test("[account:sign-in-without-secret] [account:age-screen-refuses-minors] given the age screen of a life that came by the code, when a minor is refused, then the refusal stands and nothing is started", async () => {
    const { account } = gate({ declareAge: () => Promise.resolve("refused") });
    await proveByCode();
    await answerTheAge();
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(line()).toBeNull();
    expect(account.calls.some((call) => call.startsWith("startGuest"))).toBe(false);
  });
});

describe("the username's own step (account:sign-in-without-secret)", () => {
  test("[account:sign-in-without-secret] [account:guest-reminded-to-secure] given the age passed, then the username stands on a step of its own: Choose a username, the door's box, no guest line, one main button Continue, under the line", async () => {
    gate();
    await proveByCode();
    await answerTheAge();
    expect(await screen.findByRole("heading", { name: say("ui.account.kept.name.title") })).toBeDefined();
    expect(say("ui.account.kept.name.title")).toBe("Choose a username");
    const box = screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label"));
    expect(box.value).toBe("");
    expect(box.closest("[data-guest-fields]")).not.toBeNull();
    expect(screen.queryByText(say("ui.guest.reminder"))).toBeNull();
    expect(document.querySelector("[data-guest-line]")).toBeNull();
    expect(line()).toContain(say("ui.account.kept.why", { email: EMAIL }));
    // One main button, in the main colour: Continue.
    const main = screen.getAllByRole("button").filter((button) => button.className.includes("bg-accent"));
    expect(main.map((button) => button.textContent)).toEqual([say("ui.account.kept.go")]);
    expect(screen.queryByRole("button", { name: say("ui.account.name.go") })).toBeNull();
  });

  test("[account:sign-in-without-secret] given an age pass this browser holds already, when the code proves the address, then the age screen is skipped and the username's step opens", async () => {
    gate({ ageStatus: () => Promise.resolve("passed") });
    await proveByCode();
    expect(await screen.findByRole("heading", { name: say("ui.account.kept.name.title") })).toBeDefined();
    expect(screen.queryByText(say("ui.account.age.title"))).toBeNull();
  });

  test("[account:sign-in-without-secret] [account:guest-secures-the-life] given the username's step, when Continue is pressed, then the guest start goes marked as one that came by the code, the gate signs in, and the world says it is saved with the email", async () => {
    const { account, store } = gate();
    await proveByCode();
    await answerTheAge();
    await chooseAndContinue("ada_lagos");
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    await waitFor(() => expect(document.querySelector("[data-way-toast]")?.textContent).toBe(say("ui.account.toast.kept.email")));
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(['startGuest("ada_lagos","proved")']);
    expect(account.calls.filter((call) => call.startsWith("sendCode") || call.startsWith("signInWithCode"))).toEqual([`sendCode("${EMAIL}")`, `signInWithCode("${EMAIL}","123456")`]);
  });

  test("[account:sign-in-without-secret] given a proof that ran out, when Continue answers proof-gone, then a new code goes to the address, its words and the code form stand on the step with the username kept, and the right code lets Continue go on", async () => {
    const { account, store } = gate({ signInWithCode: answers(NEW_LIFE, NEW_LIFE) }, [{ ok: false, why: "proof-gone" }]);
    await proveByCode();
    await answerTheAge();
    await chooseAndContinue("ada_lagos");
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    expect(document.querySelector("[data-code-sent]")?.textContent).toBe(say("ui.account.kept.gone", { email: EMAIL }));
    expect(say("ui.account.kept.gone", { email: EMAIL })).toBe("Your code ran out. We sent a new one to new@example.test.");
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label")).value).toBe("ada_lagos");
    expect(screen.getAllByRole("button", { name: say("ui.account.kept.go") })).toHaveLength(1);
    expect(account.calls.filter((call) => call.startsWith("sendCode"))).toEqual([`sendCode("${EMAIL}")`, `sendCode("${EMAIL}")`]);
    expect(store.getState().signedOut).toBe(true);
    fireEvent.change(code, { target: { value: "654321" } });
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(['startGuest("ada_lagos","proved")', 'startGuest("ada_lagos","proved")']);
  });

  test("[account:sign-in-without-secret] given an address an account took before Continue, when Continue answers so, then a code goes to the address to open it, and its right code signs in with no second account asked for", async () => {
    const { account, store } = gate({ signInWithCode: answers(NEW_LIFE, { ok: true }) }, [{ ok: false, why: "email-taken" }]);
    await proveByCode();
    await answerTheAge();
    await chooseAndContinue("ada_lagos");
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    expect(document.querySelector("[data-code-sent]")?.textContent).toBe(say("ui.account.kept.taken", { email: EMAIL }));
    fireEvent.change(code, { target: { value: "654321" } });
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(['startGuest("ada_lagos","proved")']);
  });

  test("[account:sign-in-without-secret] given two tabs on one proof, when this tab's Continue finds the browser signed in by the other, then the gate opens what the session holds, with no error", async () => {
    const { store } = gate({}, [{ ok: false, why: "here" }]);
    await proveByCode();
    await answerTheAge();
    await chooseAndContinue("ada_lagos");
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("[account:sign-in-without-secret] [server:signups-off-shows-full] given sign-ups switched off before Continue, then the full screen stands, and once they open again the username's step comes back with the username kept", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let open = false;
    const { account } = gate({ ageStatus: () => Promise.resolve(open ? { proved: EMAIL, passed: true } : "unasked") }, [{ ok: false, why: "full" }]);
    await proveByCode();
    await answerTheAge();
    await chooseAndContinue("ada_lagos");
    expect(await screen.findByText(say("server.full"))).toBeDefined();
    open = true;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });
    expect(await screen.findByRole("heading", { name: say("ui.account.kept.name.title") })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label")).value).toBe("ada_lagos");
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(['startGuest("ada_lagos","proved")']);
  });
});

describe("a proof this browser holds when the gate opens (account:sign-in-without-secret)", () => {
  test("[account:sign-in-without-secret] given the server naming a live proof and no age pass, when the gate opens, then it opens on the age screen under the line with the address shown", async () => {
    gate({ ageStatus: () => Promise.resolve({ proved: EMAIL, passed: false }) });
    expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
    expect(line()).toContain(say("ui.account.kept.why", { email: EMAIL }));
  });

  test("[account:sign-in-without-secret] given the server naming a live proof and an age pass, when the gate opens, then it opens on the username's step", async () => {
    gate({ ageStatus: () => Promise.resolve({ proved: EMAIL, passed: true }) });
    expect(await screen.findByRole("heading", { name: say("ui.account.kept.name.title") })).toBeDefined();
    expect(line()).toContain(say("ui.account.kept.why", { email: EMAIL }));
  });

  test("[account:guest-reminded-to-secure] given Play with no proof, when the door's page asks for the username, then the guest line is said there", async () => {
    const account = codeAccount();
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={passing} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.play") }));
    await answerAge(`${String(new Date().getUTCFullYear() - 30)}-03-12`);
    await screen.findByLabelText(say("ui.account.name.label"));
    expect(screen.getByText(say("ui.guest.reminder"))).toBeDefined();
    expect(line()).toBeNull();
  });
});
