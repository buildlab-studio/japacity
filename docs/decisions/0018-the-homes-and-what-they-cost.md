# 0018. The homes at home, and what each costs

Status: Accepted

## Context

A graduate's real start in Lagos is the family house or a place of their own, and the same choice must exist in play. The family house is the start the game is built on (the two lights, the prologue and Mama's voice), so its economy has to read as a family's, not as a tenant's. A home is also where things are bought and arranged, so it has to hold many things and read as a home at a glance on a phone.

## Decision

- **Four homes.** `HomePlace` is `place.family-house`, `place.compound-room`, `place.hostel-room` or `place.makoko` (home:home-slice-fields). A new life starts at the family house; the door offers the room in a compound, the hostel room and the family house, each with a line of what it is, and shows the self-contain as a locked goal row (`tuning.home.selfContainRentYear`; prologue:front-door-three-screens).
- **What each costs.** At the family house nothing is paid per pot (Mama's pot is the house's), and the monthly upkeep is the character's share for the house with Papa paying the rest. A home of your own pays for its own food. The room in a compound is rented the Lagos way, a year up front with the agent's and the agreement's fees (home:compound-room-is-a-home), through an obligation marked `prepaid`, whose first charge falls a period after it opens (obligation:prepaid-entries-skip-first-charge). The hostel is rented by the month with no year's lump, which makes it the cheap way out (home:move-home-once-a-month). Food bought for the whole house has its own money reason, `foodstuff`, apart from `food`.
- **A Lagos landlord is not a credit file.** A rent that keeps no credit file defaults under its own key, `rent-lost`, so the words abroad (a report to a credit file, a shared room) are never said of a Lagos landlord; a defaulted rent sends the character back to the family house (home:rent-default-returns-to-family).
- **One wide house.** Every home is one house of walled rooms seen whole from above, down its length with the near walls cut low; a tap on a room or a pinch eases the camera in on it, and the fans open at that distance (world:room-seen-down-its-length). The homes turn in quarters and tilt, and keep their quarter beside the save. A car bought at a home stands at that home's spot.

## Consequences

- The home view carries each move with its monthly charge, what it takes now and why it is shut, and the room's rent with the months to the next charge (decision 0002).
- A room seen down its length keeps the people large enough to read; a diagonal view would shrink them to tokens.
- The homes do not furnish themselves, read mood from the room, or send an agent to find a room; the self-contain and the mini flat are goals, not moves.
