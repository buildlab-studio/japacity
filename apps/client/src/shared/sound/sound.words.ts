// The sound layer's words, first drafts in the voice of docs/rules/text.md. Content's table wins
// over these, so each key can move into content and be rewritten there.
import { text } from "@japacity/content";

export const soundText: Record<string, string> = {
  "sound.notice.on": "Sound on",
  "sound.notice.on.action": "Tap to mute",
  "sound.notice.blocked": "Better with sound. Tap to turn it on",
  "sound.notice.saver": "Sound is off to save data. Tap to turn it on",
  "sound.notice.unsupported": "Playing in text on this browser",
  "sound.mute": "Mute the sound",
  "sound.unmute": "Turn the sound on",
};

export function soundWords(key: string): string {
  return text[key] ?? soundText[key] ?? key;
}
