# 0036. A missed first job hunt opens a lead, never a promised job

Status: Accepted

## Context

**The old rule.** A starting life's first job hunt in its first three months always gave a job.

- When the draw missed, the simulation gave the lowest-paid job that covered the month in place of the one named.
- The view's hunt option carried `sure`, so the board could read that job "As good as certain".

**Two problems followed.**

- The screen made a promise the draw did not keep. A nurse who hunted the wards was handed a call centre's job, and the board had told them the call centre was certain, not the wards.
- A life that already held a job and hunted a better one could be moved to a worse one, leaving its trade's ladder.

**The aim.** Games of this kind help a new player through the story and keep the odds on screen true. A miss is part of the life; what matters is that it leads somewhere.

## Decision

**Every hunt draws at its own chance.**

- Nothing gives a job but the draw.
- Every job reads its own chance word.
- Only a job at the hire cap reads "As good as certain".

**The view's hunt option has no `sure`.** `ActivityOption` loses the field. The client reads each job's chance from the content, as it does for any act.

**A starting life's first miss opens a lead, once a life** (activity:missed-hunt-opens-a-lead).

- A person in the life offers the lowest-paid job that covers the month.
- When that job was the one missed, they put in a word for the same job instead.
- The lead is an offer like the job offer: taken, declined, or let lapse.
- Its line is the early win, taken or not.

**The activity slice keeps an optional mark, `lead`,** once a lead is given.

- Missing means none given, so a life from an older content version needs no upgrade step.
- The event `activity/lead-given` records it.

**The early win asks for no dead end** (guide:early-win-in-three-turns): each of the first three months leaves the life a job, an offer to answer, or a next act.

## Consequences

- The client keeps no copy of the simulation's hunt logic, so nothing has to match in two places.
- A life can be without a job after its third month when it declines or lets the lead lapse. It pays its upkeep from savings meanwhile.
- The nightly job counts `first/lead` by what came of it, so a lead that seldom becomes a job shows.
- A trade whose lives held a job and hunted a better one keeps its ladder, so some trades fly sooner than before. The balance test's targets still hold.
