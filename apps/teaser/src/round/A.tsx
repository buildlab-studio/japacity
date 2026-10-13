// Direction A, the city: the straightest trailer of the three. The painted map, then the world cut on the beat between
// short title cards: the street and the danfo, the house turning by day, its lamps at night, the plane leaving over the
// lagoon, and the name. Shots of about a second and a half, title cards of about two thirds of a second.
import { AbsoluteFill } from "remotion";

import { loadRubik } from "../parts/fonts";
import { NIGHT } from "../parts/tokens";
import { EndCard, MapShot, PlaneOver, TitleCard, WideShot } from "./scenes";
import { lengthOf, type Shot, Shots } from "./shots";

export const A_SHOTS: readonly Shot[] = [
  { frames: 44, node: <MapShot paint="day" zoom={[1.02, 1.3]} toward={[0.46, 0.32]} /> },
  { frames: 22, entry: "slide-up", node: <TitleCard words="This is Lagos." /> },
  { frames: 40, node: <WideShot clip="wide-ride" from={36} push={0.08} /> },
  { frames: 24, entry: "slide-up", node: <TitleCard words="A month at a time." /> },
  { frames: 46, node: <WideShot clip="wide-day" from={40} push={0.05} /> },
  { frames: 22, entry: "slide-up", node: <TitleCard words="Your people." paint={NIGHT} /> },
  { frames: 42, node: <WideShot clip="wide-night" from={30} push={0.07} /> },
  {
    frames: 44,
    node: (
      <AbsoluteFill>
        <MapShot paint="night" zoom={[1.25, 1.0]} toward={[0.7, 0.4]} />
        <PlaneOver paint="night" />
      </AbsoluteFill>
    ),
  },
  { frames: 56, entry: "slide-up", node: <EndCard glowFrom={6} /> },
];

export const A_FRAMES = lengthOf(A_SHOTS);

export function RoundA() {
  loadRubik();
  return <Shots shots={A_SHOTS} />;
}
