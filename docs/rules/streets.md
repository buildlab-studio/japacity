# The streets' life

> What a character can do in the city's other places: Computer Village, Third Mainland Bridge, the National Stadium, the streets of Lagos and the streets abroad. Builds on `world.md` (things and acts), city:places-stage-their-acts (staging), luck:luck-never-reads-money (chance never reads money), health:low-wellbeing-warns-first (the run-down months), `quality.md`, `activity.md` and `offer.md`.
> Kinds: `activity` and `offer` entries, its own tuning block `tuning.street`, and `sex` on the scenario. No kind of its own.

Every act on this page is a thing in its place (world:things-are-tappable-models), is played through the activity and offer kinds, and is told plainly: never graphic, never a joke.

## Rules: Computer Village

**streets:buy-phone-at-computer-village** A phone can be bought at Computer Village: `activity.buy-phone`, staged at `place.computer-village`, slot `none` (a purchase done at once, activity:now-acts-and-month-acts). It costs `tuning.street.phonePrice` in naira, paid by its size (decision 0014): cash first at or under `tuning.wallet.cashUpTo`, the bank first above it. It raises `quality.wellbeing` by `tuning.street.phoneMood` and `quality.network` by `tuning.street.phoneNetwork`. It can be bought again; each purchase is a new phone.

**streets:phone-sales-job** Selling phones is a job: `activity.job-phone-sales`, staged at `place.computer-village`, a main-slot job hunted and held like any other (`activity.md`).
- Pay `tuning.street.salesPay` a month; hire chance `tuning.street.salesHireBp`.
- Needs `quality.education-level` 1 or more (secondary school: the phone sellers at Computer Village are school leavers).
- Each month held raises `quality.tech` by 1 and lowers `quality.wellbeing` by 1.
- It is the first rung of the shop's ladder: the shop supervisor is above it and your own stall at the top. Its side job is weekend phone repairs at Computer Village (`activity.phone-repairs`, tech 20; activity:each-trade-climbs-its-ladder).
- Its employer is `informal` (activity:naira-pay-reviewed-yearly).

**streets:apprentice-learns-repair** The repair trade can be learned as an apprentice: `activity.apprentice-repair`, staged at `place.computer-village`, a free slot with no pay. Each month raises `quality.tech` by `tuning.street.apprenticeTech` (2) and lowers `quality.wellbeing` by 1. It is allowed only while `quality.tech` is under `tuning.street.apprenticeUntil` (30). That is enough for a hardware trade and the repairs side job, but never a free road to the developer's jobs: the bands of quality:skill-bands-slow-gains keep those for study and work.

## Rules: Third Mainland Bridge

**streets:sleeping-under-the-bridge** Under the bridge is where the character sleeps when there is nowhere else: `activity.sleep-rough`, staged at `place.third-mainland-bridge`, a free slot, allowed only while naira cash and bank together are under `tuning.place.brokeLine`. It costs nothing and gives the same rest as an empty slot (`tuning.quality.wellbeingRest`).

It has a price. Each of these is a bad offer of the `life` group, drawn on the `offer` stream, that opens only in a month the character slept rough. Its `when` reads the month's played activities and never money (luck:luck-never-reads-money).
- `offer.bridge-theft`, at `tuning.street.theftBp`: takes `tuning.street.theftNaira` from cash, or nothing when cash is short (wallet:no-pocket-below-zero).
- `offer.bridge-mosquitoes`, at `tuning.street.mosquitoBp`: adds 1 to `quality.run-down-months` (the warning path of health:low-wellbeing-warns-first).
- `offer.bridge-night`, at `tuning.street.harassBp`: lowers `quality.wellbeing` by `tuning.street.harassMood`. It is told as harassment when the character is a woman, as being challenged to a fight when a man (`sex` on the scenario, streets:sex-optional-with-neutral-path), and as trouble in the night when the life does not say.

Each has one choice, to carry on. The lines are plain.

## Rules: abroad

**streets:street-shopping-abroad** Shopping on the street abroad: `activity.street-shopping-uk` and `activity.street-shopping-uae`. Each is a purchase that answers at once, can be repeated as often as the money allows and takes no time (activity:now-acts-and-month-acts, activity:now-acts-spend-half-days). It costs `tuning.street.shoppingGbp` pence or `tuning.street.shoppingAed` fils from that currency's cash, under the money reason `enjoyment`, and raises `quality.wellbeing` by `tuning.street.shoppingMood`.
- The UK's stalls are on Rye Lane (`place.rye-lane` stages `activity.street-shopping-uk`). They do not fill the belly.
- The UAE's souq is at Naif (`place.naif` stages `activity.street-shopping-uae`, streets:dubai-life-by-hand).
- Italy's evening at the Nigerian shop on the Domitiana is `activity.street-shopping-italy` in streets:castel-volturno-by-hand.

**streets:street-finds-abroad** Finding something interesting: `offer.street-find-uk`, `offer.street-find-uae`, `offer.street-find-canada` and `offer.street-find-italy`, offers of the `life` group that open at `tuning.street.findBp` a month while the character is in that country. Two choices: look, which raises `quality.wellbeing` by `tuning.street.findMood`, or walk on, which changes nothing. Each comes with a line about what was found, drawn from the entry's lines.

**streets:peckham-talks-like-lagos** People in Peckham talk to the character as people in Lagos do: the place has at least six overheard lines in content, in Nigerian voices (world:street-talk-budget).

**streets:london-life-by-hand** London's street and the room, played by hand (`../design/10-london.md` section 6): a glimpse of the life abroad the player is aiming for. Each is a priced now-act in pounds that spends its time (turn:month-lived-in-half-days), can be repeated unless marked once a month, and moves the body as quality:body-belly-and-energy says. Content is in `activity.london.data.ts`. Each is `where: "abroad"`, `country: "country.uk"`, and requires the character to be in the UK.
- At `place.big-shop-uk`: `activity.weekly-shop-uk` (the weekly shop, £45, a morning, reason `food`: belly +40, a little less than a pot of your own at home, `activity.cook-own-pot`).
- In the room (`place.the-room` in the UK): `activity.cook-own-uk` (a meal of your own, £6, a morning, reason `food`: belly +25, as a meal of your own at home, `activity.cook-own`, which charges no naira abroad: home:living-by-hand).
- At `place.rye-lane`:
  - `activity.chicken-shop` (the chicken shop, £7, a morning, reason `food`: belly +20, wellbeing +4);
  - `activity.naija-shop-uk` (the Nigerian shop, £25, a morning, reason `food`: belly +30, wellbeing +8);
  - `activity.pub-pint` (a pint, £6, a morning, reason `enjoyment`: wellbeing +5, energy -3);
  - `activity.barber-uk` (a fresh cut, £15, a morning, once a month, reason `enjoyment`: wellbeing +5, standing +1, interview-prep +2);
  - `activity.buy-clothes-uk` (new clothes, £40, a day, once a month, reason `enjoyment`: standing +1, wellbeing +3).

The interface offers the evening and night ones at their hour, as streets:lagos-street-spending says.

**streets:calgary-life-by-hand** Calgary by hand (`../design/11-calgary-dubai-and-castel-volturno.md` section 5): priced now-acts in Canadian dollars on the pattern of streets:london-life-by-hand. Content is in `activity.calgary.data.ts`. Each is `where: "abroad"`, `country: "country.canada"`, and requires the character to be in Canada.
- At `place.big-shop-canada`: `activity.weekly-shop-canada` (the weekly shop, C$90, a morning, reason `food`: belly +40); `activity.buy-clothes-canada` (winter clothes, C$120, a day, once a month, reason `enjoyment`: standing +1, wellbeing +4).
- In the room (`place.the-room` in Canada): `activity.cook-own-canada` (a meal of your own, C$8, a morning, reason `food`: belly +25).
- At `place.calgary-north-east`: `activity.coffee-canada` (a coffee, C$3, no time, `purchase: true`, reason `enjoyment`: wellbeing +2); `activity.naija-shop-canada` (the African store, C$40, a morning, reason `food`: belly +30, wellbeing +8); `activity.barber-canada` (a fresh cut, C$30, a morning, once a month, reason `enjoyment`: wellbeing +5, standing +1, interview-prep +2).

`activity.community-canada` and `activity.learn-tech-canada` are at the church hall and the library (`city.md`), with their own figures.

**streets:dubai-life-by-hand** Dubai by hand (`../design/11-calgary-dubai-and-castel-volturno.md` section 5): priced now-acts in dirhams on the same pattern. Content is in `activity.dubai.data.ts`. Each is `where: "abroad"`, `country: "country.uae"`, and requires the character to be in the UAE.
- At `place.big-shop-uae`: `activity.weekly-shop-uae` (the weekly shop, AED 150, a morning, reason `food`: belly +40).
- In the room (the bed space at the camp): `activity.cook-own-uae` (a meal at the camp, AED 8, a morning, reason `food`: belly +25).
- At `place.deira`: `activity.cafeteria-uae` (the cafeteria, AED 12, a morning, reason `food`: belly +25, wellbeing +3); `activity.naija-shop-uae` (the African foods shop, AED 60, a morning, reason `food`: belly +30, wellbeing +8); `activity.barber-uae` (a fresh cut, AED 25, a morning, once a month, reason `enjoyment`: wellbeing +5, standing +1).
- At `place.naif`: `activity.buy-clothes-uae` (the tailor, AED 80, a day, once a month, reason `enjoyment`: standing +1, wellbeing +3); `activity.laundry-uae` (the laundry, AED 20, a morning, reason `enjoyment`: wellbeing +2); and the souq's `activity.street-shopping-uae` (streets:street-shopping-abroad).

**streets:castel-volturno-by-hand** Castel Volturno by hand (`../design/11-calgary-dubai-and-castel-volturno.md` section 5): priced now-acts in euros on the same pattern. Content is in `activity.castel.data.ts`. Each is `where: "abroad"`, `country: "country.italy"`, and requires the character to be in Italy.
- At `place.big-shop-italy`: `activity.weekly-shop-italy` (the weekly shop, €35, a morning, reason `food`: belly +40).
- In the room (the room in a shared flat): `activity.cook-own-italy` (a meal of your own, €4, a morning, reason `food`: belly +25).
- At `place.castel-volturno`: `activity.coffee-italy` (a coffee at the bar, €1.20, no time, `purchase: true`, reason `enjoyment`: wellbeing +2); `activity.naija-shop-italy` (the African shop, €20, a morning, reason `food`: belly +30, wellbeing +8).
- At `place.via-domitiana`: `activity.barber-italy` (a fresh cut, €10, a morning, once a month, reason `enjoyment`: wellbeing +5, standing +1); `activity.buy-clothes-italy` (clothes from the stall, €25, a day, once a month, reason `enjoyment`: standing +1, wellbeing +3); `activity.street-shopping-italy` (the Nigerian shop's evening, €15, a morning, reason `enjoyment`: wellbeing +5).
- At `place.church-italy`: `activity.community-italy` (the church, free, a morning: network +4, wellbeing +4), as `activity.community-uk` is in London.

## Rules: the stadium

**streets:stadium-morning-run** The stadium is for a morning run: `activity.morning-run`, staged at `place.national-stadium`, a free slot at no cost, raising `quality.wellbeing` by `tuning.street.runMood`. Nothing else is staged there; it is a landmark.

## Rules: the character's sex

**streets:sex-optional-with-neutral-path** A scenario may give the character's `sex` (`f` or `m`). The prologue's life does not, and a rule that reads it then takes the neutral path. Nothing else reads it.

## Rules: Lagos streets

**streets:parcels-shipped-home** Things shipped home by a relative abroad.
- When: in a birthday month at home, while a relative abroad is in the story (a sibling whose facts put them abroad, at any stage of the bond except ended, or the aunty once a route is known). The offer kind opens `offer.parcel-shipped` by its own rule, never by a roll.
- What: it names the sender (`from`) and the one thing the parcel holds, drawn on the `offer` stream from: a phone (what `activity.buy-phone` gives, streets:buy-phone-at-computer-village); a laptop (wellbeing `tuning.parcel.laptopMood`); clothes (`quality.interview-prep` `tuning.parcel.clothesPrep`); or foodstuff (the next month's living costs relieved as cooking relieves them, obligation:cooking-and-fetching-water).
- Where: it waits at the cargo office on Bode Thomas Street (`place.bode-thomas`: the booth with its boards, the bags and the clerk) until it is collected there for the clerk's handling charge, `tuning.parcel.handling` in naira, cash first (decision 0014). Only the thing it holds can be taken.
- The sheet is the waybill, a paper slip (world:one-action-one-sheet) with the sender's note in their own words and one button, Collect. Its Not now lowers the asks sheet it stands in, and the parcel keeps waiting. A life short of the charge is never held on the slip.
- The nudge (world:nudge-says-one-thing) does not point at the parcel while the naira held pays no fare and the cargo office is a ride away. From anywhere else in the city the nudge names it.
- A flight closes it unanswered (offer:lapsed-offer-removed).
- Nothing here moves money between lives (person:money-counted-never-moved).

**streets:lagos-street-spending** Enjoyment and spending on the street (decision 0012: living in Lagos is the loop, and the japa goal makes each choice cost something). The streets carry priced now-acts (activity:now-acts-and-month-acts, activity:acts-may-repeat-in-month) that answer at once. Each is paid from the naira when done, under the money reason `enjoyment`, spends its time (turn:month-lived-in-half-days) and moves the body and the self a little (quality:body-belly-and-energy). Content is in `activity.enjoy.data.ts`.
- At `place.ojuelegba`:
  - `activity.buy-suya` (a wrap of suya, ₦2,500, a morning, repeats: belly +20, wellbeing +5);
  - `activity.mallam-tea` (tea with the mallam, ₦500, a morning, repeats: wellbeing +4, energy +5, standing +1);
  - `activity.pure-water` (cold pure water, ₦100, no time, a purchase with `purchase: true` on the entry, so it runs as often as money allows: energy +4, wellbeing +2).
- At `place.bode-thomas`:
  - `activity.barber` (a fresh low cut, ₦3,000, a morning, once a month: wellbeing +5, standing +1, interview-prep +2);
  - `activity.viewing-centre` (the match, ₦1,000, a day, repeats: wellbeing +8, energy -3, network +1);
  - `activity.beer-joint` (a cold one at the joint, ₦2,500, a morning, repeats: wellbeing +6, belly +5, energy -4);
  - `activity.night-out` (a night out, ₦20,000, a day, repeats: wellbeing +12, energy -20, network +2).
- At `place.tejuosho-market`: `activity.buy-clothes` (new clothes, ₦15,000, a day, once a month: standing +2, wellbeing +4).

The simulation knows no hour. Which of these the street offers at which part of the world's day is decided by the interface, as the sky is (world:things-are-tappable-models): the viewing centre from the evening, the joint and the night out in the evening and at night.

## Numbers

Every figure here is a working value.

| What | Value | Rule | In content as |
|---|---|---|---|
| A phone | ₦45,000; mood +6; network +3 | streets:buy-phone-at-computer-village | `tuning.street.phonePrice`, `phoneMood`, `phoneNetwork` |
| Phone sales | ₦70,000 a month; hire 60%; tech +1, mood -1 a month | streets:phone-sales-job | `tuning.street.salesPay`, `salesHireBp` 6000 |
| Apprentice | tech +2 a month, mood -1, until tech 30. Real: employed phone technicians earn ₦50,000 to ₦150,000 full time (Profolio salary guide, read 24 Oct 2026), a hardware trade, not a developer's | streets:apprentice-learns-repair | `tuning.street.apprenticeTech` 2, `apprenticeUntil` 30 |
| Sleeping rough | free; rest as an empty slot; theft 20% of ₦5,000; mosquitoes 35%, run-down +1; a bad night 30%, mood -8 | streets:sleeping-under-the-bridge | `tuning.street.theftBp` 2000, `theftNaira`, `mosquitoBp` 3500, `harassBp` 3000, `harassMood` |
| Shopping abroad | £20 or AED 80; mood +5 | streets:street-shopping-abroad | `tuning.street.shoppingGbp` 2000, `shoppingAed` 8000, `shoppingMood` |
| Something interesting | 15% a month; mood +4 | streets:street-finds-abroad | `tuning.street.findBp` 1500, `findMood` |
| Peckham's voices | at least 6 lines | streets:peckham-talks-like-lagos | the place's overheard lines |
| A morning run | free; mood +8 | streets:stadium-morning-run | `tuning.street.runMood` |
| A parcel's handling; a laptop; clothes | ₦1,500; mood +8; interview-prep +10 | streets:parcels-shipped-home | `tuning.parcel.handling`, `laptopMood`, `clothesPrep` |
| Suya, tea, pure water | ₦2,500, ₦500, ₦100 | streets:lagos-street-spending | `activity.enjoy.data.ts` |
| A low cut, the match, the joint, a night out | ₦3,000, ₦1,000, ₦2,500, ₦20,000 | streets:lagos-street-spending | `activity.enjoy.data.ts` |
| New clothes | ₦15,000; standing +2, mood +4 | streets:lagos-street-spending | `activity.enjoy.data.ts` |
| London by hand | the weekly shop £45; a meal £6; the chicken shop £7; the Nigerian shop £25; a pint £6; the barber £15; clothes £40 | streets:london-life-by-hand | `activity.london.data.ts` |
| Calgary by hand | the weekly shop C$90; a meal C$8; a coffee C$3; the African store C$40; the barber C$30; winter clothes C$120 | streets:calgary-life-by-hand | `activity.calgary.data.ts` |
| Dubai by hand | the weekly shop AED 150; a meal AED 8; the cafeteria AED 12; the African foods shop AED 60; the barber AED 25; the tailor AED 80; the laundry AED 20; the souq AED 80 | streets:dubai-life-by-hand | `activity.dubai.data.ts` |
| Castel Volturno by hand | the weekly shop €35; a meal €4; a coffee €1.20; the African shop €20; the barber €10; clothes €25; the Nigerian shop's evening €15 | streets:castel-volturno-by-hand | `activity.castel.data.ts` |
