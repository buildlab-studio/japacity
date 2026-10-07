// Every blessed golden. `pnpm bless` rewrites this file.
import type { Golden } from "../engine/golden";

import miniPlainResting from "./mini-plain-resting.json";
import miniWorkerStudying from "./mini-worker-studying.json";
import adaCareful from "./ada-careful.json";
import tundeBorrower from "./tunde-borrower.json";
import zainabRemote from "./zainab-remote.json";

export const goldens: Golden[] = [miniPlainResting as Golden, miniWorkerStudying as Golden, adaCareful as Golden, tundeBorrower as Golden, zainabRemote as Golden];
