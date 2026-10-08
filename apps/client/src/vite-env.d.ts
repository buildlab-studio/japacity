/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" turns the fast clock on in a dev or preview build. Never in production: see src/authority/clock.ts. */
  readonly VITE_FAST_CLOCK?: string;
  /** "1" lets a production build run the in-browser authority (R-ENGINE-015): see src/authority/mode.ts. */
  readonly VITE_ALLOW_LOCAL_AUTHORITY?: string;
  /** The server's address. Set, the server is the authority: see src/authority/mode.ts. */
  readonly VITE_SERVER_URL?: string;
  /** Cloudflare Turnstile's site key for the sign-up check (R-ACCOUNT-013): see src/features/account/Turnstile.tsx. */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** The build number feedback carries (R-MODERATION-020), set by the build: see src/features/moderation/api.ts. */
  readonly VITE_BUILD?: string;
}
