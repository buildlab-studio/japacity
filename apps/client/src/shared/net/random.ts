// The device's own random waits (R-CLOCK-019, R-CLOCK-023). They spread
// requests out and touch nothing in the game, so they come from the browser.

/** A whole number from 0 up to but not including `below`. */
export type RandomBelow = (below: number) => number;

export const deviceRandom: RandomBelow = (below) => {
  if (below <= 1) return 0;
  const draw = new Uint32Array(1);
  crypto.getRandomValues(draw);
  return (draw[0] ?? 0) % below;
};
