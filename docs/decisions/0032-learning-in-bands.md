# 0032. Tech is learned in bands, and the day's coding class is capped

Status: Accepted

## Context

- A day's coding class cost ₦5,000, gave tech +2, and could be repeated as long as the body allowed (activity:acts-may-repeat-in-month, decision 0012).
- So tech 30 was about ₦75,000 and one month away for any life. Tech 30 is enough for the junior developer's ₦320,000, with no degree asked, and the remote job was 7 to 20 months on.
- In simulated play the developer's jobs became everyone's road out.
- An apprenticeship at Computer Village that ran to tech 60 was a second free road there.
- Real learning costs time or money:
  - free courses take months of discipline, at the cost of data;
  - paid ones cost tens of thousands to millions of naira;
  - employers judge a junior by work shown.
- `../design/13-the-economy.md` section 5 gives the design.

## Decision

**Bands** (quality:skill-bands-slow-gains):

- tech is read in five bands;
- every tech study at home names its gain a month for each band in its entry's `bandGains`;
- the halving at 70 still applies.

**The day's class is capped** (activity:study-days-capped):

- at most three a month, together giving the free path's month;
- refused while a tech study path is held;
- this changes decision 0012's repeat answer for this one act.

**The free path** (activity:free-path-keeps-a-streak): a month-act for the month's data, with a streak of months, not a draw. It finishes a certificate every fifth month.

**The paid paths** (activity:paid-tech-courses, activity:bootcamp-paid-after-a-job):

- a short course;
- a year's diploma, as an obligation;
- a full-time bootcamp that takes the main slot and is paid after a developer job;
- a free internship;
- one tech study at a time.

**Work to show, and a shorter apprenticeship:**

- the junior developer asks a piece of work to show (portfolio 1);
- the apprenticeship stops at tech 30, with +2 a month (streets:apprentice-learns-repair).

## Consequences

- **Replays move.** Every life that studied tech learns more slowly and pays more or waits longer. So every golden and recorded life that uses the day's class moves from the month it first does.
- **The teacher** starts at tech 32 with no portfolio, and does not meet the junior job at once.
- **New state:** the free path's streak and the bootcamp's debt on the activity slice. **New content:** the paths, their band gains and the bootcamp's obligation.
- **The contract carries the paths:**
  - the activity slice holds `study` (the tech study path held and its months) and `bootcampDone` (the month the bootcamp ended, for the hire help's window);
  - an entry names `bandUntil`, the tech its band gains stop at, and `course`, a path's months and its closing effects;
  - the view marks an option `onCourse` while a tech study path is held;
  - the events `activity/streak`, `activity/certificate`, `activity/course-month`, `activity/course-finished`, `activity/bootcamp-done` and `activity/bootcamp-billed` record the streak, the certificate, the course's months and the bootcamp's debt.
- **The developer's road stays the richest,** and a pivot to it falls inside a trade's dearer band (scenario:economy-meets-its-targets, the fifth measure).
- **Abroad,** the study acts keep their flat figures.

## Alternatives

- **Cap the day's class at three a month and nothing more.** It stops the quick climb but leaves no choice between free, paid and full-time learning.
- **Halve tech gains from 50.** It slows the top but leaves tech 30 a month away.
- **A dropout drawn by chance on the free path.** The real dropout is the discipline; a streak the player keeps is the same lesson with nothing left to luck.
