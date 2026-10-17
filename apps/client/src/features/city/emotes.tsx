// The emotes (the talk budget, docs/design/13-the-lively-layer.md section 5): pictures over the crowd carry
// the ambient life and cost no reading. Two residents at a time show a picture of what they are about, chosen by what they
// do, and the pair moves on every few seconds. The scene stands each over its resident (`[data-emote-slot]`).
import { useEffect, useState } from "react";

import { say } from "../../shared/words/text";

import type { Role } from "./roster";

/** How long a pair of emotes stands before the next pair. */
const EMOTE_MS = 6000;
/** The most emotes over the crowd at once: a crowd raises the pictures, never the words. */
export const EMOTES_MAX = 2;

/** The pictures each kind of resident shows, a stand-in each until the emotes have tiles of their own. */
export const EMOTE_PICTURES: Readonly<Record<Role, readonly string[]>> = {
  "passer-by": ["📱", "😄", "🚌"],
  hawker: ["🍽️", "💧", "💸"],
  rider: ["🏍️", "💸", "😎"],
  corper: ["📚", "😩", "💼"],
  trader: ["💸", "🛒", "🧺"],
  elder: ["🙏", "📻", "😌"],
};

/** The emotes for a turn of the crowd: up to EMOTES_MAX residents in turn, each with a picture of what they do. */
export function emotesFor(people: readonly { slot: number; kind: "resident" | "player"; person: { role: Role } }[], turn: number): { slot: number; emoji: string }[] {
  const residents = people.filter((person) => person.kind === "resident");
  if (residents.length === 0) return [];
  const count = Math.min(EMOTES_MAX, residents.length);
  return Array.from({ length: count }, (_, index) => {
    const person = residents[(turn * count + index) % residents.length];
    if (person === undefined) return null;
    const pictures = EMOTE_PICTURES[person.person.role];
    return { slot: person.slot, emoji: pictures[(turn + person.slot) % pictures.length] ?? "😄" };
  }).filter((one): one is { slot: number; emoji: string } => one !== null);
}

/**
 * The emotes over the crowd, while the world is free and settled. While someone's words stand over the scene (`quiet`)
 * they fade and wait, so no picture sits at a bubble's tail: words over a person or pictures,
 * never both.
 */
export function Emotes({ people, hidden, quiet = false, onTap }: { people: readonly { slot: number; kind: "resident" | "player"; person: { role: Role } }[]; hidden: boolean; quiet?: boolean; onTap?: (slot: number) => void }) {
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (hidden) return;
    const timer = window.setInterval(() => setTurn((now) => now + 1), EMOTE_MS);
    return () => window.clearInterval(timer);
  }, [hidden]);
  if (hidden) return null;
  return (
    <>
      {emotesFor(people, turn).map((emote) => (
        <div key={`${String(turn)}-${String(emote.slot)}`} className={`pointer-events-none fixed top-0 left-0 z-[36] transition-opacity duration-200 ease-out ${quiet ? "opacity-0" : ""}`} style={{ visibility: "hidden" }} aria-hidden data-emote-slot={emote.slot} data-emote-quiet={quiet ? "" : undefined}>
          {/* A picture over a head reads as a button on a phone, so a tap on it is a tap on that person: their line comes up. */}
          <button type="button" onClick={() => onTap?.(emote.slot)} className={`talk-emote pop -translate-x-1/2 -translate-y-full ${quiet ? "pointer-events-none" : "pointer-events-auto"}`} tabIndex={quiet ? -1 : undefined} data-emote={emote.emoji} data-emote-tap={emote.slot} aria-label={say("ui.talk.open.someone")}>
            {emote.emoji}
          </button>
        </div>
      ))}
    </>
  );
}
