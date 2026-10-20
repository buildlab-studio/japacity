// The school sheet (world:one-action-one-sheet; route:school-answers-by-grade): it names the university, its
// deposit and the chance of an offer, and its corner is a building, not the gear the icon set falls back to.
import { content } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { offerChance, SCHOOL_ICON, schoolSheetLine } from "./school";

const NORTHGATE = "school.northgate";

function withGrade(grade: number) {
  const view = engineView("scenario.graduate");
  return { ...view, qualities: [...view.qualities.filter((quality) => quality.id !== "quality.edu-grade"), { id: "quality.edu-grade" as const, value: grade }] };
}

describe("the sheet that applies to one university", () => {
  test("[world:one-action-one-sheet] given one university the papers can go to, when its sheet shows, then it names the university, its deposit and the chance of an offer", () => {
    const school = content.school[NORTHGATE];
    if (school === undefined) throw new Error("No Northgate.");
    const line = schoolSheetLine(withGrade(school.minGrade), NORTHGATE);
    expect(line).toBe(`Your papers go to Northgate University, north-east England. If it says yes, the deposit is ${formatMoney(school.deposit, "GBP")}. Chance of an offer: likely.`);
    expect(line).not.toMatch(/one university/);
  });

  test("[world:one-action-one-sheet] given a grade above the school's least, when the chance is read, then it rises by the step for each grade, never past the cap, as the school's answer draws it", () => {
    const school = content.school["school.kingsmere"];
    if (school === undefined) throw new Error("No Kingsmere.");
    const numbers = content.tuning.route;
    expect(offerChance(withGrade(school.minGrade), "school.kingsmere")).toBe(school.offerBp);
    expect(offerChance(withGrade(school.minGrade + 1), "school.kingsmere")).toBe(school.offerBp + numbers.offerPerGradeBp);
    expect(schoolSheetLine(withGrade(school.minGrade), "school.kingsmere")).toMatch(/Chance of an offer: a fair chance\.$/);
    expect(offerChance(withGrade(school.minGrade + 40), "school.kingsmere")).toBe(numbers.offerMaxBp);
  });

  test("[world:one-action-one-sheet] given the sheet's corner, when its icon is named, then it is the building the phone's icon set draws, not the gear it falls back to", () => {
    expect(SCHOOL_ICON).toBe("landmark");
  });
});
