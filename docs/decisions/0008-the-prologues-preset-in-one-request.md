# 0008. The prologue's preset is played by the server in one request

Status: Accepted

## Context

A new life's prologue is a run of `prologue/choose` steps answered by the archetype picked at the front door, the three screens that start a life (an archetype is a preset of the prologue's answers, prologue:archetype-presets-answers). Offline the steps run in a fraction of a second. Online each step is a command, and the command limit that guards the authority against floods (server:per-account-rate-limits) would make a new player wait several seconds on the first minute of play.

## Decision

Online, Begin sends the archetype's preset as one request, `POST /api/prologue/preset` (server:server-plays-prologue-preset), with the archetype, the age and the home chosen at the door and the version seen. The server plays it in one transaction as it plays a command (server:one-command-one-transaction: the lock, the stale check, the replay), stepping `prologue/choose` for each step in turn with the answer that content's `presetAnswer` gives (`packages/content/src/prologue/prologue.preset.ts`, read by the client and the server alike), one log row per accepted command, the version raised by the count, until the prologue closes or an answer is refused. The steps before a refusal stand. The reply carries the view after the last step, the clock and the trail of the steps played, from which the page fills (prologue:printed-page-hands-over). The request counts once against the command limit.

## Consequences

- The batch is the server's: the simulation has no preset command, and the commands inside the batch are the ones the client would send one by one.
- The preset's answers live in one place, read by both sides, and the trail is what was actually stepped.
- The flood guard holds: one request carries at most the prologue's steps, for one character, once.
- Offline the client sends the steps one by one, with no limit to wait on.

## Alternatives

- A higher command limit: it would weaken the flood guard for every command to serve one minute of play.
- The steps played on the client and the result sent up: the prologue's draws need the seed, which never leaves the authority (engine:seed-never-leaves-authority).
