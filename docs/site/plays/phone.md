# The phone

This page walks through the character's phone and each of its apps. The phone holds everything that is not in front of the character: the month, money, family, the plan to leave, papers, work, the market, the draw, bills and the news. Its rules are world:phone-rises-over-scene and world:phone-holds-what-phones-hold in [the world rules](../../rules/world.md).

The phone rises tilted over the scene from the Phone button at the bottom right. Its lock screen shows the clock, the day, where you are, the notices as cards naming their app, and the apps under them. A dot on an app means something new is in it; a dot on the Phone button means some app has one.

<p style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/dev-26-phone.webp" alt="The phone over the scene: the lock screen with the clock, the day and the place, a notice from Papers, eleven apps, and dots on Chats, Papers, Bills and News" width="260">
<img src="/pictures/phone-danfo.webp" alt="The same phone at the world's night, in the navy paint" width="260">
</p>

## How it works

```mermaid
flowchart LR
  W["The world"] -- "Phone button" --> H["The phone: time, day, place, the apps"]
  H -- "tap an app" --> A["One app, one screen"]
  A -- "Back" --> H
  H -- "the grow button" --> G["Nearly the whole screen"]
  G -- "tap again" --> H
  H -- "the home bar" --> W
  A -- "a visit in Papers" --> M["The map, with the stop picked"]
```

- Each app has one job and one short screen. A small pill beside its name says what matters now (offers waiting, the next draw, the next rent).
- The corner button grows the phone to nearly the whole screen and back; Back returns to the apps, and the bar at the foot puts the phone away.
- What an act inside an app did is told in the corner over the handset, so it can be read while the phone covers the world.
- Lines under the band can open the phone straight on the right app: the coming chip opens the Calendar, and abroad the line about the month's dues opens the Bank.

## The apps

The apps are, in order: Calendar, Bank, Chats, Japa, Papers, Jobs, Market, Lotto, Bills, News, Settings.

### Calendar

<img src="/pictures/dev-27-phone-calendar.webp" alt="The Calendar: the job held, what carries on, and what is coming up" width="260">

The month as it stands: the job, what carries on, the chores done and what is coming. See [The month and the Calendar](./month.md#the-calendar).

### Bank

<img src="/pictures/dev-28-phone-bank.webp" alt="The Bank's passbook: held for the road against the whole cost with all of it held, the stamps, last month, and Change money and Move money" width="260">

The passbook of savings against the cost of the road, and the acts to change and move money. See [Money](./money.md#the-bank-app).

### Chats

<p style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/dev-29-phone-chats.webp" alt="Chats: the People row and the family group" width="260">
<img src="/pictures/phone-chats-family.webp" alt="The family group open, with messages from Ebuka and Aunty Nkechi months back" width="260">
</p>

The family group, a row of the people in this life at the top, and a thread for each partner or sibling. A real player is answered in preset phrases picked from chips; nobody types. See [People](./people.md).

### Japa

<img src="/pictures/dev-30-phone-japa.webp" alt="Japa: the plan's card with how ready you are as a bar, and the briefs carried" width="260">

The log of the road: the way out the briefs follow, with how ready you are as a filling bar (never a percentage); the briefs so far, each step ticked or not with where it is done; the other ways out heard of; and what is coming. Each other way opens its own page, where you can make it the plan. See [Routes and japacity](./routes.md).

### Papers

<img src="/pictures/dev-31-phone-papers.webp" alt="Papers: the box under the bed, each paper with its state and the way to it" width="260">

What is in the box under the bed: every paper held or awaited, its state, what it counts towards, and the act that moves it. A visit opens the map on its stop. See [Papers and the file chapter](./papers.md).

### Jobs

<img src="/pictures/dev-32-phone-jobs.webp" alt="Jobs: the job held, its pay and how long, with Quit, the offers, and the board at the hub" width="260">

The job held, its pay and months in, with Quit; then the offers waiting. With no offer, it points to the jobs board at the hub on the map.

### Market

A grid of things for the room and the road, each pictured as it stands in the room, with what it does, its price and any monthly cost. Buying pays at once and a rider brings it to the gate; things owned can be sold. It sells only in Lagos. See [The home](./home.md).

### Lotto

<img src="/pictures/dev-33-phone-lotto.webp" alt="Lotto offline: tickets are sold at the kiosk on Bode Thomas Street, with the way to it" width="260">

The draw as seen from the phone: the next draw, your tickets and the last results. Tickets are bought at a kiosk in the city, never in the app. See [The Friday draw](./friday-draw.md).

### Bills

<img src="/pictures/dev-34-phone-bills.webp" alt="Bills: where you live and your share for the house, then the ways to move" width="260">

Where you live and the moves you could make, then every bill. See [Money](./money.md#bills) and [The home](./home.md).

### News

<img src="/pictures/dev-35-phone-news.webp" alt="News: the times, then this month's lines" width="260">

In order: a line on the times (Calm, or what is happening); the last month's report, which stays here after the results close; and the stories that have reached you, what is happening now first, talk next, the past last. Once you have flown on a way, its news stops asking for you. The stories and the times are in [the news rules](../../rules/news.md) and [the director rules](../../rules/director.md).

### Settings

<img src="/pictures/dev-36-phone-settings.webp" alt="Settings: sound, graphics, a ready life, and About the game" width="260">

Sound, graphics, the account, a ready life, feedback, the credits and guides, and Start a new life. See [Settings and a new life](./settings.md).

::: details What the phone does not hold
The papers themselves are in the box under the bed at home; the phone only shows what is in it. The map is separate from the phone, and the Map button never carries a dot.
:::

## Rules it rests on

- [The world](../../rules/world.md): world:phone-rises-over-scene, world:phone-holds-what-phones-hold, world:thumb-buttons-carry-dots, world:nobody-picked-from-list, world:street-talk-budget, world:month-passes-as-lived, world:nudge-says-one-thing.
- [Documents](../../rules/document.md): document:paper-on-its-way.
- [Money](../../rules/wallet.md): wallet:passbook-against-plan-cost, wallet:savings-stamps, wallet:saving-pace, wallet:roads-to-the-target.
- [Home](../../rules/home.md): home:things-a-life-owns.
- [Chapters](../../rules/chapter.md): chapter:chapters-follow-lean-route.
- [Pairs](../../rules/pair.md): pair:preset-phrases-only, pair:conversation-phrases-stored.
- [News](../../rules/news.md) and [The director](../../rules/director.md): the stories and the times.
