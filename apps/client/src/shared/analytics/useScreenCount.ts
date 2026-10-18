// analytics:client-sends-interface-counts: a screen is counted each time it opens, never while it stays open.
import { useEffect } from "react";

import { counting } from "./start";

export function useScreenCount(screen: string | null): void {
  useEffect(() => {
    if (screen !== null) counting().count("screen/opened", screen);
  }, [screen]);
}
