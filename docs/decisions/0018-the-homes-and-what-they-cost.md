# 0018. The four homes in Lagos, and what each costs

Status: Accepted

## Context

- A graduate's real start in Lagos is the family house or a place of their own. Play needs the same choice.
- The family house is the start the game is built on: the prologue and Mama's voice are in it. Its money has to read as a family's, not a tenant's.
- A home is also where things are bought and arranged. It has to hold many things and read as a home at a glance on a phone.

## Decision

**Four homes** (home:home-slice-fields)

- `HomePlace` is `place.family-house`, `place.compound-room`, `place.hostel-room` or `place.makoko`.
- A new state starts at the family house. The prologue's last step moves the life to the home picked at the door.

**What the front door offers** (prologue:front-door-three-screens, prologue:makoko-start-never-a-trap)

- The front door is the screens that start a life.
- Every archetype's tile offers the room in a compound, the hostel room and the family house, each with a line saying what it is.
- Makoko is offered only to the child of the water, as that tile's own.
- The self-contain (a Lagos one-room flat with its own bath and kitchen) shows as a locked goal row (`tuning.home.selfContainRentYear`).

**What each costs**

- **The family house.** A meal from Mama's pot, the family's own cooking, is free. The month's living is told as the character's share for the house, with Papa paying the rest. It is lived by hand like every home's (decision 0013).
- **A home of your own** pays for its own food (home:living-by-hand).
- **The room in a compound** is rented the Lagos way: a year up front, with the agent's and the agreement's fees (home:compound-room-is-a-home). It is an obligation marked `prepaid`, whose first charge falls a period after it opens (obligation:prepaid-entries-skip-first-charge).
- **The hostel** is rented by the month with no year's lump sum, which makes it the cheap way out (home:move-home-once-a-month).
- Food bought for the whole house has its own money reason, `foodstuff`, apart from `food`.

**A Lagos landlord keeps no credit file** (home:rent-default-returns-to-family)

- A rent that keeps no credit file defaults under its own key, `rent-lost`. So the words used abroad (a report to a credit file, a shared room) are never said of a Lagos landlord.
- A defaulted rent sends the character back to the family house.

**One wide house** (world:room-seen-down-its-length, decision 0025)

- Every home is one house of walled rooms, seen whole from above, down its length, with the near walls cut low.
- A tap on a room or a pinch eases the camera in on it. At that distance a thing's acts fan out of it.
- The homes turn in quarters and tilt, and keep their quarter beside the save.
- A car bought at a home stands at that home's spot.

## Consequences

- A room seen down its length keeps the people large enough to read. A diagonal view would shrink them to tokens.
- The homes do not furnish themselves, read mood from the room, or send an agent to find a room. The self-contain is a goal, not a move.
