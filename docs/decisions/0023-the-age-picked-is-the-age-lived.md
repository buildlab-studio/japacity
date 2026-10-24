# 0023. The age picked is the age the life starts at

Status: Accepted

## Context

The front door, the screens that start a life, offers the age as a choice, and age is strategy: points tables fall past the late twenties and some routes close for older applicants. The prologue's draws (a strike, a retake) change how long a path takes. If those draws moved the age, a hidden year could cost what the age was picked for, and the page would print a number the player did not choose.

## Decision

The age the player picks is the age the life starts at, to the year (prologue:age-advances-with-steps, prologue:closing-opens-home-charges). When the prologue closes, `quality.age-months` is the picked years times twelve plus the months into the year the path had reached. The draws change what was done in those years, never the age: the months worked after the path's end are the picked age less the age the path ended at, so a strike or a retake means fewer months of work and less saved, shown as a setback chip on the printed page that hands the life over (prologue:printed-page-hands-over). A draw that would leave no months of work does not fire. An archetype's lowest age is the age its path ends at with no setback, inside the door's span of 18 to 29.

## Consequences

- The page prints an age the simulation holds.
- A setback costs work and savings, as a delayed graduation does, never years of age.
- A fixed life has no prologue, so none of this touches it (prologue:fixed-life-skips-prologue), and every route's age limit reads the age the life holds.
