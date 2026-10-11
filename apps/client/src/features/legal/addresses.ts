// Where the two legal pages live: their clean addresses and their built files.
// Kept apart from pages.ts, which reads content's TypeScript, so that
// vite.config.ts can load this through plugin.ts as plain Node.

/**
 * Each page's address, its built file and its template, in this folder. Workers static
 * assets serve `terms.html` at `/terms` by their default html handling and send
 * `/terms.html` on to `/terms`; the dev server does the same through plugin.ts.
 */
export const LEGAL_TEMPLATES = [
  { path: "/terms", file: "terms.html", template: "terms.html" },
  { path: "/privacy", file: "privacy.html", template: "privacy.html" },
] as const;

/** What the dev server does with a path: serve a page at its clean address, send an old form on to it, or leave it alone. */
export type LegalRoute = { readonly serve: string } | { readonly redirect: string } | null;

/** `/terms` serves; `/terms.html` and `/terms/` go on to `/terms`, as the platform's html handling does. */
export function legalRoute(path: string): LegalRoute {
  for (const page of LEGAL_TEMPLATES) {
    if (path === page.path) return { serve: page.path };
    if (path === `/${page.file}` || path === `${page.path}/`) return { redirect: page.path };
  }
  return null;
}
