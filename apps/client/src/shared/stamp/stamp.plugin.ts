// R-SERVER-038: every build carries its own commit in index.html, so a page a cache kept can be told from a new one.
// Runs in Node, from vite.config.ts; the page reads the tag back in stamp.ts.
import { execFileSync } from "node:child_process";

import type { Plugin } from "vite";

import { STAMP_META } from "./stamp";

/** The commit the build is made from, marked when the tree has changes not committed; `JAPACITY_BUILD` names it instead when set. */
export function buildCommit(run: (args: string[]) => string = (args) => execFileSync("git", args, { encoding: "utf8" })): string {
  const named = process.env.JAPACITY_BUILD;
  if (named !== undefined && named !== "") return named;
  try {
    const commit = run(["rev-parse", "--short=12", "HEAD"]).trim();
    const changed = run(["status", "--porcelain", "--untracked-files=no"]).trim() !== "";
    return changed ? `${commit}+changes` : commit;
  } catch {
    return "unknown";
  }
}

/** Puts `<meta name="japacity-build" content="<commit>">` in the page's head. */
export function buildStamp(commit: string = buildCommit()): Plugin {
  return {
    name: "japacity-build-stamp",
    transformIndexHtml() {
      return [{ tag: "meta", attrs: { name: STAMP_META, content: commit }, injectTo: "head" }];
    },
  };
}
