// What a recording made by tools/goldens/record-lives.ts promises: the recorder picks
// its lives by these numbers and the tests of the recorded lives read them
// here, since the simulation imports nothing from the tools.

/** The months a recorded life to the flight may leave in, both ends included. */
export const FLIGHT_WINDOW = { first: 24, last: 40 } as const;

/** The months a master's life of design page 13's dearer band leaves in (the graduate's master's with the pledge), both ends included. */
export const MASTERS_WINDOW = { first: 48, last: 72 } as const;

/** The recorded lives whose flight is the master's of the dearer band, and so leave in its window. */
const IN_MASTERS_WINDOW = ["graduate-careful", "teacher-borrower"];

/** The window a recorded life to the flight leaves in, by its name. */
export function flightWindowOf(name: string): { first: number; last: number } {
  return IN_MASTERS_WINDOW.includes(name) ? MASTERS_WINDOW : FLIGHT_WINDOW;
}

/** The months a recorded life abroad carries on before it comes home by choice. */
export const MONTHS_ABROAD = 36;
