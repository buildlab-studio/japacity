// The compositions at 30 frames a second: the teaser in its two frames (1920 by 1080, and 1080 by 1920 for a phone's feed),
// with two other cuts beside it: `Teaser` and `Deck`, the deck of cards; and the stageshow teaser in its two frames, the
// game's own screens as product shots (`Stageshow`, `StageshowPortrait`).
import { Composition } from "remotion";

import { VIDEO } from "./parts/frame";
import { Lead, LEAD_COMPOSITIONS, LeadPortrait } from "./lead/Lead";
import { Poster } from "./lead/Poster";
import { DECK_FRAMES, Deck } from "./deck/Deck";
import { Teaser, TEASER_FRAMES } from "./teaser/Teaser";
import { Stageshow, STAGESHOW_COMPOSITIONS, StageshowPortrait } from "./stage/Stageshow";

export function Root() {
  return (
    <>
      <Composition id="Teaser" component={Teaser} durationInFrames={TEASER_FRAMES} {...VIDEO} />
      <Composition id="Deck" component={Deck} durationInFrames={DECK_FRAMES} {...VIDEO} />
      <Composition id="Lead" component={Lead} {...LEAD_COMPOSITIONS.Lead} />
      <Composition id="LeadPortrait" component={LeadPortrait} {...LEAD_COMPOSITIONS.LeadPortrait} />
      <Composition id="Poster" component={Poster} durationInFrames={1} {...VIDEO} />
      <Composition id="Stageshow" component={Stageshow} {...STAGESHOW_COMPOSITIONS.Stageshow} />
      <Composition id="StageshowPortrait" component={StageshowPortrait} {...STAGESHOW_COMPOSITIONS.StageshowPortrait} />
    </>
  );
}
