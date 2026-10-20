// A side job's pay by level in words (activity:side-jobs-pay-by-tier): the tier's pay now and what
// lifts it next, "₦60,000 a month; ₦90,000 once your tech is good", as the board and the Jobs app say it.
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../testing/fixtures";
import { payLiftWords, payWords } from "./jobs";
import { nextTier, tierPay } from "./profile";

const TUTORING = "activity.weekend-tutoring";
const NIGHT = "activity.night-support";

describe("a side job's pay by level", () => {
  test("[activity:side-jobs-pay-by-tier] given weekend tutoring under tech 50, when its pay is said, then it says the pay now and the tier's pay with what lifts it", () => {
    const view = newGame("scenario.graduate").view();
    expect(payLiftWords(TUTORING, view)).toBe("₦60,000 a month; ₦90,000 once your tech is good");
    expect(payWords(TUTORING, view)).toBe("₦60,000 a month");
  });

  test("[activity:side-jobs-pay-by-tier] given weekend tutoring at tech 50, when its pay is said, then the tier's pay is the pay and nothing lifts it further", () => {
    const view = viewAfter(newGame("scenario.graduate"), [{ type: "quality/add", quality: "quality.tech", amount: 15 }]);
    expect(tierPay(view, TUTORING)?.amount).toBe(9000000);
    expect(nextTier(view, TUTORING)).toBeNull();
    expect(payLiftWords(TUTORING, view)).toBe("₦90,000 a month");
  });

  test("[activity:side-jobs-pay-by-tier] given the night shift with two tiers, when the first is met, then the next named is the second, and with no view the entry's own pay is said", () => {
    const game = newGame("scenario.developer");
    const view = viewAfter(game, [{ type: "quality/add", quality: "quality.tech", amount: 2 }]);
    expect(payLiftWords(NIGHT, view)).toBe("$450 a month; $600 once your tech is strong");
    expect(payWords(NIGHT)).toBe("$350 a month");
  });
});
