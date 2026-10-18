// A workplace with a door (world:ride-abroad-and-workplace): the thing where a job abroad is got (the reception desk, the
// nurses' station, the clock-in, the desks, the tills, the kitchen door, the courier's bike) is also where it is held.
// Once the job is the life's, the hunt does not list it, so its act would leave the thing; instead the act becomes the
// shift's own plain act and the thing's label says "On shift". Pure: it reads the things and the job held, nothing else.
import type { Act, Thing } from "../../../shared/world/contract";

/** The id of the act a held job's thing carries in place of the job's sheet. */
export const SHIFT_ACT = "on-shift";

const SHIFT: Act = { id: SHIFT_ACT, label: "city.act.on-shift", kind: "plain" };

/** Whether an act opens the sheet of `job`, as its own entry or one listed with it. */
function opensJob(act: Act, job: string): boolean {
  return act.kind === "sheet" && (act.stages === job || (act.more ?? []).includes(job));
}

/**
 * The things with the held job's act turned into the shift: abroad only, since at home a board lists the jobs a hunt can
 * still ask for and says why a held one is shut. The thing's other acts stay as they are.
 */
export function onShift(things: readonly Thing[], job: string | null, abroad: boolean): Thing[] {
  if (job === null || !abroad) return [...things];
  return things.map((thing) => {
    const at = thing.acts.findIndex((act) => opensJob(act, job));
    if (at < 0) return thing;
    return { ...thing, acts: thing.acts.map((act, index) => (index === at ? SHIFT : act)) };
  });
}

/** The label's state for each thing that carries the shift: "On shift", in the words given (world:ride-abroad-and-workplace). */
export function shiftMarks(things: readonly Pick<Thing, "id" | "acts">[], words: string): Record<string, string> {
  const marks: Record<string, string> = {};
  for (const thing of things) if (thing.acts.some((act) => act.id === SHIFT_ACT)) marks[thing.id] = words;
  return marks;
}
