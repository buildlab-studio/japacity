// From docs/rules/route.md, "Entries: schools".
import type { Id, SchoolEntry } from "@japacity/sim";

import { pct, pounds } from "../units";

export const schoolTable:Record<Id<"school">, SchoolEntry> = {
  "school.northgate": {
    id: "school.northgate",
    route: "route.uk-masters",
    tuition: pounds(17000),
    deposit: pounds(4000),
    minGrade: 3,
    offerBp: pct(85),
    autoDiscount: { minGrade: 4, amount: pounds(2000) },
    meritDiscount: null,
    answerMonths: [1, 1],
  },
  "school.ashby": {
    id: "school.ashby",
    route: "route.uk-masters",
    tuition: pounds(24250),
    deposit: pounds(5000),
    minGrade: 4,
    offerBp: pct(60),
    autoDiscount: null,
    meritDiscount: { bp: pct(30), amount: pounds(3000) },
    answerMonths: [1, 2],
  },
  "school.kingsmere": {
    id: "school.kingsmere",
    route: "route.uk-masters",
    tuition: pounds(35200),
    deposit: pounds(6000),
    minGrade: 4,
    offerBp: pct(30),
    autoDiscount: null,
    meritDiscount: { bp: pct(15), amount: pounds(5000) },
    answerMonths: [1, 2],
  },
};
