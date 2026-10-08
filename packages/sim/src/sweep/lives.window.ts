// What a recording made by tools/record-lives.ts promises: the recorder picks
// its lives by these numbers and the tests of the recorded lives read them
// here, since the simulation imports nothing from the tools.

/** The months a recorded life to the flight may leave in, both ends included. */
export const FLIGHT_WINDOW = { first: 24, last: 40 } as const;

/** The months a recorded life abroad carries on before it comes home by choice. */
export const MONTHS_ABROAD = 36;
