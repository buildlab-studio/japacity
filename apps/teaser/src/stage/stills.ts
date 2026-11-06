// The stageshow cuts' moments kept as pictures beside a render (pnpm --filter @japacity/teaser stage -- --stills
// <folder>): the first cut's landscape end card and portrait opening, and the second cut's opening (Start work pressed
// at the racks) and end card. Plain numbers, so the render script reads them without the compositions; each cut's test
// checks its stills land where they say.
export interface StageStill {
  readonly name: string;
  readonly id: "Stageshow" | "StageshowPortrait" | "StageshowBPortrait";
  readonly frame: number;
}

export const STAGE_STILLS: readonly StageStill[] = [
  { name: "landscape-end", id: "Stageshow", frame: 852 },
  { name: "portrait-open", id: "StageshowPortrait", frame: 75 },
  { name: "b-portrait-open", id: "StageshowBPortrait", frame: 15 },
  { name: "b-portrait-end", id: "StageshowBPortrait", frame: 597 },
];
