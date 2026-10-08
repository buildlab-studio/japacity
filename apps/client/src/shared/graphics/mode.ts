// The city's graphics mode (city.md R-CITY-019), kept where any screen may
// read it: the city writes it each time its mode changes, and the feedback
// form sends it (R-MODERATION-020). Nothing is kept on the device here.
export type GraphicsMode = "low" | "high";

/** A phone starts low, and most players are on one, until the city says otherwise. */
let current: GraphicsMode = "low";

export function setGraphicsMode(mode: GraphicsMode): void {
  current = mode;
}

export function graphicsMode(): GraphicsMode {
  return current;
}
