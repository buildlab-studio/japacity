// A job a way out depends on: the UK care route needs twenty-four months as a nurse
// before the council's verification (route-gates:care-route-needs-verification). A life on that way is never nudged off that job, and a
// job offer says what taking it ends.
import type { Id, PlayerView } from "@japacity/sim";

/** The jobs a route counts the months of, by the route that needs them. */
const KEEP_JOB: Readonly<Record<string, Id<"route">>> = { "activity.job-nurse": "route.uk-care" };

/** The route that counts the months in the job held, when it is in play; null otherwise. */
export function routeKeptBy(view: Pick<PlayerView, "job"> & Partial<Pick<PlayerView, "routes">>): Id<"route"> | null {
  const job = view.job.id;
  if (job === null) return null;
  const route = KEEP_JOB[job];
  if (route === undefined) return null;
  const state = view.routes?.find((one) => one.id === route)?.state ?? "unknown";
  return state === "unknown" ? null : route;
}
