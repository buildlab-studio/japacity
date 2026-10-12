// The game's wordmark (account.md R-ACCOUNT-029): shown on the account screens only, never on
// the door or in onboarding. The files are drawn by hand in public/brand/ (their notes in brand/README.md, out of the
// served folder), one for each ground: a light ground is the sheet, a dark one the band or the sky behind the figure.
// The game has one look since the lively layer (decision 0038), so the adire files are the ones shown.
import { say } from "../words/text";

export type Ground = "light" | "dark";

/** The wordmark's file for a ground, under the published root. */
export function wordmarkFile(ground: Ground): string {
  return `${import.meta.env.BASE_URL}brand/japacity-wordmark-adire-${ground}.svg`;
}

/**
 * The wordmark at the top of an account screen, with air around it; its words are the game's name. Over the scene it
 * stands a little taller than on a sheet, since the figure is the only thing near it there.
 */
export function Wordmark({ ground, className = "" }: { ground: Ground; className?: string }) {
  const height = ground === "dark" ? "h-10" : "h-9";
  return <img src={wordmarkFile(ground)} alt={say("ui.game")} draggable={false} className={`mx-auto block w-auto ${height} ${className}`} data-wordmark={ground} />;
}
