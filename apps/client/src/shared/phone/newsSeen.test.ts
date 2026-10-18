// The nudge that says the month's news is in goes once News has been read.
import { beforeEach, describe, expect, test } from "vitest";

import { engineView } from "../testing/fixtures";
import { newsMarkOf, newsRead } from "./newsSeen";
import { SEEN_KEY } from "../kept/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("news read", () => {
  test("[world:nudge-says-one-thing] [world:phone-rises-over-scene] given a report and no mark seen, then News is unread; once the device has seen its mark, then it is read; a new report makes it unread again", () => {
    const view = { ...engineView(), report: { month: 3, lines: [], japacityBefore: null, japacityAfter: null, attention: false } };
    expect(newsRead(view)).toBe(false);
    localStorage.setItem(SEEN_KEY, JSON.stringify({ news: newsMarkOf(view) }));
    expect(newsRead(view)).toBe(true);
    expect(newsRead({ ...view, report: { ...view.report, month: 4 } })).toBe(false);
  });
});
