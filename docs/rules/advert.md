# Adverts

> Rests on `../research/08-real-places-and-map-data.md` section 3, road:road-earns-nothing and `text.md` ("Money on screen").
> Kind: `advert` (slots are content; campaigns live on the server, never in content).

An advert is a picture a real business pays to put in the world: a billboard on a road, a poster at the airport, a tile on the character's phone, or its own name on a place. A person looks at every advert before anyone sees it. Nothing an advertiser sends goes anywhere by itself. Adverts never change a rule of the game.

## Rules: slots

**advert:adverts-only-in-slots** An advert shows only in a slot, and every slot is a content entry `advert.<slug>` with its `surface` (`billboard`, `poster`, `phone-tile`, `shopfront`), the `place` it stands in, its pixel size and its byte limit. No other part of the game renders advertiser material.

**advert:slots-capped-per-place** A place has at most `tuning.advert.maxSlotsPerPlace` slots, and the phone's app grid shows at most `tuning.advert.maxPhoneTiles` sponsored tile among its tiles. The content check fails a place with more.

**advert:no-adverts-on-protected-screens** No slot renders while the character's place is `road` (road:road-earns-nothing), while a set piece is open, inside a chapter marked `noAdverts` in content, on a share card (`share.md`), in a guide (`guide.md`), on the report and block screens (`moderation.md`), or in the sign-up and age screens. The view carries `adverts: boolean`, false in every one of these cases, and the client renders no slot when it is false.

**advert:one-labelled-still-image** An advert is one still image in the slot's size and byte limit, with the label "Advert" drawn by the game, not by the advertiser, on every slot. No animation, no sound and no video, because each needs its own review and its own budget on a cheap phone.

**advert:tap-opens-advert-card** Tapping an advert opens the game's own advert card: the advertiser's name, one line of text, and at most one `https` link to a domain the review approved. Following the link shows a notice that the player is leaving the game. Nothing opens on its own.

**advert:adverts-never-mimic-the-game** An advert may not look like part of the game: not an offer, a news story, a radio bulletin, a set piece, a message from a player or a character, an official notice, a bank alert, a transfer receipt or a payment app (the same list as `text.md`, "Money on screen").

**advert:adverts-change-no-simulation** An advert changes nothing in the simulation. No command, effect, requirement or reward reads an advert, and tapping one earns nothing. The simulation has no advert state.

**advert:campaign-chosen-without-player-data** Which campaign fills a slot is chosen by the server from the slot, the player's advert region and the hour, never from anything about the player. The same slot shows the same campaign to everyone in a region in the same hour. An advert region is a country's code from the list in the server's config (`advert.regions`: Nigeria, the United States, Canada, the United Kingdom, Australia and the 27 EU states), or `default` for any other country. No per-player targeting, so no profile of a player is ever built for an advertiser. The one thing read about an account is read only to serve it nothing: an account in the deployment's admin list (`config.admin.accounts`, moderation:admin-view-for-admin-list) is served no advert on any surface, its `GET /api/adverts` answered with no slot filled and kept in no cache, the server's or the browser's.

**advert:no-radio-adverts** No radio adverts. The radio carries the news (`news.md`), and paid words read in the news voice would blur paid copy and news; it also needs a native speaker review for every voice (`../design/05-audio.md`).

## Rules: review

**advert:named-person-approves-creatives** Every creative, every line of text and every link is approved by a named person before it can show. Approval is recorded with the reviewer, the time, the checks made and the version of the banned list used. Payment never approves anything.

**advert:changes-return-to-review** Any change to a creative, its text, its link or its slots puts it back in review; the approved version keeps showing until the new one is approved or the campaign ends.

**advert:reviewer-checks-and-records** The reviewer checks, and records: the advertiser is a registered business (its registration number on the register of its country), the category is not banned and meets the conditions of a restricted category, the link resolves to the advertiser's own domain and matches the advert, the advert meets advert:one-labelled-still-image, advert:tap-opens-advert-card and advert:adverts-never-mimic-the-game, and, for a campaign shown in Nigeria, the advertiser's pre-exposure approval from the advertising regulator, which the advertiser obtains.

**advert:submissions-never-auto-post** Nothing an advertiser submits posts automatically anywhere: not in the game, not on the official accounts (`share.md`), not in a guide, a newsletter or a social post. Submissions arrive by a form outside the game or by email and wait in a quarantine store that nothing serves from.

**advert:reported-advert-pulled-at-once** A live advert that draws a report (moderation:report-from-every-surface) or fails a recheck of its link is pulled from rotation at once by the admin view and goes back to review. Links are rechecked before each campaign starts and whenever an advert is reported. The recheck before a start runs on the deployment's tick cron (every five minutes, or its `TICK_CRON` where one is set, thirty minutes on staging: server:production-and-staging) and takes every approved campaign that starts from the firing the run stands for up to the next, the cron's period in whole minutes. A run's clock is rounded to the nearest firing, so the windows of successive firings meet end to start: a run a minute late or early neither rechecks a campaign another run rechecked nor leaves one out. Pulled from rotation means at once for the server, within five minutes for new visitors at a location that holds the server's cached copy (server:public-replies-cached).

## Rules: banned and restricted categories

**advert:banned-categories-refused** An advert in a banned category is refused whatever it pays. The banned list:

| # | Banned | Why, with source |
|---|---|---|
| 1 | Loans of any kind: quick loans, loan apps, payday loans, salary advances, "proof of funds" or "funds placement" | The game shows these as traps (`offer.md`); a real one beside it reads as endorsement. Payday loans are banned outright on a large ad platform |
| 2 | Gambling, betting, lotteries, casinos, sweepstakes, prediction markets | Gambling is restricted on every large ad platform; the game has its own lottery and must not point to a real one |
| 3 | Crypto, forex and trading schemes, investment returns, "doubling", multi-level marketing, get-rich-quick | Listed as restricted or deceptive by the large platforms; the losses in schemes of this kind are a live problem in Nigeria |
| 4 | Visa guarantees, document services, fake or "arranged" papers, overseas jobs that charge the worker | The scam the game teaches players to spot. Restricted category 1 below covers lawful advisers |
| 5 | Alcohol, tobacco, vaping and nicotine | Restricted on every large ad platform; kept out |
| 6 | Medicines, herbal remedies, cures, weight loss, cosmetic procedures, supplements | Health claims the game cannot check; kept out |
| 7 | Dating, companionship and adult content | The game matches characters and is not a dating service (`../design/01-concept.md` section 6, safety rule 2) |
| 8 | Political parties, candidates, campaigns, religious bodies | The game's news shows governments as part of the world; a paid political advert inside it would take a side |
| 9 | Weapons, dangerous goods, counterfeit goods, hacking and surveillance tools | Prohibited on every large ad platform |
| 10 | Other games, game stores and game currencies | No other game's names or goods appear in the world (`AGENTS.md`, Never) |
| 11 | Anything impersonating a person, a brand, a bank or an official body | Misrepresentation is prohibited on the large platforms; advert:adverts-never-mimic-the-game |

**advert:restricted-categories-need-conditions** An advert in a restricted category shows only when its condition is met and recorded at review:

| # | Restricted | Condition |
|---|---|---|
| 1 | Immigration advice and visa services | The adviser is on the official register of immigration advisers where they advise, or is regulated to give that advice there. No promise of a result. Never for proof of funds |
| 2 | Banks, money transfer and remittance | Licensed by the central bank or financial regulator of each region shown in; no loan or credit product in the advert |
| 3 | Universities, schools, English test preparation | A real accredited institution; no recruitment agent that charges students; no promise of a score or a visa |
| 4 | Airlines and travel | No claim about visas or entry |
| 5 | Phones, data and telcos | No prize draw or promo code in the advert (`luck.md`'s telco promo is the scam version) |
| 6 | Local businesses as named places | advert:real-name-only-by-agreement |

## Rules: a real business as a named place

**advert:real-name-only-by-agreement** A private place in the city keeps its made-up name from content unless a real business has signed an agreement for it. Then the server sends the real name and sign with the world as a place overlay, and the public content never holds that sponsored name (`AGENTS.md`, Never: a real business name in content stands only as neutral scenery, city:sponsor-shows-name-only).

**advert:sponsored-place-hosts-no-harm** A place under a real name hosts no bad event: no fraud, no robbery, no illness, no refusal. Its offers, prices and rules are the same as under its made-up name.

**advert:institutions-never-take-real-names** Banks, embassies, visa centres, test centres and government offices never take a real name, paid or not. They keep plain descriptions ("the visa centre"), because the game shows them refusing and charging, and a real brand should not be the villain (`../research/08-real-places-and-map-data.md` section 3).

## Rules: what is stored

**advert:advertiser-records-stored** The server stores: the advertiser (business name, registration number and country, one contact name and email), each campaign (slots, regions, start and end dates), each creative and link with its review records, and impressions and taps as daily counts per slot and campaign. It stores nothing about which player saw or tapped what. Impressions and taps from one account count toward a campaign's daily totals only up to `advert.countsPerAccountDay` per slot in a UTC day; beyond it the batch is accepted and the rest dropped. The counts come from the client, and an advertiser is shown them (advert:advertisers-get-daily-counts-only).

**advert:advertisers-get-daily-counts-only** Advertisers receive only the daily counts of advert:advertiser-records-stored. No player id, region finer than the advert regions of advert:campaign-chosen-without-player-data, or behaviour is ever shared with an advertiser.

**advert:impression-counted-when-seen** An impression is counted when a slot has been on screen for `tuning.advert.impressionMs` with at least half of it visible, at most once per slot per session, and sent with the interface counters (`analytics.md`). An account in the admin list is never counted: its impressions and taps are dropped before any total, the day's counters and the campaign's alike.

## Entries: slots

Working values. The places are the city's (`city.md`); a slot names a place id that page defines, and the phone's tile names `phone` (`packages/content/src/advert/advert.data.ts`).

| Id | Surface | Where | Size (px) | Byte limit |
|---|---|---|---|---|
| `advert.road-billboard` | billboard | Third Mainland Bridge, `place.third-mainland-bridge` | 1024 x 512 | 200 KB |
| `advert.park-billboard` | billboard | Jibowu's coach terminals, `place.jibowu` (the motor park is stylised and holds no slot, city:road-places-are-stylised) | 1024 x 512 | 200 KB |
| `advert.airport-poster` | poster | the airport in Lagos, `place.airport-lagos` | 512 x 768 | 150 KB |
| `advert.arrivals-poster` | poster | Heathrow, where most flights from Lagos land, `place.heathrow` | 512 x 768 | 150 KB |
| `advert.phone-tile` | phone-tile | the phone's app grid, `phone` | 256 x 256 | 50 KB |
| `advert.food-spot` | shopfront | a food spot on Ogba's market street, `place.ogba` | sign 768 x 192 | 100 KB |

## Numbers

| Setting | Value | Source | Held in |
|---|---|---|---|
| Slots per place at most | 2 | working value | `tuning.advert.maxSlotsPerPlace` |
| Sponsored phone tiles at most | 1 | working value | `tuning.advert.maxPhoneTiles` |
| Time on screen for an impression | 1,000 ms, half visible | working value | `tuning.advert.impressionMs` |
| Impressions one account adds to a slot in a day | 200 | working value (advert:advertiser-records-stored) | `advert.countsPerAccountDay.impressions` (server config) |
| Taps one account adds to a slot in a day | 20 | working value (advert:advertiser-records-stored) | `advert.countsPerAccountDay.taps` (server config) |

## Sources

All read 8 Oct 2026.

- [Google Ads policies: prohibited content, prohibited practices, restricted content](https://support.google.com/adspolicy/answer/6008942)
- [Google Ads: other restricted businesses, including government documents and official services](https://support.google.com/adspolicy/answer/6368711)
- [Meta advertising standards: financial and insurance products (payday loans prohibited, 18+ for loans)](https://transparency.meta.com/en-gb/policies/ad-standards/restricted-goods-services/financial-services/)
- [Meta advertising standards: unacceptable business practices](https://transparency.meta.com/policies/ad-standards/fraud-scams/unacceptable-business-practices/)
- [TikTok advertising policies: industry entry](https://ads.tiktok.com/help/article/tiktok-advertising-policies-industry-entry)

## Contract

The simulation and the server hold:

- **Kind** `advert` in `KindName`, with entries `AdvertSlotEntry { id: Id<"advert">; surface: "billboard" | "poster" | "phone-tile" | "shopfront"; place: string; width: number; height: number; maxBytes: number }` in `content.advert`.
- **Chapter entry field** `noAdverts?: boolean` on `ChapterEntry`.
- **Tuning** `tuning.advert = { maxSlotsPerPlace: number; maxPhoneTiles: number; impressionMs: number }`.
- **View field** `adverts: boolean` (advert:no-adverts-on-protected-screens), computed from `place.where`, the open set piece and the current chapter's `noAdverts`.
- **World field** `placeNames: Record<string, { name: string; sign: string }>`, the server's overlay of real names on private places (advert:real-name-only-by-agreement). Empty offline. The simulation never reads it; the client does.
- **Store types** (`packages/store/src/advert.types.ts`): `Advertiser { id; businessName; registration: { country; number }; contactName; contactEmail }`, `Campaign { id; advertiser; slots: Id<"advert">[]; regions: RegionCode[]; starts; ends; status: "pending" | "approved" | "live" | "paused" | "ended" | "refused" }`, `Creative { id; campaign; file; text; link; version; status }`, `AdvertReview { creative; version; reviewer; at; checks: string[]; bannedListVersion; outcome: "approved" | "refused"; note }`, `AdvertCount { day; slot; campaign; region; impressions; taps }`.
- **Server routes**: `GET /api/adverts?region=` (the hour's campaign per slot), admin routes in moderation:admin-view-for-admin-list.
