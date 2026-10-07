import { NewsEntrySchema } from "@japacity/sim/schemas";
import { describe, expect, test } from "vitest";

import { content } from "../index";

describe("news timing", () => {
  test("[R-NEWS-002] given every story in content, when its force lag is read, then it is at least 2 ticks", () => {
    const stories = Object.values(content.news);
    expect(stories).toHaveLength(5);
    const tooQuick = stories.filter((story) => story.standIn.forceLag < 2).map((story) => story.id);
    expect(tooQuick).toEqual([]);
  });

  test("[R-NEWS-002] given a story with a force lag of 1, when it is checked, then the content check rejects it", () => {
    const story = content.news["news.uk-unis-recruit"];
    expect(story).toBeDefined();
    const quick = { ...story, standIn: { ...story?.standIn, forceLag: 1 } };
    expect(NewsEntrySchema.safeParse(quick).success).toBe(false);
    const edge = { ...story, standIn: { ...story?.standIn, forceLag: 2 } };
    expect(NewsEntrySchema.safeParse(edge).success).toBe(true);
  });
});
