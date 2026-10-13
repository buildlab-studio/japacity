// The years a tile's life will pass (prologue.md R-PROLOGUE-014): the page after Begin lists them not yet lived and
// fills each as the years go by, so the page never prints a year that is not yet true.
import { content } from "@japacity/content";
import { Award, BookOpen, Flag, GraduationCap, Hammer, Store } from "lucide-react";

import type { FactChipProps } from "../ui/FactChip";
import { say, words } from "../words/text";
import { type Archetype, throughUniversity } from "./archetypes";

/** The years a tile's life will pass, as chips not yet lived: the page fills them as the years go by (R-PROLOGUE-014). */
export function plannedYears(archetype: Archetype): (FactChipProps & { id: string })[] {
  const first = (step: string): string => archetype.preset[step]?.[0] ?? "";
  const waec = { id: "waec", icon: Award, label: say("ui.page.year.waec"), note: words(`prologue.subjects.answer.${first("subjects")}`), state: "waiting" as const };
  if (throughUniversity(archetype)) {
    return [
      waec,
      { id: "exam", icon: BookOpen, label: say("ui.page.year.exam"), note: null, state: "waiting" },
      { id: "university", icon: GraduationCap, label: say("ui.page.year.university"), note: words(`prologue.course.answer.${first("course")}`), state: "waiting" },
      { id: "service", icon: Flag, label: say("ui.page.year.service"), note: null, state: "waiting" },
    ];
  }
  if (first("after-school") === "apprentice") return [waec, { id: "master", icon: Hammer, label: say("ui.page.year.master"), note: words(`prologue.master.answer.${first("master")}`), state: "waiting" }];
  const years = Math.round((content.prologue["shop"]?.months ?? 0) / 12);
  return [waec, { id: "shop", icon: Store, label: say("ui.page.year.shop"), note: say("ui.page.year.shop.years", { count: years }), state: "waiting" }];
}

