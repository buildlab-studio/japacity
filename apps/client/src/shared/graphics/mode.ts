// The city's graphics mode (city.md R-CITY-019), kept where any screen may
// read it: the city writes it each time its mode changes, and the feedback
// form sends it (R-MODERATION-020). Nothing is kept on the device here. A
// mode the player chooses in the city's settings is counted (R-ANALYTICS-002).
import { counting } from "../analytics/start";

export type GraphicsMode = "low" | "high";

/** What the player may choose: a mode, or leave it to the device. */
export type GraphicsChoice = GraphicsMode | "auto";

/** A phone starts low, and most players are on one, until the city says otherwise. */
let current: GraphicsMode = "low";

export function setGraphicsMode(mode: GraphicsMode): void {
  current = mode;
}

export function graphicsMode(): GraphicsMode {
  return current;
}

/** R-ANALYTICS-002: the player changed the graphics setting. The city's own drop to low is not a choice and is not counted. */
export function chooseGraphics(choice: GraphicsChoice): void {
  counting().count("settings/graphics", choice);
}
