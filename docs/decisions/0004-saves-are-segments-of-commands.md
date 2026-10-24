# 0004. A save is a list of segments of commands

Status: Accepted

## Context

A state is rebuilt by replaying its commands under the content they were accepted under (engine:state-is-plain-data), and the server rebuilds any character that way (server:log-rows-hash-state). Content changes while characters live. A save that names one content version for its whole life would be stranded by the first content change.

## Decision

A save is `{ schema, segments }`. Each segment names its content version and, where one was applied, its overlay version (an overlay is a set of content changes laid over a version, engine:numbers-read-from-content), starts from the scenario and the seeds (the first segment) or from a base state (each later one), and lists the commands accepted under it, each with its tick and its sender. `replay` runs the segments in order, each under the content it names (server:save-is-list-of-segments). When a character is loaded under newer content, the server replays its last segment under that segment's content, carries the state forward with `upgradeState(state, from, to)`, checks the invariants and the content, and opens a new segment with that state as its base, in one transaction (server:newer-content-upgrades-state).

`upgradeState` is pure: it renames ids through the content's rename table, builds any slice the state lacks with that kind's `initial` (decision 0001), fills any field a slice lacks with its starting value, and raises the state's `schema` where its shape changed (server:upgrade-state-is-pure). A flat save (schema 1 or 2) loads as one segment that starts from its scenario.

## Consequences

- Determinism holds across content versions: the same segments give the same final hash.
- Offline, a save is one segment; online it grows a segment at each content version a character lives through.
- Changing what a replay computes means a new content version, with the version it replaces kept among the older bundles the server can replay (`../rules/server.md`, `../../.claude/skills/japacity-shipped-lives/SKILL.md`).
- A renamed id needs a row in the rename table, never an edit to stored saves.
