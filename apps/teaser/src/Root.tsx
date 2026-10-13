// The compositions: the round's three ten-second directions, each 1920 by 1080 at 30 frames a second.
import { Composition } from "remotion";

import { VIDEO } from "./parts/tokens";
import { A_FRAMES, RoundA } from "./round/A";
import { B_FRAMES, RoundB } from "./round/B";
import { C_FRAMES, RoundC } from "./round/C";

export function Root() {
  return (
    <>
      <Composition id="RoundA" component={RoundA} durationInFrames={A_FRAMES} {...VIDEO} />
      <Composition id="RoundB" component={RoundB} durationInFrames={B_FRAMES} {...VIDEO} />
      <Composition id="RoundC" component={RoundC} durationInFrames={C_FRAMES} {...VIDEO} />
    </>
  );
}
