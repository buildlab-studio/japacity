// The code step says one thing at a time (account:code-form-forgives, account:email-code-is-short-lived): each answer to a code
// told as what it means and what to do, in one status slot that holds one line at a time.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { AccountApi, AuthResult } from "../../shared/net/auth";
import { stubPointer } from "../../shared/testing/pointer";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { answers, codeAccount } from "./code.testing";
import { CodeForm, RESEND_WAIT_S } from "./CodeForm";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function form(over: Partial<AccountApi> = {}) {
  const account = codeAccount(over);
  const signedIn = vi.fn();
  render(<CodeForm account={account} onSignedIn={signedIn} />);
  return { account, signedIn };
}

async function sent(address = "ada@example.test"): Promise<HTMLInputElement> {
  fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: address } });
  fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
  return await screen.findByLabelText<HTMLInputElement>(say("ui.account.code.label"));
}

const slot = () => screen.getByRole("status");
const go = () => screen.getByRole<HTMLButtonElement>("button", { name: say("ui.account.code.go") });
const nudgeLink = () => screen.queryByRole("button", { name: say("ui.account.code.nudge.again") });

/** The slot's words for an answer, with the code typed and the answer waited for. */
async function answered(why: AuthResult): Promise<{ account: ReturnType<typeof codeAccount>; field: HTMLInputElement }> {
  const { account } = form({ signInWithCode: answers(why) });
  const field = await sent();
  fireEvent.change(field, { target: { value: "123456" } });
  await waitFor(() => expect(account.calls).toContain('signInWithCode("ada@example.test","123456")'));
  return { account, field };
}

describe("the first field's focus on a phone (account:code-form-forgives)", () => {
  test("[account:code-form-forgives] given a touch phone, when the form opens with the address asked for focus, then no focus moves, so no keyboard rises over the ways back in", async () => {
    stubPointer("coarse");
    render(<CodeForm account={codeAccount()} focusEmail onSignedIn={() => undefined} />);
    await screen.findByLabelText(say("ui.account.email.label"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(document.body);
  });

  test("[account:code-form-forgives] given a desktop, when the form opens with the address asked for focus, then the address field takes it", async () => {
    stubPointer("fine");
    render(<CodeForm account={codeAccount()} focusEmail onSignedIn={() => undefined} />);
    const email = await screen.findByLabelText(say("ui.account.email.label"));
    await waitFor(() => expect(document.activeElement).toBe(email));
  });

  test("[account:code-form-forgives] given a touch phone, when a code is sent, then the code step opens with no focus in the field; a wrong code then focuses it with its digits selected", async () => {
    stubPointer("coarse");
    const account = codeAccount({ signInWithCode: answers({ ok: false, why: "wrong-code" }) });
    render(<CodeForm account={account} onSignedIn={() => undefined} />);
    const field = await sent();
    await act(async () => {
      await Promise.resolve();
    });
    expect(document.activeElement).not.toBe(field);
    fireEvent.change(field, { target: { value: "123456" } });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.wrong-code")));
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 6]);
  });

  test("[account:code-form-forgives] given a touch phone, when Send me a code is pressed with an address of the wrong shape, then nothing is sent and the address field takes the focus with the reason under it", () => {
    stubPointer("coarse");
    const { account } = form();
    const email = screen.getByLabelText(say("ui.account.email.label"));
    fireEvent.change(email, { target: { value: "ada@example" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    expect(slot().textContent).toBe(say("ui.account.email.shape"));
    expect(document.activeElement).toBe(email);
    expect(account.calls).toEqual([]);
  });

  test("[account:code-form-forgives] given a touch phone, when Sign in is pressed with fewer than six digits, then the code field takes the focus with the reason under it", async () => {
    stubPointer("coarse");
    form();
    const field = await sent();
    fireEvent.change(field, { target: { value: "123" } });
    fireEvent.click(go());
    expect(slot().textContent).toBe(say("ui.account.code.short"));
    expect(document.activeElement).toBe(field);
  });
});

describe("the code step (account:code-form-forgives)", () => {
  test("[account:code-form-forgives] given a code sent on a desktop, then the step says where it went with Change after the address, the field is labelled for screen readers alone and takes the focus, and the slot holds nothing", async () => {
    stubPointer("fine");
    form();
    const field = await sent();
    await waitFor(() => expect(document.activeElement).toBe(field));
    const line = document.querySelector("[data-code-sent]");
    expect(line?.textContent).toBe(`${say("ui.account.code.sent", { email: "ada@example.test" })}\u00a0${say("ui.account.code.change")}`);
    expect(field.getAttribute("aria-label")).toBe(say("ui.account.code.label"));
    expect(screen.queryByText(say("ui.account.code.label"))).toBeNull();
    expect(slot().textContent).toBe("");
    expect(document.body.textContent).not.toMatch(/5 minutes|spam or promotions/);
  });

  test("[account:code-form-forgives] given a code sent, then Change stands inside the sent line, glued to the address by a space that never breaks, so it wraps with the words and never stands on a line of its own", async () => {
    form();
    await sent();
    const line = document.querySelector<HTMLElement>("[data-code-sent]");
    const change = screen.getByRole("button", { name: say("ui.account.code.change") });
    expect(change.parentElement?.closest("[data-code-sent]")).toBe(line);
    expect(line?.textContent).toBe(`${say("ui.account.code.sent", { email: "ada@example.test" })}\u00a0${say("ui.account.code.change")}`);
    expect(change.className).not.toMatch(/\b(block|flex|min-h-\S+)\b/);
  });

  test("[account:code-form-forgives] [world:field-says-its-state] given a wrong code, then the slot under the field says so in the out colour with the problem's icon and the field is marked, the digits are selected so typing replaces them, and Sign in stays off until they change: the same code is never sent twice", async () => {
    const { account, field } = await answered({ ok: false, why: "wrong-code" });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.wrong-code")));
    expect(say("ui.account.fail.wrong-code")).toBe("That code is not right.");
    expect(slot().className).toContain("text-out");
    expect(slot().querySelector("svg")?.getAttribute("class")).toContain("lucide-circle-alert");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(field.getAttribute("aria-describedby")).toBe(slot().id);
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 6]);
    expect(go().disabled).toBe(true);
    fireEvent.click(go());
    fireEvent.submit(field);
    // Typed again digit by digit to the same six: still never sent.
    fireEvent.change(field, { target: { value: "12345" } });
    fireEvent.change(field, { target: { value: "123456" } });
    await act(async () => {
      await Promise.resolve();
    });
    expect(account.calls.filter((call) => call.startsWith("signInWithCode"))).toHaveLength(1);
    expect(go().disabled).toBe(true);
    // Typing over the selected digits starts a new code.
    fireEvent.change(field, { target: { value: "6" } });
    expect(go().disabled).toBe(false);
    fireEvent.change(field, { target: { value: "654321" } });
    await waitFor(() => expect(account.calls).toContain('signInWithCode("ada@example.test","654321")'));
  });

  test("[account:code-form-forgives] given a wrong code told, when the digits change, then the error goes and Sign in comes back", async () => {
    const { field } = await answered({ ok: false, why: "wrong-code" });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.wrong-code")));
    fireEvent.change(field, { target: { value: "12345" } });
    expect(slot().textContent).toBe("");
    expect(go().disabled).toBe(false);
  });

  test("[account:email-code-is-short-lived] [account:code-form-forgives] given a code whose tries are used up on a desktop, then the field and Sign in go, the slot says so, and Send a new code is the one button at once", async () => {
    stubPointer("fine");
    const { account } = await answered({ ok: false, why: "used-up" });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.used-up")));
    expect(say("ui.account.fail.used-up")).toBe("Too many wrong tries. Send a new code.");
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.code.go") })).toBeNull();
    const again = screen.getByRole<HTMLButtonElement>("button", { name: say("ui.account.code.again") });
    expect(again.disabled).toBe(false);
    fireEvent.click(again);
    const field = await screen.findByLabelText(say("ui.account.code.label"));
    expect(account.calls.filter((call) => call.startsWith("sendCode"))).toEqual(['sendCode("ada@example.test")', 'sendCode("ada@example.test")']);
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.code.resent")));
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  test("[account:email-code-is-short-lived] [account:code-form-forgives] given a code that ran out, then it is told as run out, with Send a new code the one button at once", async () => {
    await answered({ ok: false, why: "expired" });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.expired")));
    expect(say("ui.account.fail.expired")).toBe("That code has run out.");
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.account.code.again") })).toBeDefined();
  });

  test("[account:code-form-forgives] [account:sign-in-routes-rate-limited] given the checks from this address over the library's limit, then it is told apart from used-up tries: wait a few seconds, with the field and Sign in still there", async () => {
    await answered({ ok: false, why: "slow-down" });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.slow-down")));
    expect(say("ui.account.fail.slow-down")).toBe("Too many tries at once. Wait a few seconds and try again.");
    expect(screen.getByLabelText(say("ui.account.code.label"))).toBeDefined();
    expect(go().disabled).toBe(false);
    expect(say("ui.account.fail.slow-down")).not.toBe(say("ui.account.fail.used-up"));
  });

  test("[account:code-form-forgives] given a code sent, then the way to a new code is absent for 30 seconds and then stands in the slot as a quiet link; after a new code the slot says to use the newest", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { account } = form();
    await sent();
    expect(nudgeLink()).toBeNull();
    expect(screen.queryByRole("button", { name: say("ui.account.code.again") })).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_WAIT_S * 1000 - 50);
    });
    expect(nudgeLink()).toBeNull();
    expect(slot().textContent).toBe("");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(slot().textContent).toBe(say("ui.account.code.nudge").replace("{again}", say("ui.account.code.nudge.again")));
    expect(slot().textContent).toBe("No code? Check spam, or send a new one.");
    fireEvent.click(nudgeLink() as HTMLElement);
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.code.resent")));
    expect(say("ui.account.code.resent")).toBe("We sent a new code. Use the newest one.");
    expect(nudgeLink()).toBeNull();
    expect(account.calls).toEqual(['sendCode("ada@example.test")', 'sendCode("ada@example.test")']);
    // The wait starts again with the new code, and its end replaces the new code's line.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_WAIT_S * 1000);
    });
    expect(nudgeLink()).not.toBeNull();
  });

  test("[account:code-form-forgives] given the way to a new code standing, when a code is refused, then the error replaces it: the slot holds one thing", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { account } = form({ signInWithCode: answers({ ok: false, why: "wrong-code" }) });
    const field = await sent();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_WAIT_S * 1000);
    });
    expect(nudgeLink()).not.toBeNull();
    fireEvent.change(field, { target: { value: "000000" } });
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.wrong-code")));
    expect(nudgeLink()).toBeNull();
    // The error's icon and its words, and nothing else: no quiet link beside them.
    expect([...slot().children].map((child) => child.tagName.toLowerCase())).toEqual(["svg", "span"]);
    expect(slot().querySelector("button")).toBeNull();
    expect(account.calls).toContain('signInWithCode("ada@example.test","000000")');
    // The digits change and the error goes; the way to a new code is back.
    fireEvent.change(field, { target: { value: "00000" } });
    expect(nudgeLink()).not.toBeNull();
  });

  test("[account:code-form-forgives] given a send refused for its limits, then its own words stand in the slot under the field, and the form stays at the address", async () => {
    form({ sendCode: answers({ ok: false, why: "too-many" }) });
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.too-many")));
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  test("[account:code-form-forgives] given the sixth digit, then it sends the code once, and a press of Sign in at the same moment adds nothing", async () => {
    let release: (result: AuthResult) => void = () => undefined;
    const { account, signedIn } = form({ signInWithCode: () => new Promise<AuthResult>((resolve) => (release = resolve)) });
    const field = await sent();
    fireEvent.change(field, { target: { value: "123456" } });
    fireEvent.click(go());
    await act(async () => {
      release({ ok: true });
      await Promise.resolve();
    });
    await waitFor(() => expect(signedIn).toHaveBeenCalledOnce());
    expect(account.calls.filter((call) => call.startsWith("signInWithCode"))).toHaveLength(1);
  });

  test("[account:sign-in-without-secret] given a code already sent to a known address with a line of its own, on a desktop, then the form opens on the code step under that line with the focus in the field, a new code goes to the address, and a code that proves the address for a new life hands it on without signing in", async () => {
    stubPointer("fine");
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const account = codeAccount({ signInWithCode: answers({ ok: true, newLife: true }) });
    const signedIn = vi.fn();
    const newLife = vi.fn();
    const line = say("ui.account.kept.gone", { email: "new@example.test" });
    render(<CodeForm account={account} email="new@example.test" sent sentSaid={line} onSignedIn={signedIn} onNewLife={newLife} />);
    const field = screen.getByLabelText(say("ui.account.code.label"));
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(document.querySelector("[data-code-sent]")?.textContent).toBe(line);
    expect(line).toBe("Your code ran out. We sent a new one to new@example.test.");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_WAIT_S * 1000);
    });
    fireEvent.click(nudgeLink() as HTMLElement);
    await waitFor(() => expect(account.calls).toEqual(['sendCode("new@example.test")']));
    fireEvent.change(field, { target: { value: "123456" } });
    await waitFor(() => expect(newLife).toHaveBeenCalledExactlyOnceWith("new@example.test"));
    expect(signedIn).not.toHaveBeenCalled();
    expect(account.calls).toEqual(['sendCode("new@example.test")', 'signInWithCode("new@example.test","123456")']);
  });
});

describe("the go button's look (account:player-deletes-account)", () => {
  test("[account:player-deletes-account] [world:costly-acts-confirmed] given the code form, then its go button is the main yellow, and the warning colour where the code itself confirms a costly act; only the deletion asks for that", async () => {
    form();
    await sent();
    expect(go().className).toContain("bg-accent");
    document.body.innerHTML = "";
    render(<CodeForm account={codeAccount()} email="ada@example.test" sent goVariant="warning" goLabel="Delete with this code" onSignedIn={() => undefined} />);
    const warning = screen.getByRole("button", { name: "Delete with this code" });
    expect(warning.className).toContain("text-bad");
    expect(warning.className).not.toContain("bg-accent");
    const callers = Object.entries(import.meta.glob<string>("./*.tsx", { query: "?raw", import: "default", eager: true }))
      .filter(([file, source]) => !file.includes(".test.") && file !== "./CodeForm.tsx" && source.includes("goVariant"))
      .map(([file]) => file);
    expect(callers).toEqual(["./Settings.tsx"]);
  });
});

/** Turnstile's stand-in, keeping the action each widget was drawn with: a token named by its action and its count a moment after each draw and reset. */
function drawn(): { load: LoadTurnstile; actions: string[] } {
  const actions: string[] = [];
  const load: LoadTurnstile = () => {
    let given = 0;
    let solve: (() => void) | null = null;
    return Promise.resolve({
      render: (_container, options) => {
        actions.push(options.action);
        solve = () => setTimeout(() => options.callback(`${options.action}-${String((given += 1))}`), 0);
        solve();
        return "widget-1";
      },
      reset: () => solve?.(),
      remove: () => undefined,
    });
  };
  return { load, actions };
}

describe("the bot check on each send (account:bot-check-on-code-send)", () => {
  test("[account:bot-check-on-code-send] given the form's unseen check, when a code is sent and sent again, then the widget is drawn for the code send and each send carries a fresh token of its own", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { load, actions } = drawn();
    const tokens: (string | null)[] = [];
    const account = codeAccount({ sendCode: (_email, bot) => (tokens.push(bot), Promise.resolve({ ok: true })) });
    render(<CodeForm account={account} sitekey={TEST_SITE_KEY} load={load} onSignedIn={() => undefined} />);
    await waitFor(() => expect(actions).toEqual(["code"]));
    await sent();
    expect(tokens).toEqual(["code-1"]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RESEND_WAIT_S * 1000);
    });
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.code.nudge.again") }));
    await waitFor(() => expect(tokens).toEqual(["code-1", "code-2"]));
  });

  test("[account:bot-check-on-code-send] given a send refused for its bot check, when the slot speaks, then it says the check did not go through and to send the code again", async () => {
    const { load } = drawn();
    const account = codeAccount({ sendCode: answers({ ok: false, why: "bot-check" }) });
    render(<CodeForm account={account} sitekey={TEST_SITE_KEY} load={load} onSignedIn={() => undefined} />);
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.fail.bot-check")));
    expect(say("ui.account.fail.bot-check")).toBe("The quick check did not go through. Wait a moment, then send the code again.");
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
  });

  test("[account:bot-check-on-code-send] given a check whose script could not load, when a send is asked, then the script is loaded again for it, and a refusal for the check says it could not load and to send the code again", async () => {
    let loads = 0;
    const load: LoadTurnstile = () => {
      loads += 1;
      return Promise.reject(new Error("blocked"));
    };
    const account = codeAccount({ sendCode: answers({ ok: false, why: "bot-check" }, { ok: false, why: "bot-check" }) });
    render(<CodeForm account={account} sitekey={TEST_SITE_KEY} load={load} onSignedIn={() => undefined} />);
    await waitFor(() => expect(loads).toBe(1));
    fireEvent.change(screen.getByLabelText(say("ui.account.email.label")), { target: { value: "ada@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    await waitFor(() => expect(slot().textContent).toBe(say("ui.account.bot.unloaded.code")));
    expect(say("ui.account.bot.unloaded.code")).toBe("The quick check could not load. Check your connection, or turn off any blocker for this page, then send the code again.");
    expect(loads).toBe(2);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.email.send") }));
    await waitFor(() => expect(loads).toBe(3));
  });
});
