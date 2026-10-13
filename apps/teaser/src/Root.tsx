// The composition: the teaser, 1920 by 1080 at 30 frames a second.
import { Composition } from "remotion";

import { VIDEO } from "./parts/tokens";
import { Teaser, TEASER_FRAMES } from "./teaser/Teaser";

export function Root() {
  return <Composition id="Teaser" component={Teaser} durationInFrames={TEASER_FRAMES} {...VIDEO} />;
}
