// Every blessed golden. `pnpm bless` rewrites this file.
import type { Golden } from "../src/engine/golden";

import miniPlainResting from "./mini-plain-resting.json";
import miniWorkerStudying from "./mini-worker-studying.json";

export const goldens: Golden[] = [miniPlainResting as Golden, miniWorkerStudying as Golden];
