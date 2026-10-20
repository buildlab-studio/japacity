// Every blessed golden. `pnpm bless` rewrites this file.
import type { Golden } from "../engine/golden";

import miniPlainResting from "./mini-plain-resting.json";
import miniWorkerStudying from "./mini-worker-studying.json";
import graduateCareful from "./graduate-careful.json";
import bankerBorrower from "./banker-borrower.json";
import developerRemote from "./developer-remote.json";
import graduateAbroad from "./graduate-abroad.json";
import bankerAbroad from "./banker-abroad.json";
import developerAbroad from "./developer-abroad.json";

export const goldens: Golden[] = [miniPlainResting as Golden, miniWorkerStudying as Golden, graduateCareful as Golden, bankerBorrower as Golden, developerRemote as Golden, graduateAbroad as Golden, bankerAbroad as Golden, developerAbroad as Golden];
