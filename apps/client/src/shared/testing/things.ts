// One thing of a place's stage, by id, for the tests that read a stage's things.
import type { Thing } from "../world/contract";

/** The thing with this id among `things`, or a throw naming the id. */
export function thingIn(things: readonly Thing[] | undefined, id: string): Thing {
  const found = (things ?? []).find((candidate) => candidate.id === id);
  if (found === undefined) throw new Error(`No ${id}`);
  return found;
}
