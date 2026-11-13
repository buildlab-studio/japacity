# 0004. A save is a list of segments of commands

Status: Accepted

## Context

- A state is rebuilt by replaying its commands under the content they were accepted under (engine:state-is-plain-data).
- The server rebuilds any character that way (server:log-rows-hash-state).
- Content changes while characters live.
- A save that names one content version for its whole life would be stranded by the first content change.

## Decision

**The save's shape** (server:save-is-list-of-segments)

- A save is `{ schema, segments }`.
- Each segment names its content version and, if one was applied, its overlay version. An overlay is a set of content changes laid over a version (engine:numbers-read-from-content).
- The first segment starts from the scenario and the seeds. Each later segment starts from a base state.
- Each segment lists the commands accepted under it, each with its tick and its sender.
- `replay` runs the segments in order, each under the content it names.

**Loading under newer content** (server:newer-content-upgrades-state)

When a character is loaded under newer content, the server does this in one transaction:

1. replays the last segment under that segment's content;
2. carries the state forward with `upgradeState(state, from, to)`;
3. checks the invariants and the content;
4. opens a new segment with that state as its base.

**`upgradeState` is pure** (server:upgrade-state-is-pure)

- It renames ids through the content's rename table.
- It builds any slice the state lacks with that kind's `initial` (decision 0001).
- It fills any field a slice lacks with its starting value.
- It raises the state's `schema` where its shape changed.

**Older saves**

- A flat save (schema 1 or 2) loads as one segment that starts from its scenario.

## Consequences

- Determinism holds across content versions: the same segments give the same final hash.
- Offline, a save is one segment. Online, it grows a segment for each content version a character lives through.
- Changing what a replay computes needs a new content version. The version it replaces stays among the older bundles the server can replay (`../rules/server.md`, `../../.claude/skills/japacity-shipped-lives/SKILL.md`).
- A renamed id needs a row in the rename table, never an edit to stored saves.
