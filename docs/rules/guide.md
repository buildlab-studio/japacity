# Guides, sources and credits

> Rests on `../design/06-assets-and-visuals.md` section 9 rule 1 ("Say so"), `../research/08-real-places-and-map-data.md` sections 2 and 5 (map attribution on a credits screen), `../../LICENSES.md`, the Sources and Numbers tables of every rule page.
> Kind: `guide`. Content only; the simulation never reads it.

The game is built on real rules, simplified. The guides say what the real rules are, how the game changes them and where every number comes from. They are dated general information, never about one person's case.

## Rules: the guides

**guide:guide-entry-fields** A guide is a content entry `guide.<slug>` with:
- a title written the way people search ("How much money you need to show for a UK student visa");
- its body, as text keys;
- the routes and kinds it explains;
- a list of sources, each with a link and the date read;
- `checkedOn`, the date a person last checked it against those sources.

**guide:every-route-has-a-guide** Each route has one guide, "What the route really needs", with three parts: the real requirements in plain words with their sources, what the game simplifies or stylises and why, and the official pages to read next. The content check fails a route with no guide.

**guide:guides-never-advise** A guide never tells a reader what they qualify for, never assesses a case, never recommends an adviser, agent or lender, and never carries an advert (advert:no-adverts-on-protected-screens). Every guide opens with "General information, checked on {date}. Not immigration, legal or financial advice." UK law regulates immigration advice that relates to a particular person (section 82 of the 1999 Act); general, dated information that points to the official source is outside that.

**guide:guides-show-checked-date** Every guide shows its `checkedOn` date at the top. A tool (`tools/check/guides-stale.ts`), given today's date as an argument, lists the guides not checked for `tuning.guide.staleMonths` months. A guide on that list shows "These rules may have changed since" above its body until it is checked again. The content check itself reads no clock.

**guide:guides-are-open-pages** Guides are served as plain pages that need no sign-in, can be read by search engines, and link into the game. People searching for the real rules find the game through them, so they are open pages, not screens behind an account. In the game, the guides are a row in the phone's Settings, under About the game.

**guide:numbers-pages-cite-sources** "Where the numbers come from" is one page for each kind with numbers, built from that rule page's Numbers and Sources tables: each number with its source and date, or marked as a working value. On a player page a working value is called an estimate; "working value" is the rule pages' term.

## Rules: the sources page

**guide:one-sources-page** One sources page lists every source cited in the game, its guides and its rule pages, grouped by subject, each with its link and the date read. The journalism the real-story cards draw on (road:real-story-card-after-chain) is credited and linked here as well as on the card; nothing from it is reproduced. The page is "Every source" in the How it plays half of the documentation site (`docs/site/plays/sources.md`). A data loader beside it (`sources.data.ts`) generates it at every build of the site, so it never goes stale. It lists every guide's sources grouped by guide, every rule page's sources grouped by page, and the real-story journalism with the links content carries. The list is built by `sourcesList` in content (`packages/content/src/guide/guide.sources.ts`), which reads the rule pages with the same reader the numbers pages use. The game's site serves no sources page; each guide page keeps its own sources (guide:guide-entry-fields).

## Rules: credits

**guide:credits-screen-in-game** The credits are the Credits screen in the game, reached from the phone's Settings and, on the road, from the Look around menu (city:credits-screen-attributions). They have no public page of their own. The screen carries every third-party asset from the assets register with its source, author and licence; the fonts with their licences; the map data attribution of guide:credits-carry-map-line; and the licence statement of guide:credits-state-licences. The makers and the shipped code's licences are recorded in the repository:
- `LICENSE` names the makers;
- `LICENSES.md` gives the licence of each part;
- `NOTICES.md` lists every package the client ships, with its version and licence. `pnpm notices` (`tools/notices.ts`) writes it, and a test fails when the client's dependencies and the file disagree.

The guide pages link no credits page. Besides `NOTICES.md`, the shipped page carries `licenses.txt` beside it, with every bundled library's licence text.

**guide:credits-carry-map-line** Where the city uses OpenStreetMap or Overture data, the Credits screen carries the map data line of city:credits-screen-attributions, which the OpenStreetMap guidelines accept for a game's credits screen, plus each Overture source's own "Data from" line as the Overture attribution page lists them. With no map data used, the screen has no map line. The same attribution also appears small, in a corner, on the first screen of the city, as an extra that costs nothing.

**guide:credits-state-licences** The credits state the licences of the game itself and that the name and logo are reserved, as `../../LICENSES.md` does. The Credits screen says: "Code: MIT. Docs: CC BY 4.0. Game content and art: CC BY-SA 4.0. The name Japacity and its logo are reserved." The Credits screen links the licence file that the player build writes beside the page (`licenses.txt`, engine:first-download-has-budget: "The full list: every package the game ships, with its licence."). The terms' Licences section says that the Credits give the licences in short and link the full list. The repository's address is one constant, `REPOSITORY_URL` in `packages/content/src/legal/legal.repository.ts`, with `LICENCES_URL` and `REGISTER_URL` built from it; it is written out nowhere else in the game's code. The game's screens link the licence file, not the repository. The generated-media line names the faces, the painted map and the picture tiles, as well as the models, the mark and the share previews.

## Rules: where generated media is used

**guide:generated-media-named-plainly** One page, "How this game was made", says plainly where generated media is used: which images, clips, voices and music were made with generation tools, which were made by people, and that a person approved every one (`../design/06-assets-and-visuals.md` section 9). It says what was made and by whom, never how it is made: the models, the faces, the painted map, the tiles, the mark and the share previews are drawn as code by the game's makers. It lists them by kind, not file by file. The assets register (`models/register.json`) holds the detail and stays in the repository; its address is `REGISTER_URL`, built from the repository constant (guide:credits-state-licences). The page links nothing in the repository, and no credits page, since there is none (guide:credits-screen-in-game). Its voices line agrees with the register: the visa officer's voice is generated with Phonon S 31M, in two voices, and every line is also shown as text.

**guide:register-records-generated-assets** The assets register records, for every asset, whether it was generated, with which tool, and who approved it. The content check fails an asset used in the game with no register entry.

## Rules: the first session

The first session has no page of its own, so its rules are here. The first few turns decide most of how many players come back (see Numbers).

**guide:early-win-in-three-turns** The first three turns are built around an early win. In every starting life (`scenario.md`, and each path through the prologue), playing the first three `turn/end` after the prologue as the view's next step suggests meets no dead end and gives at least one report line of tone `good` that follows from the player's own choice. That line can be:
- pay from a job or a gig (the activity's line or the ledger's salary line);
- a job found by a hunt;
- the lead offered after a missed hunt (activity:missed-hunt-opens-a-lead);
- a chapter item or a goal met;
- a route heard of, or read on the official page.

The first such line is the early win. No dead end means each of the three months leaves the life something to do next: a job held, an offer open to answer, or an act its next step suggests. A scenario test plays every starting life this way and fails a life with a dead end or no early win by the third turn; the lead counts when it opens, taken or not. Nothing is fudged: every hunt draws at its own chance (activity:job-hunt-lands-offer), and a hunt that misses in the first three months opens the lead, so a life that hunts then sees a `good` line whether its draw succeeds or not.

**guide:nothing-asked-before-early-win** Nothing is asked of the player before the early win: no sign-in method, no email, no notification permission (clock:full-bank-push-notification), no invite and no share. The age screen (account:age-screen-refuses-minors) and the bot check (account:bot-check-on-guest-creation) come first, because the law and abuse control need them; they are not asks. The first ask, to secure the account with a sign-in method, comes after the early win. A browser test plays a new account to its early win and finds no ask on any screen before it. The world shell mounts the notification ask (`NotifyAsk`), so it is asked once, after the early win.

**guide:first-meetup-hears-fitting-route** At a life's first meetup, the character is sure to hear of the route that fits the life: `route.uk-care` when `quality.care` is 30 or more, `route.uk-talent` when `quality.tech` is 40 or more, else `route.uk-masters`; and the first ask-around at the motor park is sure to hear of `route.gulf-contract`. The usual chances apply from the second time on. So the nudge "Someone at the meetup knows a way" comes true the first time it is followed.

## Entries: the guides

One guide for each route, except that the two UK family routes share one and the two Canadian family routes share another, plus four general guides: thirteen guides for eleven routes. Titles are working values.

| Id | Title |
|---|---|
| `guide.uk-masters` | What a UK student visa really needs: funds, the 28 days and the interview |
| `guide.uk-care` | The UK health and care worker route: sponsors, fees and the traps |
| `guide.uk-skilled` | The UK skilled worker route: the salary line and the sponsor |
| `guide.canada-points` | How Canada's points draw works, and why the cut-off moves |
| `guide.global-talent` | Global talent visas: what endorsement means |
| `guide.gulf-work` | Work in the Gulf: contracts, agents and the passport rule |
| `guide.road` | The road north: what people who came back say, and where to get help |
| `guide.proof-of-funds` | Proof of funds: why borrowed money in your account gets visas refused |
| `guide.rates` | The official rate and the street rate: why they differ |
| `guide.agents` | How to tell a real agent from a fraud |
| `guide.numbers` | Where the game's numbers come from |
| `guide.uk-family` | Joining a partner in the UK, or going with them: the income floor, the fee, the interview |
| `guide.canada-family` | Sponsoring a spouse to Canada, or going with a worker or student: the undertaking and the points |

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| Months before a guide is marked possibly out of date | 6 | Working value | `tuning.guide.staleMonths` |
| Turns by which the early win comes | 3 | Working value; the benchmarks below | the scenario test of guide:early-win-in-three-turns |
| Players kept, mobile simulation games | 30.1% on day 1, 8.7% on day 7, 3.0% on day 30 | Segwise, from Mistplay's benchmarks | the reason for guide:early-win-in-three-turns |

## Sources

All read 8 Oct 2026.

- [Immigration and Asylum Act 1999, section 82: "immigration advice" relates to a particular individual](https://www.legislation.gov.uk/ukpga/1999/33/section/82)
- [OpenStreetMap Foundation: attribution guidelines (credits page acceptable for games; adopted 25 Jun 2021)](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- [Overture Maps: attribution and licences by theme](https://docs.overturemaps.org/attribution/)
- [EU AI Act, Regulation 2024/1689, article 50 (transparency for generated content)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)
- [Segwise: mobile game retention benchmarks by genre (simulation: 30.10% day 1, 8.71% day 7, 2.96% day 30, from Mistplay)](https://segwise.ai/blog/mobile-gaming-app-user-retention-strategies.md)

## Not verified

- How the EU's July 2026 guidelines on article 50 treat game clips of places and objects with no people (`../design/06-assets-and-visuals.md` section 9).
- The retention figures are for mobile games, from one industry source. A browser game may differ.

## Contract

- **Kind** `guide` in `KindName`; entries `GuideEntry { id: Id<"guide">; routes: Id<"route">[]; kinds: KindName[]; sources: { url: string; title: string; readOn: string }[]; checkedOn: string; sections: string[] }` in `content.guide`, with text keys `<id>.title`, `<id>.section.<n>`.
- **Content check**: every route has a guide (guide:every-route-has-a-guide); every guide has at least one source with a date; every asset used has a register entry with `generated: boolean`, `tool: string | null`, `approvedBy: string` (guide:register-records-generated-assets).
- **Tuning**: `tuning.guide = { staleMonths: number }`.
- **Tool**: `tools/check/guides-stale.ts --today YYYY-MM-DD`.
- **Client**: prerendered guide pages, the numbers pages and the "How this game was made" page; the Credits screen in the game (city:credits-screen-attributions).
- **Documentation site**: the sources page, `docs/site/plays/sources.md`, with its data loader `sources.data.ts` (guide:one-sources-page).
- **Repository**: `LICENSE`, `LICENSES.md` and `NOTICES.md`, the last written by `pnpm notices` (guide:credits-screen-in-game).
- **Early win**: `isEarlyWin`, `earlyWinIn` and `picksOf` in `packages/sim/src/guide/guide.earlyWin.ts`: the one definition of guide:early-win-in-three-turns, read by the client's ask gate, the nightly count (analytics:day-one-and-seven-return) and the scenario test. Pay, a job found, the lead after a first miss, and a chapter or goal met count whatever the picks. A route heard or read counts unless the lines follow a month whose only picks are rest (the route then came from the news, not a choice). So it counts after a month with another pick, after a now-act, after any other command (the command is the choice itself; `picksOf` gives null), and wherever the picks are not known (the prologue's preset, the authority's own lines). The client reads the month's slots or the now-act it sent, and the view's last slots when it first loads; the nightly count reads each logged command.
- **First session**: a scenario test helper that plays the first three turns of a starting life from the view's next step (guide:early-win-in-three-turns); the view's next step must exist for every starting life; the client holds back every ask until the view has shown the early win (guide:nothing-asked-before-early-win).
