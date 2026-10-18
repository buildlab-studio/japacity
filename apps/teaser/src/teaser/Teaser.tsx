// The teaser: thirty seconds, horizontal, silent, cut as a game trailer for a toy city. It opens on the painted map, cuts
// on the beat between the world's shots and big title cards, cuts in two built moments (the passbook, the ways out), lets
// the night fall over the house, sends the plane from Lagos to London over the night map, and ends on the seal with its
// bulbs lit, the name and "Play it". Every shot names the recorded clips it shows, so a test can mount each one.
import type { ClipName } from "../clips";
import { loadRubik } from "../parts/fonts";
import { NIGHT } from "@japacity/brand";
import { SaveUp, WayOut } from "./inserts";
import { Flight, MapShot, NightEnd, NightFalls, PhoneShot, TitleCard, WideShot } from "./scenes";
import { lengthOf, type Shot, Shots } from "./shots";

export interface TeaserShot extends Shot {
  readonly clips: readonly ClipName[];
}

export const TEASER_SHOTS: readonly TeaserShot[] = [
  { frames: 66, clips: [], node: <MapShot paint="day" zoom={[1.0, 1.3]} toward={[0.46, 0.32]} /> },
  { frames: 26, entry: "slide-up", clips: [], node: <TitleCard words="This is Lagos." /> },
  { frames: 60, clips: ["wide-ride"], node: <WideShot clip="wide-ride" from={30} push={0.08} /> },
  { frames: 48, clips: ["wide-ride"], node: <WideShot clip="wide-ride" from={132} push={0.05} /> },
  { frames: 26, entry: "slide-up", clips: [], node: <TitleCard words="A month at a time." /> },
  { frames: 66, clips: ["wide-day"], node: <WideShot clip="wide-day" from={40} push={0.05} /> },
  { frames: 66, clips: ["wide-sofa"], node: <WideShot clip="wide-sofa" from={40} push={0.16} toward={[0.4, 0.4]} /> },
  { frames: 26, entry: "slide-up", clips: [], node: <TitleCard words="Your people." paint={NIGHT} /> },
  { frames: 54, clips: ["wide-street"], node: <WideShot clip="wide-street" push={0.1} toward={[0.5, 0.45]} /> },
  { frames: 26, entry: "slide-up", clips: [], node: <TitleCard words="Save up." /> },
  { frames: 54, clips: [], node: <SaveUp /> },
  { frames: 54, clips: ["morning"], node: <PhoneShot clip="morning" from={105} /> },
  { frames: 28, entry: "slide-up", clips: [], node: <TitleCard words="Find your way out." /> },
  { frames: 66, clips: [], node: <WayOut /> },
  { frames: 72, clips: ["wide-day", "wide-night"], node: <NightFalls /> },
  { frames: 78, clips: [], node: <Flight city="London" tile="bld_rye-lane-terrace_a" /> },
  { frames: 144, entry: "slide-up", clips: [], node: <NightEnd /> },
];

export const TEASER_FRAMES = lengthOf(TEASER_SHOTS);

/** The frame each shot starts on, its transition's overlap taken off. */
export function shotStarts(shots: readonly Shot[]): number[] {
  return shots.map((_, index) => lengthOf(shots.slice(0, index + 1)) - (shots[index]?.frames ?? 0));
}

export function Teaser() {
  loadRubik();
  return <Shots shots={TEASER_SHOTS} />;
}
