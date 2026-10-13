// A run of shots, each with its length and how it comes in: a hard cut, or a spring slide over the shot before.
// The length of the whole is the shots' lengths less the frames their transitions overlap.
import type { ReactNode } from "react";
import { springTiming, TransitionSeries } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";

export type Entry = "cut" | "slide-up" | "slide-left";

export interface Shot {
  readonly frames: number;
  readonly entry?: Entry;
  readonly node: ReactNode;
}

/** How long a spring transition overlaps the shot before it. */
export const ENTRY_FRAMES = 10;

export function lengthOf(shots: readonly Shot[]): number {
  return shots.reduce((total, shot, index) => total + shot.frames - (index > 0 && (shot.entry ?? "cut") !== "cut" ? ENTRY_FRAMES : 0), 0);
}

function presentation(entry: Exclude<Entry, "cut">) {
  return slide({ direction: entry === "slide-up" ? "from-bottom" : "from-right" });
}

export function Shots({ shots }: { shots: readonly Shot[] }) {
  return (
    <TransitionSeries>
      {shots.flatMap((shot, index) => {
        const entry = shot.entry ?? "cut";
        const parts: ReactNode[] = [];
        if (index > 0 && entry !== "cut") {
          parts.push(
            <TransitionSeries.Transition
              key={`t${String(index)}`}
              presentation={presentation(entry)}
              timing={springTiming({ config: { damping: 200 }, durationInFrames: ENTRY_FRAMES })}
            />,
          );
        }
        parts.push(
          <TransitionSeries.Sequence key={`s${String(index)}`} durationInFrames={shot.frames}>
            {shot.node}
          </TransitionSeries.Sequence>,
        );
        return parts;
      })}
    </TransitionSeries>
  );
}
