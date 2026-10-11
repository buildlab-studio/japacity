// R-SERVER-040: the scheduled jobs, each run on its own. A job that throws
// or rejects is caught and logged with its name (R-SERVER-039), so one
// failure never stops or hides another. Once every job has settled, the
// names of those that failed reject one last promise, so the cron's own
// record (Cron Events) still says the run failed.
import { logFailure } from "../log";

export interface NamedJob {
  /** Short and fixed (`ticks`, `money`): the log line's `job`. */
  name: string;
  run: () => Promise<unknown>;
}

/** The run's rejection when a job failed: it names the jobs, and nothing else. */
export class JobsFailed extends Error {
  override name = "JobsFailed";
  constructor(readonly jobs: readonly string[]) {
    super(`Jobs failed: ${jobs.join(", ")}`);
  }
}

/** Starts every job, each kept alive by `waitUntil`; resolves with the names of those that failed. */
export function runJobs(jobs: readonly NamedJob[], waitUntil: (promise: Promise<unknown>) => void): Promise<string[]> {
  const settled = jobs.map(({ name, run }) => {
    const caught = Promise.resolve()
      .then(run)
      .then(
        () => null,
        (error: unknown) => {
          logFailure({ what: "job", job: name, error });
          return name;
        },
      );
    waitUntil(caught);
    return caught;
  });
  const failed = Promise.all(settled).then((names) => names.filter((name): name is string => name !== null));
  waitUntil(
    failed.then((names) => {
      if (names.length > 0) throw new JobsFailed(names);
    }),
  );
  return failed;
}
