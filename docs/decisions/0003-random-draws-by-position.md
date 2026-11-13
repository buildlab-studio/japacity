# 0003. Random draws are counted by position

Status: Accepted

## Context

- engine:randomness-from-named-streams says a draw from one stream never changes another, and the nth draw depends only on the seed, the stream and n.
- A generator with internal state gives a sequence, not a draw at a position.
- Storing a generator's state for each stream would put hidden numbers in every save.

## Decision

- Random numbers in the simulation come from our own small module, `engine/random.ts`.
- Each stream has a base, hashed from the seed and the stream's name.
- The nth draw of a stream is SplitMix32 applied to the base plus n times a fixed step.
- The state stores only how many draws each stream has made.

## Consequences

- About a hundred lines we own and test, with a fixed table of expected outputs so any change is caught.
- A stream repeats after about four billion draws, which no life reaches.
- A save holds counts, never generator state.
- fast-check keeps its own generator for making test cases. That is not the simulation's randomness.

## Alternatives

- **A library generator with internal state, pure-rand among them.** It gives a sequence, so a draw at a position means replaying every draw before it, and a save would have to store each stream's generator state.
