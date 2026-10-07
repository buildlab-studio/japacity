/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" turns the fast clock on in a dev or preview build. Never in production: see src/authority/clock.ts. */
  readonly VITE_FAST_CLOCK?: string;
  /** "1" lets a production build run the in-browser authority (R-ENGINE-015): see src/authority/mode.ts. */
  readonly VITE_ALLOW_LOCAL_AUTHORITY?: string;
}
