# Home: where the character lives in Lagos

> Where the character lives at home: the family house, a room of your own, and a place on the lagoon the player can live in, cheaper than the family house, with the risk that the settlement is cleared. Nothing here moves money between lives (person:money-counted-never-moved).

## Purpose

The game is about saving to leave. A cheaper room makes saving faster and the risk real: some months the settlement is cleared, and the character then needs somewhere to go. Eviction is part of life there, so it is part of the game. Bad news is told straight, never as a joke (`text.md`).

## Rules

**home:home-slice-fields** The `home` slice holds where the character lives at home. (The `things` slice beside it holds what the life owns, home:things-a-life-owns.) Its fields:

| Field | Meaning |
|---|---|
| `place` | One of the four home places: `"place.family-house" \| "place.makoko" \| "place.compound-room" \| "place.hostel-room"`. Null after an eviction and while a guest |
| `since` | The month the character came to live there |
| `guest` | `{ host: "friend" \| "someone" \| null; by: string \| null; until: number } \| null`: the kind of host, who it is, and the month the stay ends |
| `moved` | The month of the last move (home:move-home-once-a-month) |
| `evicted` | The month of the last eviction (home:makoko-eviction-draw) |
| `hosting` | `{ pair; until } \| null`: a real player's character staying with this one (home:hosting-costs-the-host) |

A new character lives at the family house. Abroad, the slice is kept as it was and is not read (the room abroad is in `abroad-money.md`).

**home:move-home-once-a-month** The command `home/move` (`to`) is legal at home only, once a month, and never to the place the character already lives in. A guest (home:taken-in-after-eviction) moves the same way.

- **To Makoko.** Needs `tuning.home.makokoUpkeep` in naira held (paid by its size, decision 0014, obligation:charges-paid-whole-or-missed): the first month's rent, charged on the move. From then the monthly charge is `obligation.upkeep-makoko` at that amount, in place of `obligation.upkeep`, which closes.
- **Back to the family house.** Reopens `obligation.upkeep` at the scenario's charge (as place:family-takes-you-back does on a return) and costs `tuning.home.returnStanding` standing: the family talks.
- **To the hostel room** (`place.hostel-room`, decision 0018). Needs a month's rent held, `tuning.home.hostelRentKobo` (₦15,000, a working figure, about half the compound room's yearly rent counted by the month), and takes it on the move. `obligation.upkeep-hostel` (type `rent`, monthly, grace 2) then charges the coming month at each month's end, in place of `obligation.upkeep`, which closes. There is no yearly lump sum, which is why the hostel is the cheap way out. Its default sends the character home as home:rent-default-returns-to-family. Moving from the hostel to the family house works as from the room.

**home:makoko-eviction-draw** Eviction. Each month lived in Makoko, in the `clocks` phase, there is a draw at `tuning.home.evictionBp` (luck:no-kicking-while-down halves it while the character is down). When it hits, the settlement is cleared:

- `home.place` becomes `null`, with `guest: null`;
- `obligation.upkeep-makoko` closes with nothing owed;
- the character loses the naira cash held, up to `tuning.home.evictionLossNaira` (what went with the room);
- the event `home/evicted` carries a line told straight;
- the month's results lead with it, and News carries a story of it;
- standing does not fall: it was not the character's doing;
- the same month `offer.taken-in` opens (home:taken-in-after-eviction), and no other `bad` offer opens that month.

**home:taken-in-after-eviction** Taken in. `offer.taken-in` has three answers:

- `friend`: a real player this character is joined to, whose facts show a home in Lagos (person:others-known-by-facts). Shut, with its reason, when there is none.
- `someone`: a computer person of the story with a home: the first `person` entry of role `friend` or `sibling` whose `when` holds.
- `family`: back to the family house at its full charge, with home:move-home-once-a-month's standing cost.

`friend` and `someone` make the character a guest for `tuning.home.guestMonths` months, with no upkeep charged. When `until` comes, the guest must choose again: `offer.where-next` opens with `makoko` (home:move-home-once-a-month's move, if the rent is held) and `family`. Left unanswered at the month's end, the offer takes `family`. Being taken in is a kindness, recorded as a moment with that person (person:time-together-is-an-act, where the person is a pair).

**home:hosting-costs-the-host** Hosting costs the host. While a real player's character is a guest, the host's own upkeep charge rises by `tuning.home.hostBp` for those months, told as "{guest} stays with you: upkeep up {amount}". The host's state learns of the guest only by an authority command (`home/host`, person:lives-meet-by-authority-command), and no money moves between the lives (person:money-counted-never-moved). A computer host is not simulated and costs nothing.

**home:home-is-the-home-point** The home is the home point (world:opens-where-last-stopped): the game opens where the character lives.

- **Makoko.** `place.makoko` is a place of the city (`city.md`: district Makoko, on the lagoon beside the bridge) with five scenes (city:makoko-holds-five-scenes). Its room on the water, behind the rented house's door on the channel, is the character's home while they live there:
  - a life that lives there opens on the channel outside its door, and the door opens for that life alone;
  - to anyone else the house is a neighbour's, with no name over it and nothing to tap;
  - a life that stops living there while inside steps back out to the walk.
- **What Makoko stages.** On its smoking deck: the fish trade's ladder (`activity.job-fish-racks`, the kiln's `activity.buy-kiln` and the fish trade's `activity.start-fish-trade`, activity:capital-opens-own-work) and its side job, the canoe deliveries (`activity.canoe-deliveries`, for a life living there). At the net shed: the boat work (activity:boat-work-at-the-net-shed). At the viewing centre: the match (activity:watch-the-match).
- **The room's things.** The mattress, the small pot on three stones, the drum and the papers box carry the same acts as the parlour's, for the home's own entries. obligation:cooking-and-fetching-water's relief applies to whichever upkeep is open.
- **Home acts.** The month lives in the phone's Calendar app (world:top-band-is-a-pill). The bed's Sleep, the papers box, cooking and the water drum stand at home.

**home:view-carries-home** The view carries `home: { place, since, guest, rent: { currency, amount } | null, evictionBp, moved, moves, roomRent }` (`moves` as home:moves-carry-cost-and-reason gives them, `roomRent` as home:compound-room-is-a-home). The phone's home card shows:

- where the character lives;
- the monthly charge;
- the choice to move, shut with its reason when the rent is short or a move was made this month;
- while a guest, who took them in and for how long.

Words come from content. The card states the risk once, plainly: "Some months the settlement is cleared."

**home:moves-carry-cost-and-reason** The home view carries the card's moves.

- **At home**, each home except the one lived in is a move with:
  - `monthly`: what living there charges a month;
  - `now`: what the move takes at once (Makoko's first month's rent; nothing for the family house);
  - `shut`: why `home/move` would refuse it now, `moved` (a move was made this month) or `short` (the first month's rent is not held), or null when it would be taken. The command and the view read the same refusal.
- **Abroad** there are no moves.
- **Monthly figures.** A monthly charge, in `monthly` and in `rent` (home:view-carries-home), is the obligation kind's scheduled charge before any relief. A naira upkeep rises with `var.inflation` (director:december-and-inflation), so the card and the bill under it show the same figure. The phone's card reads the view and keeps no copy of the rule.
- **The hostel** is a move with `monthly` and `now` both the month's rent, shut `short` while that is not held. The home card shows it; the map shows the hostel only as home, while it is lived in.
- **Blurbs.** The home card in Bills opens with the place's blurb (`place.<id>.blurb`, "One room in a compound of ten..."). The first entry into a home in a life shows that blurb once, as a small card the player dismisses, kept beside the save as a place's first names are (world:things-are-tappable-models), and never again.

**home:starting-charges-from-one-function** One function gives a starting life's charges at home: for a fixed life, its starting obligations; for a life from sixteen, which starts owing nothing, what its home card's family-house answer opens (prologue:closing-opens-home-charges, prologue:makoko-start-never-a-trap).

- **The family house** reopens its upkeep from this function on a move back (home:move-home-once-a-month), and on a return from abroad or from the road (place:family-takes-you-back, road:exit-is-assisted-return).
- **Support abroad.** The family's support abroad opens from it at the remit share (place:departure-moves-abroad, abroad-money:arrival-opens-upkeep-and-room). For a life from sixteen this is `obligation.home-support` at `tuning.prologue.homeSupport` (₦40,000 a month before the share, between the fixed lives' ₦25,000 and ₦60,000), because the home card's effects open at home, where no support is sent.
- So a life from sixteen that comes home pays the family house's upkeep that the card names from the next month, as any life does.

**home:compound-room-is-a-home** `place.compound-room` is a home place: one rented room in a shared compound in Ojuelegba (`city.md` has its row as neutral scenery under city:sponsor-shows-name-only). The room is the character's home while they live there, seen down its length as world:room-seen-down-its-length. The bed, the cooking corner, the water drum at the compound's tap, the papers box and the bag by the door carry the home's acts (home:home-is-the-home-point). Meals there are your own: `activity.cook-own` and `activity.cook-own-pot` (home:living-by-hand).

- **Rent, the Lagos way.** A year upfront, `tuning.home.compound.rentYear` (₦350,000, so a life from sixteen with ₦500,000 saved can take the room at the age it starts, prologue:front-door-three-screens; decision 0018), plus the agent's and the agreement's fees at `tuning.home.compound.feesBp` (2,000: a tenth each, the Lagos cap). Both are taken at once as `money/take` with `pocket: "any"` under the reason `rent`.
- **Obligations.** `obligation.rent-compound` (type `rent`, `everyMonths` 12, `prepaid`, obligation:prepaid-entries-skip-first-charge) then charges the year's rent again twelve months on. `obligation.upkeep-compound` (type `upkeep`, `tuning.home.compound.upkeep`, ₦50,000 a month: food, light, the waste and the compound's small charges) replaces `obligation.upkeep`, which closes. It has no water share: the drum is filled free from the yard's tap or well, and the room has no water bill (obligation:cooking-and-fetching-water).
- **Moving in.** Through `home/move`, as for Makoko (home:move-home-once-a-month): at home, once a month, with the rent and fees held, otherwise shut `short`. The home card shows it with its monthly cost, what it takes now and why it is shut (home:moves-carry-cost-and-reason).
- **Moving back** to the family house works as from Makoko: the upkeep reopens, `tuning.home.returnStanding` is paid, the rent obligation closes and the year paid is lost.
- **On a flight** the room is let go: place:departure-moves-abroad closes `rent` with `upkeep` and `support`. The return goes to the family house (place:family-takes-you-back).
- **In the view.** The home view carries the room's rent while it is open: `roomRent: { year, fees, dueIn }` (the year's figure, the fees paid on it at the move, and the months until the next year is taken, 0 at this month's end), or null when none is open.
- **On screen.**
  - The home card says "Rent ₦350,000 a year, next in N months", with the living costs on their own line.
  - Coming up shows the rent from two months ahead.
  - The Month sheet (the Calendar app, home:home-is-the-home-point) says in one line when the money held is short of a rent due this month.
  - The move back says the year paid is lost ("The year's rent stays with the landlord"), and that the family house's charge is living costs, food and light included, not rent.
- **Layout** (decision 0018). The room is one wide house: your room of about 5 by 5 metres with a bathroom, a kitchenette and the compound yard with your spot by the gate, about 9 by 8 metres in all, seen whole as world:room-seen-down-its-length. Its things stand within 4.2 metres of each other. The figure reads above 5% of the screen's height whole, and above 7% eased in.

**home:rent-default-returns-to-family** A defaulted `rent` sends the character back to the family house in the `clocks` phase, as an eviction from Makoko does (home:makoko-eviction-draw): the upkeep reopens, the standing cost is paid, and a line with attention says so.

- The room's rent defaults on the third miss in a row (grace 2, as for a room abroad). Its default closes it (the landlord takes the room back), so a room lived in with no rent open is the room lost.
- The default's own line says the landlord wants the room back, since a Lagos landlord keeps no credit file.
- `obligation.upkeep-hostel` is a rent too. Its default (grace 2) closes it and sends the character home the same way.

**home:living-by-hand** Living by hand (decision 0013). At home, living is lived, not charged: meals are bought and cooked as acts that cost at once (`reason: "food"`), water is fetched, fares are paid at the stop, and data from the phone.

- **No upkeep charged at home.** `tuning.home.livingByHandBp` (10,000: the whole of it) is the share of a naira `upkeep` that `livingCharge` leaves out as the month turns. So `obligation.upkeep`, `obligation.upkeep-compound` and `obligation.upkeep-makoko` charge nothing at home while it stands at the whole. Makoko's room keeps its first month paid on the move, and the child of the water keeps equal or better odds.
- **The scenarios' monthly figures** stay as the measure of a month's living, and the room's acts are priced so that a month of eating and moving costs about that.
- **Abroad,** upkeep is in the country's money and is untouched. The relief of obligation:cooking-and-fetching-water applies to whatever is charged.
- **The family house** (decision 0018). Nobody pays to cook in a house with family. `activity.cook-at-home` is free (Food from the pot: Mama's pot is the house's). `activity.cook-jollof` is A big pot for the house: ₦7,500 under the reason `foodstuff` (food bought for everyone, with Mama's thanks over her head). Anyone visiting the family house may eat from the pot for free; it is a repeat act there, true to life.
- **A home of your own in Lagos** (the compound room, the hostel and Makoko's room). The meal is `activity.cook-own` (₦1,500) or `activity.cook-own-pot` (₦7,500) under `food`, so cooking is never free away from the family.
- **The room abroad** cooks in the country's money: `activity.cook-own-uk` in the UK (streets:london-life-by-hand), `activity.cook-own-canada` (C$8), `activity.cook-own-uae` (AED 8) and `activity.cook-own-italy` (€4) (streets:calgary-life-by-hand, streets:dubai-life-by-hand and streets:castel-volturno-by-hand). `activity.cook-own` is `where: "home"`, so no naira is charged abroad.
- **Where acts are named.** Each corner's acts are named by id in its place file, never by a cost-by-place rule in the simulation.
- **How the family's figure is told.** The family's monthly figure is told as your share for the house, with Papa paying the rest: on the home card, in the move lines and in the bill notice.

**home:things-a-life-owns** What a life owns (`../design/08-the-lived-month.md` section 2, decisions 0018 and 0019).

- **The `things` slice.** `owned`: each thing once, with the month it came and what was paid.
- **The content kind `thing`** (`packages/content/src/thing/`). Each thing has:
  - `price`, `resaleBp` and a `running` cost a month;
  - the `homes` it may stand in: the family house holds the small things in your corner and the car in the carport; a home of your own holds all it lists; Makoko's deck holds the fan, the radio, the router and the phone;
  - `needs` (the decoder needs the TV);
  - `group`: the light and the cool air do not add up; only the dearest owned counts;
  - `bought` lifts, given once, and `monthly` lifts, given at the close;
  - `acts`: what a thing adds to an act, its half-days and its cost share, applied by `withThings` in `actNow`, `resolveSlot` and `activityOptions`. The view shows a changed time as `halfDays`;
  - `eases` (the phone halves the data plan) and `drive` (the car).
- **Buying.** `thing/buy` works at a home in Lagos, when the home allows the thing, its needs are owned and the price is held. It takes the price under the reason `goods`, delivers at once and applies the `bought` lifts.
- **Selling.** `thing/sell` pays the resale share into the bank under `sale`.
- **Each month.** In the `due` phase each thing that works takes its running cost under `running`, then gives its monthly lift. Short of money, it stands idle that month (`things/stood`) and gives nothing.
- **Stored.** A thing owned in a home that cannot hold it is kept but `stored`, and does nothing.
- **The view** carries `things`: `owned` with `stored` and `resale`; `market`, with each thing's price, resale, running cost and why it is `shut` (owned, home, needs, short or away); `drive`; and `running`.
- **Figures.** Every figure is content's; the prices are working figures from 2025 and 2026 Lagos listings.
- **The Market app** (world:phone-rises-over-scene) sells only at home. Elsewhere in Lagos it says the rider brings it to your gate; abroad, that the market is a Lagos thing.

## Entries

| Id | Kind | Notes |
|---|---|---|
| `obligation.upkeep-makoko` | upkeep, NGN, `tuning.home.makokoUpkeep` a month | sink `upkeep`; onMiss as `obligation.upkeep`; obligation:charges-paid-whole-or-missed's short pay applies |
| `offer.taken-in` | offer, opens on `home/evicted` | answers `friend`, `someone`, `family`; expires at the month's end as `family` |
| `offer.where-next` | offer, opens when a guest's `until` comes | answers `makoko`, `family` |
| `place.makoko` | place, home, lagos, district makoko | scope exterior, assets `makoko` (the channel), with its scenes `makoko-room`, `makoko-viewing-centre`, `makoko-net-shed` and `makoko-smoking-deck` behind the channel's doors (city:makoko-holds-five-scenes); stages `activity.job-fish-racks`, `activity.buy-kiln`, `activity.start-fish-trade` and `activity.canoe-deliveries` on the smoking deck, `activity.ask-fisherman`, `activity.take-net-work`, `activity.buy-canoe` and `activity.start-canoe-taxi` at the net shed, and `activity.watch-match` at the viewing centre; the room on the water's things carry the home's own acts while lived in, and its door opens only then |
| `place.compound-room` | place, home, lagos, stylised, no area or position | scope interior, assets `compound-room`; stages nothing of its own: its things carry the home's own acts, staged at the family house, while lived in (home:compound-room-is-a-home) |
| `obligation.rent-compound` | rent, NGN, `tuning.home.compound.rentYear` a year | `everyMonths` 12, `prepaid` (obligation:prepaid-entries-skip-first-charge); sink `rent`; grace 2, onMiss as `obligation.upkeep`; onDefault closes it (home:rent-default-returns-to-family); reports to no credit file |
| `obligation.upkeep-compound` | upkeep, NGN, `tuning.home.compound.upkeep` a month | sink `upkeep`; onMiss as `obligation.upkeep`; obligation:charges-paid-whole-or-missed's short pay applies |
| `obligation.upkeep-hostel` | rent, NGN, `tuning.home.hostelRentKobo` a month | the hostel's rent by the month (home:move-home-once-a-month); sink `rent`; grace 2, onMiss as `obligation.upkeep`; onDefault closes it (home:rent-default-returns-to-family); reports to no credit file |
| `news.makoko-cleared` | news story | told the month of an eviction; also heard of in the city's talk before any move, so the risk is known |

## Numbers

| Number | Value | Source | Rule |
|---|---|---|---|
| Makoko's rent a month | ₦25,000 (`tuning.home.makokoUpkeep`) | Working value (Not verified) | home:move-home-once-a-month |
| Eviction chance a month | 5% (`tuning.home.evictionBp` 500) | Working value | home:makoko-eviction-draw |
| Lost with the room | up to ₦20,000 cash (`tuning.home.evictionLossNaira`) | Working value | home:makoko-eviction-draw |
| A guest's stay | 3 months (`tuning.home.guestMonths`) | Working value | home:taken-in-after-eviction |
| A host's upkeep while hosting | up 25% (`tuning.home.hostBp` 2500) | Working value | home:hosting-costs-the-host |
| Moving back to the family house | standing −5 (`tuning.home.returnStanding`) | Working value | home:move-home-once-a-month |
| The room in a compound's rent a year | ₦350,000 (`tuning.home.compound.rentYear`): a single room in a shared compound in Ojuelegba or Mushin asks ₦250,000 to ₦450,000 in 2025 listings, and at this figure a life from sixteen with ₦500,000 saved can take it at the age it starts at, with a month of living left | 2025 Lagos listings; working value (Not verified) | home:compound-room-is-a-home |
| The agent's and the agreement's fees on it | 20%, a tenth each (`tuning.home.compound.feesBp` 2000) | The Lagos cap as given (Not verified) | home:compound-room-is-a-home |
| Living in the room a month | ₦50,000 (`tuning.home.compound.upkeep`): food, light, the waste and the compound's small charges; no water, which comes free from the yard's tap or well (most Lagos homes draw their own from a borehole, obligation.md Sources), so fetching it takes nothing off there | Working value (Not verified) | home:compound-room-is-a-home, obligation:cooking-and-fetching-water |
| The self-contain's rent a year, shown as a goal | ₦700,000 (`tuning.home.selfContainRentYear`) | Working value (Not verified) | prologue:front-door-three-screens |

## Not verified

- The rent: a room on the water is far cheaper than the family's upkeep of ₦95,000; ₦25,000 is a working figure.
- The room in a compound's ₦350,000 a year, its ₦50,000 a month of living and the self-contain's ₦700,000 a year are working figures. The fees' tenth each is the Lagos cap as given, not read from a source.
