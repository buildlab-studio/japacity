// The load test's picks (load:constant-rate-command-mix, load:some-commands-sent-stale,
// load:fixed-seed-repeatable-run, load:connection-errors-counted-apart, load:main-scenario-pass-thresholds): which account, which kind of command,
// whether it is sent stale, which legal command is sent, and what the reply
// counts as. Plain JavaScript with no imports, so k6 and Node run the same
// file. Every pick is a pure function of the seed and the iteration's index,
// so two runs send the same commands in the same order.

/** The streams a roll is drawn on, so one pick never shares its numbers with another. */
export const STREAM = { kind: 1, stale: 2, choice: 3, offset: 4, step: 5, warm: 6, scenario: 7, reads: 8 };

/** A 32-bit mix of two whole numbers (the finaliser of MurmurHash3). */
export function mix32(a, b) {
  let h = Math.imul((a ^ 0x9e3779b9) >>> 0, 0x85ebca6b) ^ b;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** A whole number from 0 to `size - 1`, fixed by the seed, the index and the stream. */
export function roll(seed, index, stream, size) {
  return mix32(mix32(seed >>> 0, index >>> 0), stream) % size;
}

function gcd(a, b) {
  let x = a;
  let y = b;
  while (y !== 0) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x;
}

/**
 * load:constant-rate-command-mix, load:fixed-seed-repeatable-run: the account of iteration `index`, a seeded walk
 * that visits every account once before any comes round again, so two
 * commands in flight never share an account and race each other to `stale`.
 */
export function accountAt(seed, index, count) {
  if (count <= 1) return 0;
  let step = 1 + roll(seed, 0, STREAM.step, count - 1);
  while (gcd(step, count) !== 1) step = step === count - 1 ? 1 : step + 1;
  const offset = roll(seed, 0, STREAM.offset, count);
  return (((index % count) * step) % count + offset) % count;
}

/** load:constant-rate-command-mix: the kind of command iteration `index` asks for, by the mix's basis points. */
export function kindAt(seed, index, mix) {
  let left = roll(seed, index, STREAM.kind, 10000);
  for (const entry of mix) {
    if (left < entry.bp) return entry.kind;
    left -= entry.bp;
  }
  return mix[0].kind;
}

/** load:some-commands-sent-stale: whether iteration `index` is sent with an old `basedOn`. */
export function staleAt(seed, index, staleShareBp) {
  return roll(seed, index, STREAM.stale, 10000) < staleShareBp;
}

/** The answers that hold the turn: while one waits, `turn/end` is not legal. */
const ANSWERS = ["prologue/choose", "setpiece/answer", "interview/answer"];

const isKind = (command, kind) => (kind === "pair" ? command.type.startsWith("pair/") : command.type === kind);

/**
 * load:constant-rate-command-mix: one command of the kind asked for, from the legal list the
 * load route built from the view. When the view offers none of that kind,
 * a `turn/end`, then an answer the turn waits on, then any legal command.
 * Null when nothing is legal (a life that has ended).
 */
export function chooseCommand(legal, kind, choiceRoll) {
  if (legal.length === 0) return null;
  const tiers = [kind, "turn/end", ...ANSWERS];
  for (const tier of tiers) {
    const found = legal.filter((command) => isKind(command, tier));
    if (found.length > 0) return { command: found[choiceRoll % found.length], wanted: kind, fallback: tier !== kind };
  }
  return { command: legal[choiceRoll % legal.length], wanted: kind, fallback: true };
}

/** server:commands-only-through-route: the request body; load:some-commands-sent-stale: a stale one is based on the version before. */
export function commandBody(command, basedOn, stale) {
  const based = stale ? basedOn - 1 : basedOn;
  return { command: { ...command, basedOn: based }, basedOn: based };
}

/**
 * load:connection-errors-counted-apart, load:main-scenario-pass-thresholds: what a reply counts as. Status 0 is a connection
 * that failed on this machine, never the server's fault. A `stale` answer to
 * a command sent stale on purpose is expected; every other refusal is not.
 */
export function classify(status, body, stale) {
  if (status === 0) return "connection-error";
  if (status >= 500) return "server-error";
  if (status === 200 && body !== null && body.ok === true) return "accepted";
  if (stale && status === 200 && body !== null && body.code === "stale") return "stale-expected";
  if (status === 429) return "rate-limited";
  return "unexpected";
}
