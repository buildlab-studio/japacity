// The school sheet (world:one-action-one-sheet; route:school-answers-by-grade, text:show-then-tell): its line the school's own
// words, the chance of an offer, when it answers and the deposit as chips, the grade it takes as a mark, and its corner a
// building, not the gear the icon set falls back to.
import { content, text } from "@japacity/content";
import { describe, expect, test } from "vitest";

import { engineView } from "../../../shared/testing/fixtures";
import { formatMoney } from "../../../shared/words/format";
import { factWords } from "../../../shared/ui/Facts";
import { offerChance, SCHOOL_ICON, schoolFacts } from "./school";

const NORTHGATE = "school.northgate";

function withGrade(grade: number) {
  const view = engineView("scenario.graduate");
  return { ...view, qualities: [...view.qualities.filter((quality) => quality.id !== "quality.education-grade"), { id: "quality.education-grade" as const, value: grade }] };
}

describe("the sheet that applies to one university", () => {
  test("[world:one-action-one-sheet] [text:show-then-tell] given one university the papers can go to, when its sheet shows, then its line is the school's own words, the chance of an offer, when it answers and its deposit are chips in that order, and the grade it takes a tick once held", () => {
    const school = content.school[NORTHGATE];
    if (school === undefined) throw new Error("No Northgate.");
    const { line, facts, needs } = schoolFacts(withGrade(school.minGrade), NORTHGATE);
    expect(line).toBe(text[`${NORTHGATE}.blurb`]);
    expect(facts.map((fact) => [fact.kind, factWords(fact)])).toEqual([
      ["chance", "Likely"],
      ["when", "Answers in a month"],
      ["bill", `Deposit ${formatMoney(school.deposit, "GBP")} if yes`],
    ]);
    expect(needs).toEqual([{ state: "done", words: text["quality.education-grade.value.3"], id: "grade" }]);
    expect(schoolFacts(withGrade(school.minGrade - 1), NORTHGATE).needs[0]?.state).toBe("failed");
    for (const fact of facts) expect(line ?? "").not.toContain(factWords(fact));
    expect(line ?? "").not.toMatch(/band|answers in|deposit/i);
  });

  test("[world:one-action-one-sheet] given a grade above the school's least, when the chance is read, then it rises by the step for each grade, never past the cap, as the school's answer draws it", () => {
    const school = content.school["school.kingsmere"];
    if (school === undefined) throw new Error("No Kingsmere.");
    const numbers = content.tuning.route;
    expect(offerChance(withGrade(school.minGrade), "school.kingsmere")).toBe(school.offerBp);
    expect(offerChance(withGrade(school.minGrade + 1), "school.kingsmere")).toBe(school.offerBp + numbers.offerPerGradeBp);
    expect(schoolFacts(withGrade(school.minGrade), "school.kingsmere").facts[0]).toEqual({ kind: "chance", band: "fair" });
    expect(offerChance(withGrade(school.minGrade + 40), "school.kingsmere")).toBe(numbers.offerMaxBp);
  });

  test("[world:one-action-one-sheet] given the sheet's corner, when its icon is named, then it is the building the phone's icon set draws, not the gear it falls back to", () => {
    expect(SCHOOL_ICON).toBe("landmark");
  });
});
