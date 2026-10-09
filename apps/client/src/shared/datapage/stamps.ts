// The data page's stamps (prologue.md R-PROLOGUE-009): a red stamp for each step taken toward leaving, read from the
// view as it stands, in the order a life takes them: the way looked into (the first chapter's "Look into it"), the
// plan (the way japacity reads, once looked into), the passport held, the file built, the visa applied for, granted.
import type { PlayerView } from "@japacity/sim";

import { say } from "../words/text";

type Read = Pick<PlayerView, "documents" | "routes" | "chapter" | "japacity">;

const PASSPORT = "document.passport";
const FIRST = "chapter.find-your-feet";
const LOOKED = "known";
const FILE = "chapter.build-the-file";
const KNOWN: readonly string[] = ["known", "applying", "granted", "departed"];
const APPLIED: readonly string[] = ["applying", "granted", "departed"];
const GRANTED: readonly string[] = ["granted", "departed"];

/** True when the first chapter's "Look into it" is done, now or in a chapter already behind. */
function lookedInto(chapter: Read["chapter"]): boolean {
  if (chapter.done.includes(FIRST)) return true;
  return chapter.current === FIRST && chapter.items.some((item) => item.id === LOOKED && item.met);
}

/** The stamps on the page, oldest first, in words. */
export function stampsOf(view: Read): string[] {
  const stamps: string[] = [];
  if (lookedInto(view.chapter)) stamps.push(say("prologue.page.stamp.adviser"));
  const plan = view.japacity.route === null ? undefined : view.routes.find((route) => route.id === view.japacity.route);
  const planned = plan !== undefined && KNOWN.includes(plan.state);
  if (planned) stamps.push(say("prologue.page.stamp.plan", { way: say(`prologue.page.way.${plan.id}`) }));
  if (view.documents.some((paper) => paper.id === PASSPORT && paper.state === "held")) stamps.push(say("prologue.page.stamp.papers"));
  if (view.chapter.done.some((chapter) => chapter === FILE || chapter.startsWith(`${FILE}-`))) stamps.push(say("prologue.page.stamp.file"));
  if (planned && APPLIED.includes(plan.state)) stamps.push(say("prologue.page.stamp.applied"));
  if (planned && GRANTED.includes(plan.state)) stamps.push(say("prologue.page.stamp.granted"));
  return stamps;
}
