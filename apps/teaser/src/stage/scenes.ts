// The stageshow teaser's scenes, each a stage of its own that the page mounts by name.
import type { ComponentType } from "react";

import "./kit/stageshow.css";
import "./look.css";

import type { Shape } from "./host";
import { DoorScene } from "./scenes/door";
import { MonthScene } from "./scenes/month";
import { StepScene } from "./scenes/step";
import { WaysScene } from "./scenes/ways";
import type { SceneName } from "./timings";

export type { SceneName, Shape };

export const SCENES: Readonly<Record<SceneName, ComponentType<{ shape: Shape }>>> = {
  door: DoorScene,
  step: StepScene,
  month: MonthScene,
  ways: WaysScene,
};
