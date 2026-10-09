// The Month sheet's count beside the job, as a person says it.
import { describe, expect, test } from "vitest";

import { countWords, workingPlanned } from "./count";

describe("counts in words", () => {
  test("[R-TEXT-005] given things planned beside a job, when the line is said, then the count is a word and no slot total shows", () => {
    expect(workingPlanned(1)).toBe("Working, and one thing planned beside the job");
    expect(workingPlanned(2)).toBe("Working, and two things planned beside the job");
    expect(workingPlanned(2)).not.toMatch(/\d| of /);
    expect(countWords(10)).toBe("ten");
    expect(countWords(11)).toBe("11");
  });
});
