// The family the game drew, as the page prints it (prologue.md R-PROLOGUE-002, 009, 014): a two-line card for the
// handover, and its means on the data page's FAMILY line beside where it is from. The view keeps no prologue once it
// closes (R-PROLOGUE-006), so the draw is read back from the years' trail the prologue keeps on the device under
// `TRAIL_KEY`; where the life is from stays in the view (`hometown`).
import { content } from "@japacity/content";
import type { PlayerView } from "@japacity/sim";

import type { Tone } from "../ui/ToneTag";
import { hometownWords, say, sayCount } from "../words/text";
import { browserStorage, TRAIL_KEY } from "../kept/storage";

type Draw = NonNullable<NonNullable<PlayerView["prologue"]>["draw"]>;

export interface FamilyCard {
  /** Where the family is from: "Family from Enugu"; the child of the water's house on stilts in Makoko. */
  title: string;
  /** The family's means in a few words, as the page's FAMILY line prints them: "A family that gets by". */
  means: string;
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

const MEANS_TONE: Record<"low" | "middle" | "high", Tone> = { low: "down", middle: "plain", high: "up" };

/**
 * The family the game drew (R-PROLOGUE-002) as a two-line card: where it is from as the title, "Family from Enugu"
 * (the place of origin, never where the parents live), with its means and its ups and downs as small tags.
 * `hometown` is the view's (`hometown.<slug>`); where none is known yet the means stand as the title. The child of the
 * water grew up on the lagoon (R-PROLOGUE-012): its own title in place of the town and the means.
 */
export function familyCard(draw: Draw, water: boolean, hometown: string | null = null): FamilyCard {
  const means = draw.familyMeans < content.tuning.prologue.waecStrain.under ? "low" : draw.familyMeans < comfortableFrom() ? "middle" : "high";
  const meansWords = say(water ? "ui.page.family.water" : `ui.page.family.${means}`);
  const named = !water && hometown !== null;
  const tags: FamilyCard["tags"] = [];
  if (named) tags.push({ tone: MEANS_TONE[means], words: meansWords });
  if (!water) tags.push(draw.town === "city" ? { tone: "up", words: say("ui.page.family.city") } : { tone: "down", words: say("ui.page.family.town") });
  tags.push(draw.parentsEducated ? { tone: "up", words: say("ui.page.family.schooled") } : { tone: "down", words: say("ui.page.family.unschooled") });
  tags.push({ tone: "plain", words: sayCount("ui.page.family.siblings", draw.siblings, { count: draw.siblings }) });
  return { title: named ? say("ui.page.family.from", { hometown: hometownWords(hometown) }) : meansWords, means: meansWords, tags };
}

/** The draw kept with the years' trail, or null where none is kept or it cannot be read. */
export function keptDraw(storage: Pick<Storage, "getItem"> | null = browserStorage()): Draw | null {
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

