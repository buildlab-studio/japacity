// The compositions at 30 frames a second: the teaser in its two frames (1920 by 1080, and 1080 by 1920 for a phone's feed),
// with two other cuts beside it: `Teaser` and `RoundD`, the presentation grammar.
import { Composition } from "remotion";

import { VIDEO } from "./parts/tokens";
import { Lead, LEAD_COMPOSITIONS, LeadPortrait } from "./lead/Lead";
import { Poster } from "./lead/Poster";
import { ROUND_D_FRAMES, RoundD } from "./roundD/RoundD";
import { Teaser, TEASER_FRAMES } from "./teaser/Teaser";

export function Root() {
  return (
    <>
      <Composition id="Teaser" component={Teaser} durationInFrames={TEASER_FRAMES} {...VIDEO} />
      <Composition id="RoundD" component={RoundD} durationInFrames={ROUND_D_FRAMES} {...VIDEO} />
      <Composition id="Lead" component={Lead} {...LEAD_COMPOSITIONS.Lead} />
      <Composition id="LeadPortrait" component={LeadPortrait} {...LEAD_COMPOSITIONS.LeadPortrait} />
      <Composition id="Poster" component={Poster} durationInFrames={1} {...VIDEO} />
    </>
  );
}
