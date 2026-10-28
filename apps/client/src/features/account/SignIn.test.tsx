// The ways back in once a code is sent, and an address with no account told plainly (account:code-form-forgives,
// account:sign-in-without-secret, account:guest-secures-the-life): the code step stands alone; the send looks for the account
// first, and an address none uses is offered a new life kept with it, whose own code proves the address before the life's start.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { GameProvider } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi, AuthResult, GuestAnswer } from "../../shared/net/auth";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { answerAge } from "./age.testing";
import { answers, codeAccount } from "./code.testing";
import { SignIn } from "./SignIn";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";
import { WayToast } from "./WayToast";

const NO_ACCOUNT: AuthResult = { ok: false, why: "no-life" };
const cannot = () => Promise.resolve(false);

beforeEach(() => {
  localStorage.clear();
});

function ways(over: Partial<AccountApi> = {}) {
  const account = codeAccount(over);
  const signedIn = vi.fn();
  const newLife = vi.fn();
  render(<SignIn account={account} onSignedIn={signedIn} onNewLife={newLife} onBack={() => undefined} autofill={cannot} passkeyUsed={false} />);
  return { account, signedIn, newLife };
}

function send(address: string) {
  fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: address } });
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
}

const heading = () => screen.getByRole("heading").textContent;
const google = () => screen.queryByRole("button", { name: say("ui.account.google") });
const passkey = () => screen.queryByRole("button", { name: say("ui.account.passkey") });

describe("the code step stands alone (account:code-form-forgives)", () => {
  test("[account:code-form-forgives] given a code sent, then the sheet holds the code step alone under Check your email: no Google, no passkey, no intro; Change brings the ways back with the address filled and focused", async () => {
    ways();
    expect(heading()).toBe(say("ui.account.returning.title"));
    expect(google()).not.toBeNull();
    expect(passkey()).not.toBeNull();
    expect(screen.getByText(say("ui.account.returning.intro"))).toBeDefined();
    send("ada@example.test");
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    expect(heading()).toBe(say("ui.account.code.title"));
    expect(say("ui.account.code.title")).toBe("Check your email");
    expect(google()).toBeNull();
    expect(passkey()).toBeNull();
    expect(screen.queryByText(say("ui.account.returning.intro"))).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(code));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.change") }));
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe("ada@example.test");
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(google()).not.toBeNull();
    expect(heading()).toBe(say("ui.account.returning.title"));
  });
});

describe("an address no account uses (account:sign-in-without-secret)", () => {
  test("[account:sign-in-without-secret] given the send answering no-account, then the form, Google and the passkey give way to the plain answer, the new life with this email as the main button and another email as the quiet one", async () => {
    const { account } = ways({ sendCode: answers(NO_ACCOUNT) });
    send("new@example.test");
    const said = await screen.findByRole("alert");
    expect(said.textContent).toBe(say("ui.account.none", { email: "new@example.test" }));
    expect(said.textContent).toBe("No account uses new@example.test.");
    expect(screen.queryByLabelText(say("ui.account.email.label"))).toBeNull();
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    expect(google()).toBeNull();
    expect(passkey()).toBeNull();
    expect(say("ui.account.none.new")).toBe("Start a new life with this email");
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.none.other") }));
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(email));
    expect(google()).not.toBeNull();
    expect(account.calls).toEqual(['sendCode("new@example.test")']);
  });

  test("[account:guest-secures-the-life] given Start a new life with this email, then a new life's code goes to the address and the one code step stands under Check your email; its code proves the address and the new life's start opens", async () => {
    const { account, newLife, signedIn } = ways({ sendCode: answers(NO_ACCOUNT) });
    send("new@example.test");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.none.new") }));
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    expect(heading()).toBe(say("ui.account.code.title"));
    expect(document.querySelector("[data-code-sent]")?.textContent).toContain(say("ui.account.code.sent", { email: "new@example.test" }));
    await waitFor(() => expect(document.activeElement).toBe(code));
    fireEvent.change(code, { target: { value: "123456" } });
    await waitFor(() => expect(newLife).toHaveBeenCalledOnce());
    expect(newLife).toHaveBeenCalledWith(true);
    expect(signedIn).not.toHaveBeenCalled();
    expect(account.calls).toEqual(['sendCode("new@example.test")', 'sendCode("new@example.test","new life")', 'proveNewLife("new@example.test","123456")']);
  });

  test("[account:guest-secures-the-life] [account:code-form-forgives] given a new life's code that is wrong, then it is told as any wrong code is and the life's start waits; Change goes back to the address, filled", async () => {
    const { newLife } = ways({ sendCode: answers(NO_ACCOUNT), proveNewLife: answers({ ok: false, why: "wrong-code" }) });
    send("new@example.test");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.none.new") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "000000" } });
    await waitFor(() => expect(screen.getByText(say("ui.account.fail.wrong-code"))).toBeDefined());
    expect(newLife).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.change") }));
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe("new@example.test");
    await waitFor(() => expect(document.activeElement).toBe(email));
  });

  test("[account:guest-secures-the-life] given a new life's send to an address an account took meanwhile, then it is told to sign in instead and the answer stays", async () => {
    ways({ sendCode: answers(NO_ACCOUNT, { ok: false, why: "email-taken" }) });
    send("new@example.test");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.none.new") }));
    await waitFor(() => expect(screen.getByText(say("ui.account.fail.email-taken"))).toBeDefined());
    expect(say("ui.account.fail.email-taken")).toBe("That email already has an account. Sign in instead.");
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.account.none.other") })).toBeDefined();
  });

  test("[account:sign-in-without-secret] given a passkey no account holds, then its own words stand with Start a new life under them, and the ways stay", async () => {
    const { newLife } = ways({ signInWithPasskey: answers({ ok: false, why: "passkey-gone" }) });
    fireEvent.click(passkey() as HTMLElement);
    const said = await screen.findByRole("alert");
    expect(said.textContent).toBe(say("ui.account.fail.passkey-gone"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.kept.play") }));
    expect(newLife).toHaveBeenCalledOnce();
    expect(newLife).toHaveBeenCalledWith(false);
    expect(google()).not.toBeNull();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });

  test("[account:sign-in-without-secret] given Google came back having found no account, then its words stand at the top with Start a new life under them", async () => {
    const account = codeAccount();
    const newLife = vi.fn();
    render(<SignIn account={account} onSignedIn={() => undefined} onNewLife={newLife} problem={say("ui.account.fail.no-life")} noneFound autofill={cannot} passkeyUsed={false} />);
    expect((await screen.findByRole("alert")).textContent).toBe(say("ui.account.fail.no-life"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.kept.play") }));
    expect(newLife).toHaveBeenCalledOnce();
  });
});

describe("the new life kept from the start (account:guest-secures-the-life)", () => {
  const passing: LoadTurnstile = () =>
    Promise.resolve({
      render: (_container, options) => {
        setTimeout(() => options.callback("XXXX.DUMMY.TOKEN.XXXX"), 0);
        return "widget-1";
      },
      reset: () => undefined,
      remove: () => undefined,
    });

  async function throughTheStart(guest: GuestAnswer) {
    const account = codeAccount({ sendCode: answers(NO_ACCOUNT), startGuest: (username) => (account.calls.push(`startGuest(${JSON.stringify(username)})`), Promise.resolve(guest)) });
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={passing} sitekey={TEST_SITE_KEY} />
        <WayToast account={account} />
      </GameProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.returning") }));
    send("new@example.test");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.none.new") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    // The new life's own start, as Play's: the age screen first.
    expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
    const today = new Date();
    await answerAge(`${String(today.getUTCFullYear() - 30)}-03-12`);
    fireEvent.change(await screen.findByLabelText(say("ui.account.name.label")), { target: { value: "ada_lagos" } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.name.go") }));
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    return account;
  }

  test("[account:guest-secures-the-life] [account:guest-reminded-to-secure] given a new life's address proved, when the door's page asks for the username, then the line that the life lives only on this phone is not said, and nothing stands in its place", async () => {
    const account = codeAccount({ sendCode: answers(NO_ACCOUNT) });
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={passing} sitekey={TEST_SITE_KEY} />
      </GameProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.returning") }));
    send("new@example.test");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.none.new") }));
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
    await answerAge(`${String(new Date().getUTCFullYear() - 30)}-03-12`);
    const box = await screen.findByLabelText(say("ui.account.name.label"));
    expect(screen.queryByText(say("ui.guest.reminder"))).toBeNull();
    expect(document.querySelector("[data-guest-line]")).toBeNull();
    expect(box.closest("[data-guest-fields]")?.textContent).not.toContain(say("ui.guest.reminder"));
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
  });

  test("[account:guest-secures-the-life] given a new life's address proved, when the life starts, then the world says it is saved with the email, as after any keep, with nothing typed again", async () => {
    const account = await throughTheStart({ ok: true, email: "kept" });
    await waitFor(() => expect(document.querySelector("[data-way-toast]")?.textContent).toBe(say("ui.account.toast.kept.email")));
    expect(account.calls.filter((call) => call.startsWith("sendCode") || call.startsWith("proveNewLife"))).toEqual(['sendCode("new@example.test")', 'sendCode("new@example.test","new life")', 'proveNewLife("new@example.test","123456")']);
    expect(account.calls).toContain('startGuest("ada_lagos")');
  });

  test("[account:guest-secures-the-life] given the proved address taken by an account before the start, then the life starts as a guest and the world says so", async () => {
    await throughTheStart({ ok: true, email: "taken" });
    await waitFor(() => expect(document.querySelector("[data-way-toast]")?.textContent).toBe(say("ui.account.toast.taken.email")));
  });
});
