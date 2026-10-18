// The agent's sheet's words (docs/rules/advice.md R-ADVICE-005, 006), read from content's ui/ui.advice.text.ts and,
// for the agent's line, his tells, his looks and his choices, advice/advice.text.ts.
import { say } from "../../shared/words/text";

/** Words for an advice key. */
export function adviceWords(key: string, params: Parameters<typeof say>[1] = {}): string {
  return say(key, params);
}
