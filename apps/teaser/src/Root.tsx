// The compositions, 1920 by 1080 at 30 frames a second: the teaser, and direction D of the round of looks beside it.
import { Composition } from "remotion";

import { VIDEO } from "./parts/tokens";
import { Lead, LEAD_FRAMES } from "./lead/Lead";
import { ROUND_D_FRAMES, RoundD } from "./roundD/RoundD";
import { Teaser, TEASER_FRAMES } from "./teaser/Teaser";

export function Root() {
  return (
    <>
      <Composition id="Teaser" component={Teaser} durationInFrames={TEASER_FRAMES} {...VIDEO} />
      <Composition id="RoundD" component={RoundD} durationInFrames={ROUND_D_FRAMES} {...VIDEO} />
      <Composition id="Lead" component={Lead} durationInFrames={LEAD_FRAMES} {...VIDEO} />
    </>
  );
}
