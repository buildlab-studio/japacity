# 0005. The authority's commands are a closed list

Status: Accepted

## Context

- The authority is whoever runs the simulation for a life: the server online, or the in-browser authority offline.
- Online, a life must learn some things from outside it: turns earned, a draw's prize, another player's answer, a guest taken in.
- One life never reads another's state (person:lives-meet-by-authority-command).
- The server must never be able to put money in a pocket except by a rule a reader can check (server:apologies-never-currency).

## Decision

Every command carries its sender: `player`, `authority` or `stand-in` (`Sender` in `engine/types.ts`).

**The authority's commands are a list in code**

- `AUTHORITY_COMMANDS` in `engine/step.ts` lists the commands only the authority may send:
  - `turns/grant`, `lottery/pay`, `wallet/top-up`, `home/host`;
  - what the server knows of other lives: `people/link`, `people/facts`, `people/moments`, `people/proposal`, `people/agreed`, `people/ended`, `people/declined`, `people/withdrawn`, `people/gossip`, `people/stand-in`, `people/family-request`, `interview/open`, `interview/scored`.
- The step refuses any of them from any other sender with `not-yours`.

**Only two of them add money**

- `lottery/pay` pays a draw's prize as the draw's rules give it (decision 0016).
- `wallet/top-up` adds naira bought with real money, marked (decision 0015).
- `home/host` raises the host's own upkeep for a guest's months and moves no money between lives (home:hosting-costs-the-host).
- A test lists every command the simulation accepts from the authority and proves no other one adds money to a pocket, and that no overlay does either (`checkOverlay`).

**Another life arrives as facts in a command** (person:lives-meet-by-authority-command, person:both-lives-step-together)

- A state holds `PersonFacts` about another character, never that character's state.
- The facts travel in the command and are recorded in the receiving save like any command, so each life replays alone.

**A stand-in is a sender of its own** (person:stand-in-acts-narrowly)

- When the server plays for an absent partner, its commands carry the sender `stand-in`, so the replay and the view can tell them apart.
- The step accepts from a stand-in only `STAND_IN_COMMANDS`: `interview/answer` and `people/answer`.
- It judges them as it judges a player's.

## Consequences

- A test, not a reader, proves what the authority can do with money.
- Adding an authority command is a change to the contract and to this list, with its test.
- The server never gives currency as an apology: an outage is made good with turns or a cosmetic item (server:apologies-never-currency).
