// Which clock the local authority runs on. The fast clock fills the bank of turns
// whenever it is empty, so the bank-full notice never waits on real time in
// development (docs/rules/turn.md, "Outside the simulation"); a sealed result still
// waits for the game's own morning. It must never reach players: a production build
// ignores the variable, so a stray VITE_FAST_CLOCK in a deploy cannot hand out turns.

export interface ClockMode {
  fastClock: boolean;
}

export function clockMode(): ClockMode {
  const env = import.meta.env;
  if (env.PROD) return { fastClock: false };
  return { fastClock: env.DEV || env.VITE_FAST_CLOCK === "1" };
}
