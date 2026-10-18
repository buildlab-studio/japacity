// Every property test runs on one fixed seed, so a run is reproducible and a
// failure is a finding with a seed, never luck (engine:limits-tested-through-step's minute holds
// too: a random seed can shrink a 300-command life for half an hour). Set
// FC_SEED to explore another seed on purpose; report what it finds.
import { fc } from "@fast-check/vitest";

const FIXED_SEED = 20261008;
const asked = process.env["FC_SEED"];
const seed = asked === undefined || asked === "" ? FIXED_SEED : Number(asked);
if (!Number.isInteger(seed)) throw new Error(`FC_SEED must be an integer, not ${asked ?? ""}.`);

fc.configureGlobal({ seed });
