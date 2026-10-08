// Cloudflare Turnstile's widget, the bot check on sign-up (R-ACCOUNT-013).
// Rendered explicitly, as Cloudflare's client-side rendering page describes:
// https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
// Test keys: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
// A token is good once, so the widget is reset after every attempt that used it.
import { useEffect, useRef } from "react";

export interface TurnstileOptions {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

/** The part of the `turnstile` global this uses. */
export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string | undefined;
  reset(widget: string): void;
  remove(widget: string): void;
}

export type LoadTurnstile = () => Promise<TurnstileApi>;

/** Cloudflare's test site key that always passes, for builds that are not production. */
export const TEST_SITE_KEY = "1x00000000000000000000AA";

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let loading: Promise<TurnstileApi> | null = null;

export const loadTurnstile: LoadTurnstile = () => {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api === undefined) reject(new Error("Turnstile did not load."));
      else resolve(api);
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Turnstile did not load."));
    };
    document.head.append(script);
  });
  return loading;
};

/**
 * The site key from VITE_TURNSTILE_SITE_KEY. a build that is not
 * production and has none uses Cloudflare's always-pass test key, so local
 * play against the test server needs no setup; production without one shows no widget.
 */
export function siteKey(): string | null {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  if (key !== undefined && key !== "") return key;
  return import.meta.env.PROD ? null : TEST_SITE_KEY;
}

export function Turnstile({ sitekey, load, round, onToken }: { sitekey: string; load: LoadTurnstile; round: number; onToken: (token: string | null) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const tell = useRef(onToken);
  tell.current = onToken;

  useEffect(() => {
    let gone = false;
    load()
      .then((api) => {
        const container = box.current;
        if (gone || container === null) return;
        const id = api.render(container, {
          sitekey,
          callback: (token) => tell.current(token),
          "expired-callback": () => tell.current(null),
          "error-callback": () => tell.current(null),
        });
        if (id !== undefined) widget.current = { api, id };
      })
      .catch(() => tell.current(null));
    return () => {
      gone = true;
      const shown = widget.current;
      widget.current = null;
      if (shown !== null) shown.api.remove(shown.id);
    };
  }, [sitekey, load]);

  useEffect(() => {
    const shown = widget.current;
    if (round > 0 && shown !== null) shown.api.reset(shown.id);
  }, [round]);

  return <div ref={box} data-turnstile />;
}
