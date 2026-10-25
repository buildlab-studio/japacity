// Money terms said as money in the right currency (abroad-money:missed-tuition-runs-in-stages, route:education-loan-pays-the-school):
// the payment plan's instalment and the study lender's floor and ceiling are pounds, never a bare number.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { offerParams } from "./terms";

describe("an offer's money terms", () => {
  test("[abroad-money:missed-tuition-runs-in-stages] given the fees office's payment plan, when its terms are read, then the instalment and the fee are pounds", () => {
    const params = offerParams({ entry: "offer.fee-payment-plan", terms: { fee: content.tuning.status.planFee, instalment: 183_400 } });
    expect(params.instalment).toEqual({ currency: "GBP", amount: 183_400 });
    expect(params.fee).toEqual({ currency: "GBP", amount: content.tuning.status.planFee });
  });

  test("[route:education-loan-pays-the-school] given the study lender's offer, when its terms are read, then the floor, the ceiling and the fee to process are pounds", () => {
    const params = offerParams({ entry: "offer.education-loan", terms: { min: 100_000, max: 1_100_000, fee: content.tuning.route.loanProcessing } });
    expect(params.min).toEqual({ currency: "GBP", amount: 100_000 });
    expect(params.max).toEqual({ currency: "GBP", amount: 1_100_000 });
    expect(params.fee).toEqual({ currency: "GBP", amount: content.tuning.route.loanProcessing });
  });
});
