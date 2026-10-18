// The frame a cut is drawn in: the landscape film ("wide", 1920 by 1080) or the portrait one for a phone's feed ("tall",
// 1080 by 1920). One list of shots draws both; each piece reads the frame and lays itself out for it. Anything drawn
// outside a cut that says otherwise is wide, so the earlier cuts stay as they were.
import { createContext, useContext } from "react";

export type FrameShape = "wide" | "tall";

export const FrameContext = createContext<FrameShape>("wide");

export function useFrameShape(): FrameShape {
  return useContext(FrameContext);
}

/** The composition: horizontal, 1920 by 1080 at 30 frames a second. */
export const VIDEO = { width: 1920, height: 1080, fps: 30 } as const;

/** The portrait composition for a phone's feed: 1080 by 1920 at 30 frames a second. */
export const TALL_VIDEO = { width: 1080, height: 1920, fps: 30 } as const;
