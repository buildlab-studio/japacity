# 0020. People across two lives

Status: Accepted

## Context

A life has slots for people (a partner, siblings) that a friend's life or a computer character fills, and both must run on the same rules offline and online. Two lives must affect each other (a joint application, a sponsorship, a proposal, a shared family) while each replays alone from its own commands, and the simulation stays pure.

## Decision

- **Two kinds with slices.** `people` holds the slots, the bonds, the joint application, the sponsorship, the help taken and a hidden record of a computer partner's interview answers; `interview` holds the open interview, the last result and the hidden truths (`../rules/person.md`, `../rules/interview.md`, `../rules/undertaking.md`).
- **Facts, never states.** A life holds `PersonFacts` about another character, made by the pure `factsOf` (person:facts-function-is-pure), and learns of the other life only by authority commands recorded in its own save (person:lives-meet-by-authority-command, decision 0005). A step that reads both lives runs on the server with both rows locked in sorted id order, sending fresh facts first (person:both-lives-step-together). The other life's answers to a proposal arrive as `people/agreed`, `people/declined` and `people/withdrawn`.
- **The stand-in.** When the server plays for an absent partner, it sends as the stand-in, the sender decision 0005 sets apart, which may only answer (person:stand-in-acts-narrowly).
- **Shared data, no platform feature.** The pair record and the preset phrases are pure data in the simulation package (`PairRecord`, `PairMoment`, `PairInterview`, `PhraseEntry`, `ConversationRow`), read and written by the server and both clients with the same functions (`../rules/pair.md`). `pair` has no slice and is not a kind; `phrase` and `person` are content tables, and `interview` is both a content table (the questions) and a kind with a slice.
- **People gates.** The route gates `partner` and `dependant` (decision 0001) carry their blocks on the route entry and the refusal reasons `relationship`, `sham` and `lead`; `route/withdraw` withdraws an application when a bond ends. Entries carry what people need: who a status lets come as a dependant, a points table's sibling bonus and spouse block, a country's partner bar, a scenario's sibling count, an obligation's bond for the undertaking.
- **A shared family.** A sibling made from an invite takes the inviter's family draw through `Save.family = { from, draw }`, read at `newState`, so both lives share one family (person:real-sibling-shares-family-draw); the draw is copied, never drawn again.
- **Endings say what happened.** A deletion ends every bond with it as an absence end; a player who ends their life to start another ends every bond with it as a `restart`, at no cost to the one who stays, the moments kept (person:leaving-player-ends-bonds).

## Consequences

- Determinism holds: the facts are in the command, not read from elsewhere, and the server's job is to move commands between two saves inside one transaction.
- The trail shows when the server played for someone.
- The view shows who each bond is with and when the next proposal may be made (decision 0002), and hides what a life must not see (person:view-shows-people).
