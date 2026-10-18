// The front page's hero: one frame of the lead cut with a play button over it, so the README shows the teaser itself
// and a tap opens the video. `frame` picks the moment; `npx remotion still src/index.ts Poster out.png` renders it.
import { AbsoluteFill, Sequence } from "remotion";

import { PressButton } from "../parts/dress";
import { FONT, NAVY } from "@japacity/brand";
import { Lead } from "./Lead";

export const POSTER_FRAME = 282;

export function Poster({ frame = POSTER_FRAME }: { frame?: number }) {
  return (
    <AbsoluteFill style={{ background: NAVY }}>
      <Sequence from={-frame} durationInFrames={frame + 1}>
        <Lead />
      </Sequence>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "flex-end", paddingBottom: 64 }}>
        <PressButton size={56} style={{ gap: 22 }}>
          <svg width="40" height="44" viewBox="0 0 40 44" style={{ display: "block" }}>
            <path d="M4 3 L37 22 L4 41 Z" fill={NAVY} />
          </svg>
          <span style={{ fontFamily: FONT }}>Watch the teaser · 28 s</span>
        </PressButton>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
