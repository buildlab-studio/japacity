// server:production-and-staging: the build's own commit, read from the tag the build put in index.html (vite/stamp.plugin.ts) and said
// once in the console, so a stale page kept by a cache can be told apart from a new one.

export const STAMP_META = "japacity-build";

/** The build's commit as the page carries it, or null on a page with no tag. */
export function buildOf(page: Pick<Document, "querySelector">): string | null {
  return page.querySelector(`meta[name="${STAMP_META}"]`)?.getAttribute("content") ?? null;
}

let said = false;

/** Says the build once in the console, however often it is asked. True when it said it now. */
export function sayBuild(page: Pick<Document, "querySelector">, log: (line: string) => void = (line) => console.info(line)): boolean {
  if (said) return false;
  said = true;
  log(`Japacity build ${buildOf(page) ?? "unknown"}`);
  return true;
}
