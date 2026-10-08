// The Workers tests read the gate's bindings through `env` and call it through `exports`,
// both from `cloudflare:workers`; this gives them the Worker's own types.
import type { Env as GateEnv } from "./index";

declare global {
  namespace Cloudflare {
    interface Env extends GateEnv {
      GATE_SECRET: GateEnv["GATE_SECRET"];
    }
    interface GlobalProps {
      mainModule: typeof import("./index");
    }
  }
}
