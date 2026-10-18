// The sound layer's words, read from content's ui/ui.sound.text.ts.
import { text } from "@japacity/content";

export function soundWords(key: string): string {
  return text[key] ?? key;
}
