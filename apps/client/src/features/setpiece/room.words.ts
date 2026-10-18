// The interview room's words, read from content's ui/ui.room.text.ts. The officer's lines are in
// setpiece/setpiece.text.ts.
import { text } from "@japacity/content";

export function roomWords(key: string): string {
  return text[key] ?? key;
}
