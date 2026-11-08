// Google's return with no life on the gate (account:sign-in-without-secret, account:guest-secures-the-life): the page comes home with
// the new life's error, the standing names the proof Google made, and the gate opens the steps the code opens, in Google's words
// where Google is the way; Continue makes the account saved with Google, and a proof run out offers Google again.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";

import { GameProvider, useGame } from "../../authority/GameProvider";
import { createGameStore } from "../../authority/store";
import type { AccountApi, AgeStanding, Full, GuestAnswer, HeldProof } from "../../shared/net/auth";
import { NEW_LIFE_NAME_KEY } from "../../shared/storage/storage";
import { engineView } from "../../shared/testing/fixtures";
import "../../shared/testing/render";
import { say } from "../../shared/words/text";
import { AccountGate } from "./AccountGate";
import { answerAge } from "./age.testing";
import { codeAccount, type Faked } from "./code.testing";
import { TEST_SITE_KEY, type LoadTurnstile } from "./Turnstile";
import { SecureAsk } from "./Secure";

const EMAIL = "ada@example.test";
const BY_GOOGLE: HeldProof = { proved: EMAIL, google: true, passed: false };

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

/** Turnstile's stand-in: a token a moment after the widget is drawn, and a fresh one a moment after each reset. */
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

/** The world's asks, mounted once the life is signed in, as the shell mounts them with the world (account:guest-secures-the-life). */
function World() {
  const signedOut = useGame((state) => state.signedOut);
  return signedOut ? null : <SecureAsk />;
}

/** The gate signed out over the world's line, back from Google with the new life's mark and the standing given. */
function backFromGoogle(standing: AgeStanding | Full | HeldProof, guest: GuestAnswer[] = [], over: Partial<AccountApi> = {}) {
  let returned: ReturnType<AccountApi["returnedFromGoogle"]> = "new-life";
  let account: Faked | null = null;
  account = codeAccount({
    ageStatus: () => Promise.resolve(standing),
    returnedFromGoogle: () => {
      const back = returned;
      returned = null;
      return back;
    },
    startGuest: (username, _bot, proved) => {
      account?.calls.push(`startGuest(${JSON.stringify(username)}${proved === true ? ',"proved"' : ""})`);
      return Promise.resolve(guest.shift() ?? { ok: true, email: "kept" });
    },
    ...over,
  });
  const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
  store.getState().leave(null);
  const view = render(
    <GameProvider store={store}>
      <AccountGate load={passing} sitekey={TEST_SITE_KEY} />
      <World />
    </GameProvider>,
  );
  return { account, store, view };
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

describe("the page home from Google with the new life's mark", () => {
  test("[account:sign-in-without-secret] given the standing naming a proof Google made, then the age screen opens under the code's line with Use another way, its own intro and no line back to the ways back in", async () => {
    backFromGoogle(BY_GOOGLE);
    expect(await screen.findByText(say("ui.account.age.title"))).toBeDefined();
    expect(line()).toBe(`${say("ui.account.kept.why", { email: EMAIL })} ${say("ui.account.kept.other.google")}`);
    expect(say("ui.account.kept.other.google")).toBe("Use another way");
    expect(screen.queryByRole("button", { name: say("ui.account.kept.other") })).toBeNull();
    expect(screen.getByText(say("ui.account.age.intro.kept"))).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.age.returning") })).toBeNull();
  });

  test("[account:sign-in-without-secret] [account:guest-secures-the-life] given the age passed, when Continue sends the username, then the guest start goes marked proved, the gate signs in, no code is sent, and the world opens on the keep-this-life sheet in its Kept state, which says Saved with Google as it closes", async () => {
    const { account, store } = backFromGoogle(BY_GOOGLE);
    await answerTheAge();
    expect(await screen.findByRole("heading", { name: say("ui.account.kept.name.title") })).toBeDefined();
    expect(line()).toContain(say("ui.account.kept.why", { email: EMAIL }));
    await chooseAndContinue("ada_lagos");
    await waitFor(() => expect(store.getState().signedOut).toBe(false));
    // The world opens on the keep-this-life sheet in its Kept state; its line is said as it closes.
    const kept = await screen.findByRole("dialog", { name: say("ui.secure.done.title") });
    expect(within(kept).getByText(say("ui.secure.done"))).toBeDefined();
    expect(document.querySelector("[data-way-toast]")).toBeNull();
    fireEvent.click(within(kept).getByRole("button", { name: say("ui.report.close") }));
    await waitFor(() => expect(document.querySelector("[data-way-toast]")?.textContent).toBe(say("ui.account.toast.kept.google")));
    expect(say("ui.account.toast.kept.google")).toBe("Saved with Google");
    expect(account.calls.filter((call) => call.startsWith("startGuest"))).toEqual(['startGuest("ada_lagos","proved")']);
    expect(account.calls.filter((call) => call.startsWith("sendCode") || call.startsWith("signInWithCode"))).toEqual([]);
  });

  test("[account:sign-in-without-secret] given a reload with an age pass held after Google's return, then the gate opens on the username's step under the line", async () => {
    backFromGoogle({ ...BY_GOOGLE, passed: true });
    expect(await screen.findByRole("heading", { name: say("ui.account.kept.name.title") })).toBeDefined();
    expect(screen.queryByText(say("ui.account.age.title"))).toBeNull();
    expect(screen.getByRole("button", { name: say("ui.account.kept.other.google") })).toBeDefined();
  });

  test("[account:sign-in-without-secret] given the age screen of a life Google proved, when Use another way is pressed, then the proof is dropped and the ways back in open with Google and the email field, nothing filled", async () => {
    const { account } = backFromGoogle(BY_GOOGLE);
    await screen.findByText(say("ui.account.age.title"));
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.kept.other.google") }));
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.email.label")).value).toBe("");
    expect(screen.getByRole("button", { name: say("ui.account.google") })).toBeDefined();
    expect(account.calls).toContain("dropNewLife()");
  });

  test("[account:sign-in-without-secret] [account:age-screen-refuses-minors] given the age screen of a life Google proved, when a minor is refused, then the refusal stands and nothing is started", async () => {
    const { account } = backFromGoogle(BY_GOOGLE, [], { declareAge: () => Promise.resolve("refused") });
    await answerTheAge();
    expect(await screen.findByText(say("ui.account.age.refused"))).toBeDefined();
    expect(line()).toBeNull();
    expect(account.calls.some((call) => call.startsWith("startGuest"))).toBe(false);
  });

  test("[account:guest-secures-the-life] given the new life's mark but no proof held (its cookie did not stay), then the ways back in open with the words of a trip that did not finish", async () => {
    backFromGoogle("unasked");
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(document.querySelector("[data-google-returned]")?.textContent).toBe(say("ui.account.fail.google"));
  });
});

describe("Google's step when Continue is refused", () => {
  test("[account:sign-in-without-secret] given Google's proof ran out, when Continue answers proof-gone, then Continue with Google stands on the step in place of a code, no code is sent, and pressing it holds the username for the way back", async () => {
    const { account } = backFromGoogle({ ...BY_GOOGLE, passed: true }, [{ ok: false, why: "proof-gone" }]);
    await chooseAndContinue("ada_lagos");
    expect(await screen.findByText(say("ui.account.kept.gone.google"))).toBeDefined();
    expect(say("ui.account.kept.gone.google")).toBe("Your Google sign-in ran out. Continue with Google again.");
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label")).value).toBe("ada_lagos");
    expect(account.calls.filter((call) => call.startsWith("sendCode"))).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.google") }));
    await waitFor(() => expect(account.calls).toContain("signInWithGoogle()"));
    expect(sessionStorage.getItem(NEW_LIFE_NAME_KEY)).toBe("ada_lagos");
  });

  test("[account:sign-in-without-secret] given a username held across a trip to Google, when Google's fresh proof opens the step, then the username comes back in the box, once", async () => {
    sessionStorage.setItem(NEW_LIFE_NAME_KEY, "ada_lagos");
    backFromGoogle({ ...BY_GOOGLE, passed: true });
    await screen.findByRole("heading", { name: say("ui.account.kept.name.title") });
    expect(screen.getByLabelText<HTMLInputElement>(say("ui.account.name.label")).value).toBe("ada_lagos");
    expect(sessionStorage.getItem(NEW_LIFE_NAME_KEY)).toBeNull();
  });

  test("[account:sign-in-without-secret] given an address an account took before Continue, when Continue answers so, then the step says so with Continue with Google to open it, sends no code and holds no username", async () => {
    const { account } = backFromGoogle({ ...BY_GOOGLE, passed: true }, [{ ok: false, why: "email-taken" }]);
    await chooseAndContinue("ada_lagos");
    expect(await screen.findByText(say("ui.account.kept.taken.google"))).toBeDefined();
    expect(screen.queryByLabelText(say("ui.account.code.label"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: say("ui.account.google") }));
    await waitFor(() => expect(account.calls).toContain("signInWithGoogle()"));
    expect(account.calls.filter((call) => call.startsWith("sendCode"))).toEqual([]);
    expect(sessionStorage.getItem(NEW_LIFE_NAME_KEY)).toBeNull();
  });

  test("[account:sign-in-without-secret] given a trip to Google that cannot start from the step, then its failure is said there and the button stands", async () => {
    backFromGoogle({ ...BY_GOOGLE, passed: true }, [{ ok: false, why: "proof-gone" }], { signInWithGoogle: () => Promise.resolve({ ok: false, why: "unreachable" }) });
    await chooseAndContinue("ada_lagos");
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.google") }));
    expect(await screen.findByText(say("ui.account.fail.unreachable"))).toBeDefined();
    expect(screen.getByRole("button", { name: say("ui.account.google") })).toBeDefined();
  });
});

describe("Google's other returns stand as they are", () => {
  test("[account:guest-secures-the-life] given a cancel at Google's screen, when the page comes home with access_denied, then the ways back in say it as a cancel and no step of a new life opens", async () => {
    backFromGoogle("unasked", [], { returnedFromGoogle: () => "cancelled" });
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(document.querySelector("[data-google-returned]")?.textContent).toBe(say("ui.account.fail.cancelled"));
    expect(line()).toBeNull();
  });

  test("[account:guest-secures-the-life] given an in-app browser where Google does not open, then the ways back in offer no Google, so no step of Google's opens there", async () => {
    const account = codeAccount();
    const store = createGameStore({ view: () => Promise.resolve(engineView()), send: () => Promise.reject(new Error("unused")) }, { account });
    store.getState().leave(null);
    render(
      <GameProvider store={store}>
        <AccountGate load={passing} sitekey={TEST_SITE_KEY} agent="Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 WhatsApp/2.24.1" />
      </GameProvider>,
    );
    fireEvent.click(await screen.findByRole("button", { name: say("ui.account.start.returning") }));
    expect(await screen.findByRole("heading", { name: say("ui.account.returning.title") })).toBeDefined();
    expect(screen.queryByRole("button", { name: say("ui.account.google") })).toBeNull();
  });
});
