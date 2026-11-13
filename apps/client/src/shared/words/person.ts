// The people lines' own params, a country and a job as they read in a sentence. The words they read are
// content's ui/ui.person.text.ts.
import { text } from "@japacity/content";

import { swapped } from "./now";

/** A country as it reads after "in": "the United Kingdom", "Canada". */
export function countryWords(id: string): string {
  const name = text[`${id}.name`] ?? id;
  return name.startsWith("United ") ? `the ${name}` : name;
}

/** A job as it reads after "works as": "a bank officer", "an analyst". */
export function jobWords(job: string): string {
  return `${/^[aeiou]/i.test(job) ? "an" : "a"} ${job}`;
}

/** Words for a person's id when content names it, else null. */
function personName(id: string): string | null {
  const name = text[`${id}.name`];
  // A computer person never carries the player's own first name (person:one-mixed-name-pool).
  return name === undefined ? null : swapped(`${id}.name`, name);
}

/**
 * The people lines' own params as words (docs/rules/person.md): a spot,
 * what was done, the step asked, the slot, and `player` for a friend. Null when
 * the param is not one of these, so the usual formatting applies.
 */
export function peopleParam(name: string, value: string, midSentence: boolean): string | null {
  switch (name) {
    case "spot":
      return text[`people.spot.${value}`] ?? text[`people.wedding-spot.${value}`] ?? null;
    case "what":
      return text[`people.what.${value}`] ?? text[`people.call.${value}`] ?? null;
    case "step":
      return text[`ui.people.step.${value}`] ?? null;
    case "slot":
      return text[`ui.people.slot.${value.startsWith("sibling") ? "sibling" : value}`]?.toLowerCase() ?? null;
    case "who": {
      if (value !== "player") return personName(value);
      const friend = text["ui.people.who.player"] ?? value;
      return midSentence ? friend : friend.charAt(0).toUpperCase() + friend.slice(1);
    }
    default:
      return null;
  }
}
