# 0005. The authority's commands are a closed list

Status: Accepted

## Context

Online, some things a life must learn come from outside it: turns earned, a draw's prize, another player's answer, a guest taken in. One life never reads another's state (person:lives-meet-by-authority-command), and the server must never be able to make money appear in a pocket except by a rule a reader can check (server:apologies-never-currency).

## Decision

Every command carries its sender: `player`, `authority` or `stand-in` (`Sender` in `engine/types.ts`).

- **The authority's commands are data.** `AUTHORITY_COMMANDS` in `engine/step.ts` lists the commands only the authority may send: `turns/grant`, `lottery/pay`, `wallet/top-up`, `home/host`, and what the server knows of other lives (`people/link`, `people/facts`, `people/moments`, `people/proposal`, `people/agreed`, `people/ended`, `people/declined`, `people/withdrawn`, `people/gossip`, `people/stand-in`, `people/family-request`, `interview/open`, `interview/scored`). The step refuses any of them from a player with `not-yours`.
- **Only two of them credit money.** `lottery/pay` pays a draw's prize as the draw's rules give it (decision 0016); `wallet/top-up` credits naira bought with real money, marked (decision 0015). `home/host` raises the host's own upkeep for a guest's months and moves no money between lives (home:hosting-costs-the-host). A test lists every command the simulation accepts from the authority and proves no other one credits a pocket, nor any overlay (`checkOverlay`).
- **Another life arrives as facts in a command.** A state holds `PersonFacts` about another character, never that character's state; the facts travel in the command and are recorded in the receiving save like any command, so each life replays alone (person:lives-meet-by-authority-command, person:both-lives-step-together).
- **A stand-in is a sender of its own.** When the server plays for an absent partner, its commands carry the sender `stand-in`, so the replay and the view can tell them apart; the step accepts from a stand-in only `STAND_IN_COMMANDS` (person:stand-in-acts-narrowly) and judges them as a player's.

## Consequences

- A test, not a reader, proves the authority's reach over money.
- Adding an authority command is a change to the contract and to this list, with its test.
- The server never gives currency as an apology: an outage is made good with turns or a cosmetic item (server:apologies-never-currency).
