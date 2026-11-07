// The travel data page as the run stands, for the desk's stage (prologue:printed-page-hands-over, prologue:front-door-builds-a-person):
// the same page the handover prints, never a fork, read from the run alone. Each row fills as its step is reached: the photo
// and the name on Who are you?, the age, the path and what it was on Your life so far, the strip's district on Where you
// live. A row not given yet is empty, which the page shows as its dots: an empty name box is the name row's dots, never
// the suggestion. FROM, FAMILY and READY come with the years and the life, so they wait as dots; nothing is stamped.
import { content } from "@japacity/content";
import { type Id } from "@japacity/sim";

import { archetypeOf, homeOf } from "../../shared/front-door/archetypes";
import { fitHome } from "../../shared/front-door/homes";
import { lookOf } from "../../shared/front-door/looks";
import { isMade } from "../../shared/front-door/style";
import { startYearFor } from "../../shared/datapage/age";
import type { PageFields } from "../../shared/datapage/DataPage";
import type { DoorDraft, DoorStage } from "../../shared/datapage/door";
import { readyMonths, yearsOf } from "../../shared/datapage/years";
import { say } from "../../shared/words/text";

/** The ready lives: every scenario but the life from sixteen, each named by its kind, never its person. */
export const READY = (Object.keys(content.scenario) as Id<"scenario">[]).filter((id) => content.scenario[id]?.prologue !== true);

/** The ready life the run picked, or null. */
export function readyOf(draft: Pick<DoorDraft, "ready">): Id<"scenario"> | null {
  return draft.ready === null ? null : (READY.find((id) => id === draft.ready) ?? null);
}

/** How old the run's life starts, in whole years: the tile's own year and the steps older, or the ready life's age. */
export function yearsFor(draft: DoorDraft): number | null {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const ready = readyOf(draft);
  // The year picked is the year the life starts at (prologue:age-advances-with-steps, decision 0023): a true number, never "about".
  return archetype !== null ? startYearFor(archetype, Math.max(0, draft.age)) : ready !== null ? yearsOf(readyMonths(ready)) : null;
}

/** The tile's name, or the ready life's kind. */
export function pathWords(draft: DoorDraft): string {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  const ready = readyOf(draft);
  return archetype !== null ? say(`prologue.archetype.${archetype.id}.name`) : ready !== null ? say(`${ready}.kind`) : "";
}

/** How far the run has come: 0 on Who are you?, 1 on the lives, 2 on Where you live and once begun. */
export function reachedOf(stage: DoorStage): 0 | 1 | 2 {
  switch (stage) {
    case "you":
      return 0;
    case "life":
    case "ready":
      return 1;
    case "page":
    case "begun":
      return 2;
    default: {
      const never: never = stage;
      throw new Error(`Unknown door stage ${String(never)}.`);
    }
  }
}

/** Where the run's life starts: the home picked for a tile, as Begin would fit it, or the family house for a ready life. */
export function homeAt(draft: DoorDraft): string {
  const archetype = draft.ready === null ? archetypeOf(draft.archetype) : null;
  if (archetype === null) return "family-house";
  return fitHome(archetype, draft.age, { home: draft.home ?? homeOf(archetype), homePicked: true });
}

/** The page as the run stands: each row as far as the run has come, the rest empty. */
export function livePage(draft: DoorDraft): PageFields {
  const reached = reachedOf(draft.stage);
  const tile = draft.ready === null ? archetypeOf(draft.archetype) : null;
  // On the ready lives' list nothing is picked until Pick.
  const picked = draft.stage !== "ready" || draft.ready !== null;
  const years = reached >= 1 && picked ? yearsFor(draft) : null;
  const style = isMade(draft.style) ? undefined : draft.style;
  return {
    name: draft.name.trim(),
    age: years === null ? "" : say("prologue.page.age.years", { years }),
    path: reached >= 1 && picked ? pathWords(draft) : "",
    // A tile says what the life was; a ready life has no such row.
    ...(draft.ready === null ? { was: reached >= 1 && tile !== null ? say(`prologue.archetype.${tile.id}.was`) : "" } : {}),
    ready: "",
    from: "",
    family: "",
    strip: { district: reached >= 2 ? say(`ui.door.home.where.${homeAt(draft)}`) : "", years, percent: null },
    photo: lookOf(draft.look)?.picture ?? "",
    wear: { look: draft.look, ...(style === undefined ? {} : { style }) },
  };
}
