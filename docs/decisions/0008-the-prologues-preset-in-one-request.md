# 0008. The prologue's preset is played by the server in one request

Status: Accepted

## Context

- A new life's prologue is a run of `prologue/choose` steps.
- The steps are answered by the archetype picked at the front door, the three screens that start a life. An archetype is a preset of the prologue's answers (prologue:archetype-presets-answers).
- Offline the steps run in a fraction of a second.
- Online each step is a command. The command limit that guards the authority against floods (server:per-account-rate-limits) would make a new player wait several seconds in the first minute of play.

## Decision

**One request** (server:server-plays-prologue-preset)

- Online, Begin sends the archetype's preset as one request, `POST /api/prologue/preset`.
- It carries the archetype, the age and the home chosen at the door, and the version seen.
- The request counts once against the command limit.

**The server plays it as it plays a command** (server:one-command-one-transaction)

- It runs in one transaction, with the lock, the stale check and the replay.
- It steps `prologue/choose` for each step in turn, with the answer content's `presetAnswer` gives. That is `packages/content/src/prologue/prologue.preset.ts`, read by the client and the server alike.
- Each accepted command writes one log row and raises the version by one.
- It stops when the prologue closes or an answer is refused. The steps before a refusal stand.

**The reply** (prologue:printed-page-hands-over)

- It carries the view after the last step, the clock, and the trail of the steps played.
- The page fills from the trail.

## Consequences

- The batch is the server's. The simulation has no preset command, and the commands inside the batch are the ones the client would send one by one.
- The preset's answers live in one place, read by both sides, and the trail is what was actually played.
- The flood guard holds: one request carries at most the prologue's steps, for one character, once.
- Offline the client sends the steps one by one, with no limit to wait on.

## Alternatives

- **A higher command limit.** It would weaken the flood guard for every command to serve one minute of play.
- **The steps played on the client and the result sent up.** The prologue's draws need the seed, which never leaves the authority (engine:seed-never-leaves-authority).
