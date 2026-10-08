// Which authority the build runs (R-ENGINE-015). With VITE_SERVER_URL set the
// server is the authority. Without it the in-browser authority runs, which
// exists for development, tests and the offline playtests; a production
// build runs it only when told to in so many words.
export type AuthorityMode = { authority: "local" } | { authority: "remote"; baseUrl: string } | { authority: "refused"; why: string };

export function authorityMode(): AuthorityMode {
  const server = import.meta.env.VITE_SERVER_URL;
  if (server !== undefined && server !== "") return { authority: "remote", baseUrl: server };
  if (import.meta.env.PROD && import.meta.env.VITE_ALLOW_LOCAL_AUTHORITY !== "1") {
    return { authority: "refused", why: "A production build runs the local authority only with VITE_ALLOW_LOCAL_AUTHORITY=1." };
  }
  return { authority: "local" };
}
