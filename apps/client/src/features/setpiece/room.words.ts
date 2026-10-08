// The interview room's own words, first drafts in the voice of docs/rules/text.md. Content's
// table wins over these. The officer's lines are content's (setpiece.text.ts).
import { text } from "@japacity/content";

export const roomText: Record<string, string> = {
  "room.ready": "The officer is ready for you. Every line is shown as text, so the sound is never needed.",
  "room.enter": "Enter the interview room",
  "room.officer": "The officer",
  "room.skip": "Show the answers",
  "room.follow-up": "Follow-up",
  "room.leave": "Leave the room",
};

export function roomWords(key: string): string {
  return text[key] ?? roomText[key] ?? key;
}
