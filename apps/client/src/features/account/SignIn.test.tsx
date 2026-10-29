// The ways back in once a code is sent (account:code-form-forgives, account:sign-in-without-secret): the code step stands alone;
// the send answers every address alike, and only the right code tells the two apart: it signs in, or hands on the address it
// proved for a new life. A passkey or a trip to Google that found no life keeps its words, with a new life under them.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { AccountApi } from "../../shared/net/auth";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { answers, codeAccount } from "./code.testing";
import { SignIn } from "./SignIn";

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
  test("[account:sign-in-without-secret] given an address no account uses, when Send me a code is pressed, then the send answers as for any address and the code step stands, the code sent there", async () => {
    const { account } = ways();
    send("new@example.test");
    const code = await screen.findByLabelText(say("ui.account.code.label"));
    expect(heading()).toBe(say("ui.account.code.title"));
    expect(document.querySelector("[data-code-sent]")?.textContent).toContain(say("ui.account.code.sent", { email: "new@example.test" }));
    expect(say("ui.account.code.sent", { email: "new@example.test" })).toBe("We sent a code to new@example.test.");
    await waitFor(() => expect(document.activeElement).toBe(code));
    expect(document.querySelector("[data-no-account]")).toBeNull();
    expect(account.calls).toEqual(['sendCode("new@example.test")']);
  });

  test("[account:sign-in-without-secret] given the right code for an address no account uses, when the code check answers new-life, then the sheet hands the proved address on to a new life's start and signs in to nothing", async () => {
    const { account, newLife, signedIn } = ways({ signInWithCode: answers({ ok: true, newLife: true }) });
    send("new@example.test");
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "123456" } });
    await waitFor(() => expect(newLife).toHaveBeenCalledOnce());
    expect(newLife).toHaveBeenCalledWith("new@example.test");
    expect(signedIn).not.toHaveBeenCalled();
    expect(account.calls).toEqual(['sendCode("new@example.test")', 'signInWithCode("new@example.test","123456")']);
  });

  test("[account:sign-in-without-secret] [account:code-form-forgives] given a wrong code for an address no account uses, then it is told as any wrong code is and nothing starts; Change goes back to the address, filled", async () => {
    const { newLife, signedIn } = ways({ signInWithCode: answers({ ok: false, why: "wrong-code" }) });
    send("new@example.test");
    fireEvent.change(await screen.findByLabelText(say("ui.account.code.label")), { target: { value: "000000" } });
    await waitFor(() => expect(screen.getByText(say("ui.account.fail.wrong-code"))).toBeDefined());
    expect(newLife).not.toHaveBeenCalled();
    expect(signedIn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.code.change") }));
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe("new@example.test");
    await waitFor(() => expect(document.activeElement).toBe(email));
  });

  test("[account:sign-in-without-secret] given the ways back in opened from a new life's Use another email, then the email field is empty and holds the focus", async () => {
    const account = codeAccount();
    render(<SignIn account={account} onSignedIn={() => undefined} filled="" focusEmail autofill={cannot} passkeyUsed={false} />);
    const email = await screen.findByLabelText<HTMLInputElement>(say("ui.account.email.label"));
    expect(email.value).toBe("");
    await waitFor(() => expect(document.activeElement).toBe(email));
  });

  test("[account:sign-in-without-secret] given a passkey no account holds, then its own words stand with Start a new life under them, and the ways stay", async () => {
    const { newLife } = ways({ signInWithPasskey: answers({ ok: false, why: "passkey-gone" }) });
    fireEvent.click(passkey() as HTMLElement);
    const said = await screen.findByRole("alert");
    expect(said.textContent).toBe(say("ui.account.fail.passkey-gone"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.kept.play") }));
    expect(newLife).toHaveBeenCalledExactlyOnceWith(null);
    expect(google()).not.toBeNull();
    expect(screen.getByLabelText(say("ui.account.email.label"))).toBeDefined();
  });

  test("[account:sign-in-without-secret] given Google came back having found no account, then its words stand at the top with Start a new life under them", async () => {
    const account = codeAccount();
    const newLife = vi.fn();
    render(<SignIn account={account} onSignedIn={() => undefined} onNewLife={newLife} problem={say("ui.account.fail.no-life")} noneFound autofill={cannot} passkeyUsed={false} />);
    expect((await screen.findByRole("alert")).textContent).toBe(say("ui.account.fail.no-life"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.start.kept.play") }));
    expect(newLife).toHaveBeenCalledExactlyOnceWith(null);
  });
});
