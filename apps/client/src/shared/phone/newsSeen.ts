// Whether the month's News has been read (world:nudge-says-one-thing, world:phone-rises-over-scene): the phone keeps what was seen under one key; the nudge that says "the month's news is in"
// goes once News has been opened for this month's report.
import type { PlayerView } from "@japacity/sim";
import { SEEN_KEY } from "../storage/storage";

/** The News app's mark: the report's month and the stories there now; empty when there is nothing. */
export function newsMarkOf(view: Pick<PlayerView, "report" | "news">): string {
  const stories = view.news.map((story) => `${story.id}.${story.stage}`).join(",");
  return view.report === null && stories === "" ? "" : `${String(view.report?.month ?? "")}:${stories}`;
}

/** True when the device has seen News as it stands now. */
export function newsRead(view: Pick<PlayerView, "report" | "news">): boolean {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(SEEN_KEY);
    if (raw === null) return false;
    const seen: unknown = JSON.parse(raw);
    const news = typeof seen === "object" && seen !== null ? (seen as { news?: unknown }).news : undefined;
    return typeof news === "string" && news === newsMarkOf(view);
  } catch {
    return false;
  }
}
