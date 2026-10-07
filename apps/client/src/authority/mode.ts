// Which authority the build may run (R-ENGINE-015). The in-browser authority
// exists for development, tests and the offline playtests; a production build
// runs it only when told to in so many words.
export type AuthorityMode = { authority: "local" } | { authority: "refused"; why: string };

export function authorityMode(): AuthorityMode {
  if (import.meta.env.PROD && import.meta.env.VITE_ALLOW_LOCAL_AUTHORITY !== "1") {
    return { authority: "refused", why: "A production build runs the local authority only with VITE_ALLOW_LOCAL_AUTHORITY=1." };
  }
  return { authority: "local" };
}
