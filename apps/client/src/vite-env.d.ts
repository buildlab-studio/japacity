/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" turns the fast clock on in a dev or preview build. Never in production: see src/authority/clock.ts. */
  readonly VITE_FAST_CLOCK?: string;
}
