# 0003. Random draws are counted by position

Status: Accepted

## Context

engine:randomness-from-named-streams says a draw from one stream never changes another, and that the nth draw depends only on the seed, the stream and n. Generators that carry internal state, pure-rand among them, give a sequence, not a draw at a position, and storing a generator's state for each stream would put hidden numbers in every save.

## Decision

Random numbers in the simulation come from our own small module, `engine/random.ts`. The nth draw of a stream is SplitMix32 applied to a base, hashed from the seed and the stream's name, plus n times a fixed step. The state stores only the count of draws made on each stream.

## Consequences

- About thirty lines we own and test, with a fixed table of expected outputs so any change is caught.
- A stream repeats after about four billion draws, which no life reaches.
- A save carries counts, never generator state.
- fast-check keeps its own generator inside itself for test generation; that is not the simulation's randomness.
