// The family the game drew, as the page prints it (prologue.md R-PROLOGUE-002, 009, 014): a two-line card for the
// handover, and its title on the data page's FAMILY line. The view keeps no prologue once it closes (R-PROLOGUE-006),
// so the draw is read back from the years' trail the prologue keeps on the device under `TRAIL_KEY`.
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import type { Tone } from "../ui/ToneTag";
import { say, sayCount } from "../words/text";

type Draw = NonNullable<NonNullable<PlayerView["prologue"]>["draw"]>;

/** The one localStorage key the years' trail is kept under, beside the door's run. */
export const TRAIL_KEY = "japacity.door.years";

export interface FamilyCard {
  title: string;
  tags: { tone: Tone; words: string }[];
}

/** The means a family must reach to pay for a private university, from content's own answer. */
function comfortableFrom(): number {
  for (const answer of content.prologue["university"]?.answers ?? []) {
    for (const requirement of answer.requires) {
      if (requirement.type === "quality/min" && requirement.quality === "quality.family-means") return requirement.value;
    }
  }
  return content.quality["quality.family-means"]?.max ?? 0;
}

/**
 * The family the game drew (R-PROLOGUE-002) as a two-line card: its means as the title, with its ups and downs as small
 * tags. The child of the water grew up on the lagoon (R-PROLOGUE-012): its own title in place of the town and means.
 */
export function familyCard(draw: Draw, water: boolean): FamilyCard {
  const means = draw.familyMeans < content.tuning.prologue.waecStrain.under ? "low" : draw.familyMeans < comfortableFrom() ? "middle" : "high";
  const tags: FamilyCard["tags"] = [];
  if (!water) tags.push(draw.town === "city" ? { tone: "up", words: say("ui.page.family.city") } : { tone: "down", words: say("ui.page.family.town") });
  tags.push(draw.parentsEducated ? { tone: "up", words: say("ui.page.family.schooled") } : { tone: "down", words: say("ui.page.family.unschooled") });
  tags.push({ tone: "plain", words: sayCount("ui.page.family.siblings", draw.siblings, { count: draw.siblings }) });
  return { title: say(water ? "ui.page.family.water" : `ui.page.family.${means}`), tags };
}

/** The draw kept with the years' trail, or null where none is kept or it cannot be read. */
export function keptDraw(storage: Pick<Storage, "getItem"> | null = safeStorage()): Draw | null {
  try {
    const raw = storage?.getItem(TRAIL_KEY) ?? null;
    if (raw === null) return null;
    const draw = (JSON.parse(raw) as { draw?: unknown }).draw;
    if (typeof draw !== "object" || draw === null) return null;
    const { familyMeans, town, siblings, parentsEducated } = draw as Record<string, unknown>;
    return typeof familyMeans === "number" && (town === "city" || town === "town") && typeof siblings === "number" && typeof parentsEducated === "boolean" ? (draw as Draw) : null;
  } catch {
    return null;
  }
}

function safeStorage(): Pick<Storage, "getItem"> | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
