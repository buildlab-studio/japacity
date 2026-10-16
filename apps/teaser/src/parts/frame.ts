// The frame a cut is drawn in: the landscape film ("wide", 1920 by 1080) or the portrait one for a phone's feed ("tall",
// 1080 by 1920). One list of shots draws both; each piece reads the frame and lays itself out for it. Anything drawn
// outside a cut that says otherwise is wide, so the earlier cuts stay as they were.
import { createContext, useContext } from "react";

export type FrameShape = "wide" | "tall";

export const FrameContext = createContext<FrameShape>("wide");

export function useFrameShape(): FrameShape {
  return useContext(FrameContext);
}
