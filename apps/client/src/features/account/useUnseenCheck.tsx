// The bot check run unseen where a guest life is made (account:bot-check-on-guest-creation, account:start-screen-over-live-city): the widget is mounted with
// nothing to do, and the step that makes the account waits a moment for its token rather than asking the player to.
// A token is good once, so the widget is reset after every attempt that sent one.
import { useRef, useState, type ReactNode } from "react";

import { Turnstile, type LoadTurnstile } from "./Turnstile";

/** How long the step waits for the unseen check's token before it sends without one. */
const BOT_WAIT_MS = 8_000;

export interface UnseenCheck {
  /** The widget, unseen unless Cloudflare needs a tap; null without a site key. */
  widget: ReactNode;
  /** The token in hand, or the one the check gives within the wait, or none. */
  token: () => Promise<string | null>;
  /** After a request that carried the token: the widget gets a fresh one. */
  spent: () => void;
}

export function useUnseenCheck(sitekey: string | null, load: LoadTurnstile, waitMs: number = BOT_WAIT_MS): UnseenCheck {
  const [round, setRound] = useState(0);
  const held = useRef<string | null>(null);
  const waiting = useRef<((token: string | null) => void) | null>(null);
  // Only a widget that is up has a token on its way; without one, the step sends at once.
  const shownUp = useRef(false);

  const took = (token: string | null): void => {
    held.current = token;
    if (token !== null) waiting.current?.(token);
  };

  const token = (): Promise<string | null> => {
    if (held.current !== null || sitekey === null || !shownUp.current) return Promise.resolve(held.current);
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

  const widget = sitekey === null ? null : <Turnstile sitekey={sitekey} load={load} round={round} onToken={took} onShown={() => (shownUp.current = true)} />;
  return { widget, token, spent };
}
