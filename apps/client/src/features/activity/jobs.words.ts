// The jobs list's own words (docs/rules/world.md R-WORLD-006), first drafts in the voice of
// docs/rules/text.md. Content's table wins over these, then the interface's, so each key can move
// into content to be rewritten.
import { text } from "@japacity/content";

import { hasWords, say, type Params } from "../../shared/words/text";

export const jobsUiText: Record<string, string> = {
  "jobs.pick": "Which job",
  "jobs.pay": "{amount} a month",
  "jobs.chance.likely": "Likely",
  "jobs.chance.fair": "A fair chance",
  "jobs.chance.long": "A long shot",
  "jobs.out-of-reach": "Not open to you yet",
  "jobs.needs": "Needs {needs}",
};

/** Words for a jobs key: content's first, then the interface's, then the list's own drafts. */
export function jobsWords(key: string, params: Params = {}): string {
  if (text[key] !== undefined || hasWords(key)) return say(key, params);
  const template = jobsUiText[key] ?? key;
  return template.replace(/\{([A-Za-z][\w-]*)\}/g, (whole, name: string) => {
    const value = params[name];
    return value === undefined || typeof value === "object" ? whole : String(value);
  });
}
