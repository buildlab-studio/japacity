// What a recording made by tools/record-lives.ts promises, for the tests that
// read the recorded lives. Apart from the recorder, which writes files, so a
// simulation test can import it.

/** The months a recorded life to the flight may leave in, both ends included. */
export const FLIGHT_WINDOW = { first: 24, last: 40 } as const;

/** The months a recorded life abroad carries on before it comes home by choice. */
export const MONTHS_ABROAD = 36;
