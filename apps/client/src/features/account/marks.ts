// What this browser remembers about the ways in, with no account data in it: that a kept life was open here, which
// turns the start screen round (account:start-screen-over-live-city), and that a passkey was added or used here, which
// puts the passkey first on the ways back in (account:passkey-in-email-autofill). The game never clears either: a
// signed-out player is the one most likely to come back. And the hand-over from a guest life to the ways back in, when
// the guest chose to open the life it kept before (account:guest-secures-the-life).
import { browserStorage, KEPT_MARK_KEY, PASSKEY_MARK_KEY } from "../../shared/kept/storage";

function marked(key: string): boolean {
  try {
    return browserStorage()?.getItem(key) === "1";
  } catch {
    return false;
  }
}

function mark(key: string): void {
  try {
    browserStorage()?.setItem(key, "1");
  } catch {
    // Storage refused (a private window): the screens keep their first order.
  }
}

/** A kept life was open in this browser. */
export const keptHere = (): boolean => marked(KEPT_MARK_KEY);
export const markKeptHere = (): void => mark(KEPT_MARK_KEY);

/** A passkey was added or used in this browser. */
export const passkeyHere = (): boolean => marked(PASSKEY_MARK_KEY);
export const markPasskeyHere = (): void => mark(PASSKEY_MARK_KEY);

/** The ways back in, asked for by a guest leaving its life for a kept one, with the address to fill in when one is known. */
interface Asked {
  email: string | null;
}

let asked: Asked | null = null;

/** Hands the ways back in to the next sign-in screen, with the address the guest typed. */
export function askWaysBackIn(email: string | null): void {
  asked = { email };
}

/** The ways back in that were asked for, if any; read as the sign-in screens open, and kept until `doneWaysBackIn`. */
export const waysBackInAsked = (): Asked | null => asked;

export function doneWaysBackIn(): void {
  asked = null;
}
