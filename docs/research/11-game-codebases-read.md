# How open-source game codebases are structured

Sources read in early October 2026, at the repositories' main branches.

Backs `../design/03-structure-and-conventions.md` (sections 2 to 9 and 11). Fourteen projects were read at source: two frameworks, [boardgame.io](https://github.com/boardgameio/boardgame.io) and [Colyseus](https://github.com/colyseus/colyseus), and twelve open-source game projects, from a 370-star incremental game to an 18,800-star chess server: an idle hacking game, a browser strategy game, a battle simulator, a habit-tracking role-playing game, a space station role-play game, a turn-based empire strategy game, a survival roguelike, a historical real-time strategy game, an incremental game, a chess server, a browser online role-playing game and a factory-building game.

## 1. What the codebases do

| Pattern | How many of 14 |
|---|---|
| Content kept as data, separate from logic | 11 |
| One data file or folder per kind of content | 9 |
| A shared or pure core used by client and server | 8 |
| A registry keyed by kind and id | 8 |
| Behaviour written inside the data entries | 7 |
| Data kept pure, with logic in the engine | 4 |
| Tests in a separate tree | 7 |
| Tests beside the code | 4 |
| Tests that validate every content table | 6 |
| Seeded randomness with replay | 4 |
| The same fixed set of files for every kind | 0 |

## 2. What that reading showed

- Kinds, ids, a registry and files grouped by kind are standard practice. A fixed file set per kind is not: projects keep all entries of a kind in one data file and add other files only where needed.
- Every project that has scope or duration for its entries sets it per entry.
- Behaviour inside data has a cost: one project's entries cannot be saved as plain data, and two that invented scripting inside data maintain formal deprecation processes. Two warn about entries that inherit from other entries.
- A strategy game keeps one record per alliance, shared by both sides.
- A turn-based game framework and a strategy game keep commands apart from events, with a state version. The same framework and a multiplayer framework give each player a view.
- A large data-driven game and a roguelike with 13,000 stars use dotted ids; the roguelike keeps a table of renamed ids.
- One strategy game had to split its engine into packages after 14 imports had leaked across its intended boundary.
- Three of the projects use pnpm workspaces.

## Sources

- [boardgame.io: the authoritative master](https://github.com/boardgameio/boardgame.io/blob/main/src/master/master.ts)
- [boardgame.io: secret state](https://github.com/boardgameio/boardgame.io/blob/main/docs/documentation/secret-state.md)
- [Colyseus: client prediction](https://github.com/colyseus/colyseus/blob/master/PREDICTION.md)
- [TypeScript handbook: narrowing and exhaustive checks](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Redux style guide](https://redux.js.org/style-guide/)
- [Sandi Metz: the wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)

## Not verified

- Star counts are the rounded figures shown on each repository page.
- Regrets were taken from documents and comments inside the repositories; issue threads were not read.
