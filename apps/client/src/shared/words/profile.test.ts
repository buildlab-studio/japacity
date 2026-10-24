// A side job's pay by level in words (activity:side-jobs-pay-by-tier): the tier's pay now and what
// lifts it next, "₦80,000 a month; ₦120,000 once your English is excellent and you have two years in the trade", as the board and the Jobs app say it.
import { describe, expect, test } from "vitest";

import { newGame, viewAfter } from "../testing/fixtures";
import { payLiftWords, payWords } from "./jobs";
import { nextTier, tierPay } from "./profile";

const TUTORING = "activity.weekend-tutoring";
const NIGHT = "activity.night-support";

describe("a side job's pay by level", () => {
  test("[activity:side-jobs-pay-by-tier] given home lessons for a graduate, when their pay is said, then it says the pay now and the tier's pay with both its needs, the English by its band and the months as time in the trade", () => {
    const view = newGame("scenario.graduate").view();
    expect(payLiftWords(TUTORING, view)).toBe("₦80,000 a month; ₦120,000 once your English is excellent and you have two years in the trade");
    expect(payWords(TUTORING, view)).toBe("₦80,000 a month");
  });

  test("[activity:side-jobs-pay-by-tier] given home lessons at strong English, when their pay is said from the view, then the tier that asks months in the trade is never promised: the view carries no months across jobs, so the entry's own pay is said and the tier is still ahead", () => {
    const view = viewAfter(newGame("scenario.teacher"), [{ type: "quality/add", quality: "quality.english", amount: 10 }]);
    expect(tierPay(view, TUTORING)?.amount).toBe(8000000);
    expect(nextTier(view, TUTORING)?.pay.amount).toBe(12000000);
  });

  test("[activity:side-jobs-pay-by-tier] given night support's one tier on English, when it is met, then its pay is the tier's and nothing lifts it further; with no view the entry's own pay is said", () => {
    const under = newGame("scenario.graduate").view();
    expect(payLiftWords(NIGHT, under)).toBe("$250 a month; $350 once your English is excellent");
    const met = viewAfter(newGame("scenario.developer"), [{ type: "quality/add", quality: "quality.english", amount: 13 }]);
    expect(nextTier(met, NIGHT)).toBeNull();
    expect(payLiftWords(NIGHT, met)).toBe("$350 a month");
    expect(payWords(NIGHT)).toBe("$250 a month");
  });
});
