# News

> Five stories on a seeded schedule, the smallest set that lets the world move. The director (`director.md`) fires stories from the state of the world.
> Kind: `news`. Scope: world, with a small record for each character of what they have been shown. Background: `../design/01-concept.md` sections 7 and 8.

## Rules

**news:stages-move-forward-only** Within one pass a story moves through its stages in order and never backwards: rumour, announced, in force, ended. A story with no rumour lead starts at announced. A story of the pool may fire again once its last pass has ended (director:stories-start-by-roll), and an era's story returns with its era: each is a new pass, which begins at rumour or announced on a later tick.

**news:force-waits-after-announcement** A story comes into force no sooner than two ticks after it is announced. Content with a shorter gap fails the content check.

**news:story-fate-drawn-from-seed** Whether a story happens at all, and on which tick it is announced, is drawn once from the world seed. A story that follows another happens only if that one reached the named stage.

**news:changed-stages-delivered-once** In the `news` phase, each story whose stage in the world, or the tick that stage began, differs from what this character was last shown is delivered once: a report line, and the record updated with the stage and its tick. A character who has been away is shown only the latest stage of the latest pass.

**news:for-you-when-touching-route** A story is marked "for you" when it touches a route the character has heard of or knows, judged after the story's own hearing (news:announcement-makes-routes-heard) has run, so the story that tells you of a route is for you.

**news:announcement-makes-routes-heard** Delivering a story at the announced stage or later makes the character hear of each route in its `hear` list, under the same conditions as any other hearing.

## Stories

| Id | Happens | Announced | Rumour first | In force after | Ends | While in force |
|---|---|---|---|---|---|---|
| `news.uk-unis-recruit` | Always | Tick 1 to 3 | No | 2 ticks | Never | Nothing changes. Hearing it tells you of the UK master's route |
| `news.uk-living-rise` | Always | Tick 4 to 14 | 2 ticks | 4 ticks | Never | Living line 120300 |
| `news.uk-refusals-up` | 30% a tick while the study surge is over 40 and strictness is 80 or under, 18 ticks apart (director.md) | Tick 8 to 30 | 3 ticks | 2 ticks | 6 ticks | Strictness +10, study surge -30 |
| `news.dollar-scarcity` | 1.5% a tick while the supply is 80 or more (director.md) | Tick 6 to 26 | 2 ticks | 2 ticks | When the float comes into force | Supply 40, bank queue 2, bank allowance 20000 |
| `news.naira-float` | Only after the scarcity is in force | 3 to 6 ticks after that | 1 tick | 2 ticks | Never | Supply 90, bank queue 0, bank allowance 50000. The official rate jumps: rate:float-jumps-official-rate |

All five touch the UK master's route.

## Words

Each story has a headline and one line of body for each stage it passes through. Keys: `<id>.<stage>.head` and `<id>.<stage>.body`.

| Story and stage | Headline | Body |
|---|---|---|
| uk-unis-recruit, announced | UK universities come to Lagos | Three universities took a hall in Ikeja this weekend. One-year master's, offers in weeks. The queue went round the building. |
| uk-unis-recruit, in force | "My cousin got her offer in nine days" | Everybody suddenly knows somebody doing a master's in the UK. |
| uk-living-rise, rumour | Talk of a higher bar for student funds | A consultant on the radio says London wants students to show more money. Nothing official. |
| uk-living-rise, announced | UK to raise the money students must show | The living amount goes from £1,171 to £1,203 a month when the change takes effect. Applications sent before the date use the old figure. |
| uk-living-rise, in force | New funds figure now applies | Students now show £1,203 a month, for nine months. |
| uk-refusals-up, rumour | "They refused the whole batch" | A WhatsApp voice note is going round about a week of refusals at the visa centre. Nobody can name the person. |
| uk-refusals-up, announced | UK tells officers to look harder at student files | Interviews will be longer and bank statements checked more closely. |
| uk-refusals-up, in force | Refusals climb | One in three, an agent says. The official figure is lower. It is still higher than last year. |
| dollar-scarcity, rumour | Banks go quiet on dollars | Two people in your office were told to "check back next week" for their allowance. |
| dollar-scarcity, announced | Banks ration foreign currency | Personal allowances are cut from $500 a month to $200. School fees will be "processed in order of receipt". |
| dollar-scarcity, in force | The queue is now two months | The aboki has dollars today. At his price. |
| dollar-scarcity, ended | The rationing is over | Banks are selling again. |
| naira-float, rumour | "They will float it" | Everybody on the bus has a theory and a date. |
| naira-float, announced | Central bank to let the naira find its level | The official rate will move to meet the market within days. |
| naira-float, in force | The naira is floated | The bank rate jumped overnight. Naira savings buy fewer pounds this morning than last night. Dollars in the bank just got heavier. |
