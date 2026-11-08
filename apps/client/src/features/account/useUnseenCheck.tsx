// The bot check run unseen where a guest life is made and where an email code is sent (account:bot-check-on-guest-creation,
// account:bot-check-on-code-send, account:start-screen-over-live-city): the widget is mounted with
// nothing to do, and the step that makes the account waits a moment for its token rather than asking the player to.
// A token is good once, so the widget is reset after every attempt that sent one. A script that could not load is
// loaded again at the next step, which waits for it as for a widget that is up; the step can ask why no pass came.
import { useRef, useState, type ReactNode } from "react";

import { Turnstile, TURNSTILE_ACTION, type CheckTrouble, type LoadTurnstile } from "./Turnstile";

/** How long the step waits for the unseen check's token before it sends without one. */
const BOT_WAIT_MS = 8_000;

export interface UnseenCheck {
  /** The widget, unseen unless Cloudflare needs a tap; null without a site key. */
  widget: ReactNode;
  /** The token in hand, or the one the check gives within the wait, or none. */
  token: () => Promise<string | null>;
  /** After a request that carried the token: the widget gets a fresh one. */
  spent: () => void;
  /** Why the last wait ended with no token, when the check said: its script did not load, or it failed here. */
  trouble: () => CheckTrouble | null;
}

/** `action`: the surface the widget is rendered for, the guest start's unless named. */
export function useUnseenCheck(sitekey: string | null, load: LoadTurnstile, waitMs: number = BOT_WAIT_MS, action: string = TURNSTILE_ACTION): UnseenCheck {
  const [round, setRound] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const held = useRef<string | null>(null);
  const waiting = useRef<((token: string | null) => void) | null>(null);
  // Only a widget that is up, or a script loading again, has a token on its way; without one, the step sends at once.
  const shownUp = useRef(false);
  const troubleSeen = useRef<CheckTrouble | null>(null);

  const took = (token: string | null): void => {
    held.current = token;
    if (token !== null) {
      troubleSeen.current = null;
      waiting.current?.(token);
    }
  };

  const troubled = (trouble: CheckTrouble): void => {
    troubleSeen.current = trouble;
    // A script that did not load gives nothing more: the step that waits goes on at once.
    if (trouble === "unloaded") waiting.current?.(null);
  };

  const token = (): Promise<string | null> => {
    if (held.current !== null || sitekey === null) return Promise.resolve(held.current);
    const again = troubleSeen.current === "unloaded";
    if (!again && !shownUp.current) return Promise.resolve(null);
    if (again) {
      troubleSeen.current = null;
      setAttempt((count) => count + 1);
    }
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        waiting.current = null;
        resolve(null);
      }, waitMs);
      waiting.current = (given) => {
        window.clearTimeout(timer);
        waiting.current = null;
        resolve(given);
      };
    });
  };

  const spent = (): void => {
    held.current = null;
    setRound((count) => count + 1);
  };

  const widget =
    sitekey === null ? null : <Turnstile sitekey={sitekey} load={load} round={round} attempt={attempt} action={action} onToken={took} onShown={() => (shownUp.current = true)} onTrouble={troubled} />;
  return { widget, token, spent, trouble: () => troubleSeen.current };
}
