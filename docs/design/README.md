# How we write design docs

Conventions for our own game's design pages.

## Why this shape

The single giant design document has fallen out of favour. Practitioners recommend short, modular, living pages: one system per page, numbers kept in data tables, diagrams next to the text. Markdown with Mermaid diagrams lives in the repo, renders on GitHub, and is easy for coding agents to read. Evidence for these claims is practitioner writing, not survey data.

## The pages

| Page | What it holds |
|---|---|
| [01](01-concept.md) | The concept: what the game is |
| [02](02-quality-and-testing.md) | Quality and testing |
| [03](03-structure-and-conventions.md) | Structure and conventions |
| [04](04-where-things-live.md) | Where things live: client, server, database |
| [05](05-audio.md) | Audio |
| [06](06-assets-and-visuals.md) | Assets and visuals |
| [07](07-the-world-first.md) | The world first |
| [08](08-the-lived-month.md) | The lived month |
| [09](09-the-lively-layer.md) | The lively layer |
| [10](10-london-on-the-lagos-mold.md) | London on the Lagos mold |
| [11](11-the-three-countries-on-the-mold.md) | Calgary, Dubai and Castel Volturno on the mold |

## Conventions

1. **One system per page**, with the same sections in the same order.
2. **Header on every page**: a status line saying what the game carries.
3. **Numbers live in data.** Pages describe rules and link to tables. Generated pages say so at the top and are never edited by hand.
4. **Stable namespaced ids** for every content row (`action.sit-english-test`, `place.visa-centre`). Docs and code reference ids, never display names.
5. **Every money flow is written as a value chain**: `Work shift (energy, time) -> cash`, and each source or sink is tagged constant, linear, or exponential.
6. **Confidence is stated.** "Confirmed" means tested or read from data. "Inferred" means it fits but was not verified.

## Tools

| Tool | Use it for | Adoption |
|---|---|---|
| Markdown plus Mermaid in the repo | All design pages | Standard in software. Thin evidence for game teams specifically |
| Spreadsheet or CSV as source of truth | Content tables | High. Studios publish pipelines that validate sheet exports on import |
| TypeScript types or JSON Schema | Validating content rows in CI | Standard practice for data-driven games |
| Economy simulation tools | Balancing | Niche for indies. A spreadsheet is enough |

## Sources

- [A studio's design lead on the death of the GDD (MCV)](https://www.mcvuk.com/development-news/death-of-the-game-design-document/)
- [Librande, One-Page Designs (Game Developer)](https://www.gamedeveloper.com/design/video-one-page-designs)
- [Brazie, How to make a GDD](https://gamedesignskills.com/game-design/make-game-design-document/)
- [Cook, Value chains (Lost Garden)](https://lostgarden.com/2021/12/12/value-chains/)
- [Pecorella, Math of Idle Games Part II](https://www.gamedeveloper.com/game-platforms/the-math-of-idle-games-part-ii)
- [Böckeler: Understanding spec-driven development (martinfowler.com)](https://www.martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html)
