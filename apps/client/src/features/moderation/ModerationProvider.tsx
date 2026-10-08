// Which moderation calls the screens use: the build's own unless a provider
// above hands in others, as the tests do.
import { createContext, useContext, type ReactNode } from "react";

import { buildModerationApi, type ModerationApi } from "./api";

const ModerationContext = createContext<{ api: ModerationApi | null } | undefined>(undefined);

export function ModerationProvider({ api, children }: { api: ModerationApi | null; children: ReactNode }) {
  return <ModerationContext.Provider value={{ api }}>{children}</ModerationContext.Provider>;
}

export function useModeration(): ModerationApi | null {
  const given = useContext(ModerationContext);
  return given === undefined ? buildModerationApi() : given.api;
}
