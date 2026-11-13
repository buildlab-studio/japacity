# The ready lives

A ready life skips the years before and starts at work. There are five: a graduate fresh from the service year, a banker, a developer, a nurse and a teacher. Each comes with money, a job or the lack of one, and a month's living to meet. They are quick starts for a player who has played before, and the fixed lives that the tests and the recorded lives are built on. The front door never offers them: they sit behind Settings, as "Start from a ready life".

<div style="display:flex;gap:12px;flex-wrap:wrap">
  <img src="/pictures/nurse-01-ready-lives.webp" alt="A ready life: Skip the years before. Start at work. The graduate, the banker, the developer, the nurse and the teacher, each with a line and Pick" width="240">
  <img src="/pictures/nurse-02-your-page.webp" alt="Where you live for a ready life: the nurse at 27 in the strip, the family house it starts in, and Begin" width="240">
</div>

## How a player reaches one

```mermaid
flowchart LR
  S["Settings on the phone"] -->|"Start from a ready life"| D["The front door opens on the ready lives"]
  D -->|Pick| P["Where you live"]
  P -->|Begin| W["The world, at work"]
  P -->|"Look and name"| L["Who are you?"]
  L -->|Next| D
```

1. Settings asks the next front door to open on the ready lives, once.
2. The door shows their list in place of the archetype tiles. The look and the name are one screen back.
3. Pick a kind. Where you live opens with that path and the life's own age in its strip, and the home the life starts in.
4. Begin goes straight to the world. There are no years before, so no page fills after it.

::: info A person, not a named character
The ready lives are kept in content as fixed scenarios with no name and no sex of their own. The door shows only their kind ("The nurse") and a line. The player still builds the person: the look and the name are the player's own, and a line says no he or she, since the look carries that.
:::

## The five lives

| Kind | Starts | Work | Money at the start | A month's living (paid as it is lived) | Sent home each month |
|---|---|---|---|---|---|
| The graduate | 23 | None yet, fresh from the service year, a good degree | ₦355,000 in the bank, ₦25,000 cash | ₦95,000 | None |
| The banker | 28 | A bank officer four years in, a lower grade, a plot of land, a passport | ₦4,200,000 in the bank, ₦60,000 cash | ₦140,000 | None |
| The developer | 25 | A junior developer eighteen months in | ₦900,000 in the bank, ₦40,000 cash | ₦130,000 | ₦60,000 |
| The nurse | 27 | A staff nurse thirty months in, with a licence and a passport | ₦650,000 in the bank, ₦30,000 cash | ₦120,000 | ₦40,000 |
| The teacher | 26 | A maths teacher four years in, who codes after marking | ₦350,000 in the bank, ₦20,000 cash | ₦80,000 | ₦25,000 |

Living at home is paid by hand, in meals, water, fares and data, and never charged as the month turns (home:living-by-hand). Only the money sent home is charged.

Each life tests something different:

- **The graduate** has everything still to build, and the family can carry part of the weight.
- **The banker** has money and a job on day one, and a harder file.
- **The developer** is closest to the pay that makes the funds easy, and furthest from any help.
- **The nurse** is the life the health care route is built for.
- **The teacher** codes after marking on a small salary: a way into tech from the classroom.

::: details Where a ready life is not offered
"Start from a ready life" shows only where a life may be started over, which is the local authority on the device. Online, the server holds the life and the client cannot start one over by itself, so the entry is not shown.
:::

::: details What the tests use them for
Every rule test starts from a scenario and plays commands through the engine, and the recorded lives (the goldens) replay these starts month by month. That is why the fixed lives stay in content even though the door builds a person: they are the game's fixtures.
:::

## Rules it rests on

- [Starting lives](../../rules/scenario.md): scenario:state-built-from-scenario, scenario:new-state-starts-clean and scenario:first-turn-always-endable, and the table of the lives.
- [The prologue](../../rules/prologue.md): prologue:fixed-life-skips-prologue (a fixed life has the prologue closed), prologue:front-door-builds-a-person (the door builds a person), prologue:front-door-three-screens (the ready lives behind Settings, and Where you live).
- [Home](../../rules/home.md): home:starting-charges-from-one-function (a fixed life's starting charges).
