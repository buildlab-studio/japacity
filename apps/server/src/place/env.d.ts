// The Workers tests read the server's bindings through `env` from
// `cloudflare:workers`; this gives that `env` the Worker's own type.
import type { Env as WorkerEnv } from "../index";

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      PLACE: WorkerEnv["PLACE"];
    }
  }
}
