// The stageshow teaser's moments kept as pictures beside a render (pnpm --filter @japacity/teaser stage -- --stills
// <folder>): the landscape's end card and the portrait's opening, the two pictures that stand for the films. Plain
// numbers, so the render script reads them without the composition; the cut's test checks each lands where it says.
export interface StageStill {
  readonly name: string;
  readonly id: "Stageshow" | "StageshowPortrait";
  readonly frame: number;
}

export const STAGE_STILLS: readonly StageStill[] = [
  { name: "landscape-end", id: "Stageshow", frame: 852 },
  { name: "portrait-open", id: "StageshowPortrait", frame: 75 },
];
