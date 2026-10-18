// The man at the park (offer:opening-fixes-terms-and-fraud): he asks only a life that has
// asked around at the motor park, never one that never went there.
import { describe, expect, test } from "vitest";

import { content } from "../index";

describe("the man at the park", () => {
  test("[offer:opening-fixes-terms-and-fraud] given the park's offer, when its conditions are read, then it needs the motor park asked around at", () => {
    const entry = content.offer["offer.road-park"];
    expect(entry).toBeDefined();
    expect(entry?.when).toContainEqual({ type: "activity/played", activity: "activity.ask-around" });
  });
});
