// The stageshow cuts' scenes, each a stage of its own that the page mounts by name: the first cut's four, drawn in the
// frame the page is opened for, and the second cut's three, drawn on the phone.
import type { ComponentType } from "react";

import "./look.css";

import type { Shape } from "./host";
import { PaydayScene } from "./b/scenes/payday";
import { RacksScene } from "./b/scenes/racks";
import { RoadScene } from "./b/scenes/road";
import type { SceneNameB } from "./b/timings";
import { DoorScene } from "./scenes/door";
import { MonthScene } from "./scenes/month";
import { StepScene } from "./scenes/step";
import { WaysScene } from "./scenes/ways";
import type { SceneName } from "./timings";

export type { SceneName, SceneNameB, Shape };

export const SCENES: Readonly<Record<SceneName | SceneNameB, ComponentType<{ shape: Shape }>>> = {
  door: DoorScene,
  step: StepScene,
  month: MonthScene,
  ways: WaysScene,
  "b-racks": RacksScene,
  "b-payday": PaydayScene,
  "b-road": RoadScene,
};
