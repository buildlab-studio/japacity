# The lived month

**Context and scope.** The player's unit of time and what a session is. A month of the character's life is lived by hand, act by act, in the room and the places, and turns when the player sleeps; the real clock shows only where real life makes you wait. This page draws the month as the player meets it; the decisions behind it are 0011 (the world's day and the life's months), 0012 (acts answer when they are done), 0013 (living is paid as it is lived) and 0019 (the things a life owns, and the passbook), and the rules are on `../rules/turn.md`, `../rules/clock.md`, `../rules/quality.md`, `../rules/wallet.md` and `../rules/home.md`. Nothing below changes the money, the routes, the papers, the people or the server's authority.

**Goals.**

- Gameplay first: every month is played, as many in a sitting as the player likes.
- The chapters carry the journey at the player's own pace.
- Money reads as a passbook, a savings book with stamps, not a ledger.
- The look stays: the world, the band, the phone and the sheets of `07-the-world-first.md` and `09-the-lively-layer.md`.

**Non-goals.** A month that turns by itself, a timer the player waits on, a paid skip or anything that sells time, a meter or a percentage for the body, a "Next month" button, and robbery between players.

## 1. The decision in one line

The month is lived by hand, as many in a sitting as you like; the chapters carry the journey at your own pace; the money is a passbook with stamps and roads; the real clock appears only where real life waits; the room fills with things you buy.

## 2. What a player sees

1. **A room, close and full.** Tap a thing, its acts open: the time in words (a morning, a day, a weekend, a week), the cost, what it does in words, and why a locked one is locked. The figure walks for about a second and the thing answers where it stands: steam off the pot, water off the drum, the bulb. A line lands in the corner or over the speaker's head. The body speaks only when it complains ("Hungry", "Tired"); no meter, no percentage anywhere (quality:body-belly-and-energy).
2. **The month turns when it is lived.** Acts spend the month's free time; a job or a course takes its days by itself; talking, looking and buying take none. When the player sleeps, the month turns in the room, whatever time is left (world:sleep-ends-the-month): the results sheet opens with the month's moments and Kept (what the month kept), then "Back to" the place. The band says the month's name and the world's part of the day (Morning, Afternoon, Evening, Night), never the time left. There is no month page and no "Next month" button (world:no-classic-view-kept).
3. **A passbook.** The Bank app opens on the road's money (wallet:passbook-against-plan-cost): held against the route's whole cost, a stamp at each mark it passes (wallet:savings-stamps), the roads to it, each with what it needs and a tap (the next rung of the job ladder, a side job, the street's ajo, the family, the scholarship; wallet:roads-to-the-target), and a pace line (wallet:saving-pace): "At this pace: ready in 38 months." with each road's own figure beside it ("With the mid dev job: 9."). The ajo is a rotating savings circle: each member pays in every month and one takes the whole pot (luck:savings-circle-holds-pot).
4. **The morning.** A test result, the endorsing body's answer or a visa decision is sealed until the world's next morning, six o'clock of the game's own day, at most one game day of 105 real minutes away. It arrives then as an envelope on the phone's lock screen (clock:envelopes-show-real-waits, clock:game-day-on-real-time). Play goes on meanwhile; only that one result waits. Nothing sells or skips it.
5. **The market.** A phone app sells things for the room and the road, delivered at once: a rider at the gate, a slip, the thing standing in the room. Each thing does something in life (light when NEPA, the power supply, cuts out; naps that give more; the laptop that makes the portfolio's pieces at home in less time); some cost to run; all show a picture of the very model that lands in the room (home:things-a-life-owns).
6. **The world's date.** The Friday draw closes on real Fridays for everyone, December is real December, and presence in a place is real time, whatever month each life is in. Absence costs nothing: a life waits; the world moves on.

## 3. Under the hood

- **Time.** The month's free time spent is counted in half-days in state (turn:month-lived-in-half-days); a life with no job has 60 a month and one with a job 20. It never holds the month back: the month turns when the player sleeps.
- **The bank of turns.** Real time fills it, one turn every two real hours up to 24, and a closed chapter fills it (chapter:met-items-close-the-chapter). Each month lived takes one while it holds any, and it never holds a month back (turn:month-turns-on-empty-bank). Its one use is the notice sent when it is full (clock:full-bank-push-notification); no screen shows it.
- **Envelopes.** The simulation resolves a result as the month turns; the view withholds it until the next game morning, which the authority sets: the server online, the device's clock offline.
- **The body.** Two qualities, belly and energy, moved by acts and by the time lived, folded into wellbeing as the month turns (quality:body-belly-and-energy). Shown in words only.
- **Inventory.** The `things` slice holds what is owned; the market's table is content's; a thing's effects modify acts and the light (decision 0019).
- **The ajo.** An obligation: pay in each month, the pot drawn in a payout month (luck:savings-circle-holds-pot).
- **The world tick.** Online, the world's rates move twice a real day: a world tick is twelve hours.
- **The client.** The band with no count of turns; the act sheet; the passbook in Bank; the market; the morning on the lock screen; the results sheet in the room.

## 4. Alternatives considered

- **A budget of turns.** Each month spends a turn from a bank that real time refills, and a player with an empty bank waits. It paces the game by the clock instead of by play, and it is a timer that asks to be sold; the bank is kept in state, filled by the clock, and gates nothing.
- **A month planned on one page and played out at once.** Fill the slots, press Next month, read the results. It makes a month a form; living it act by act in the room makes it a place.
- **Results shown at once.** A test band or a visa decision the moment the month turns. Real life makes you wait for these, and the wait to the next morning is what makes the envelope land; it is short enough that a sitting can meet it.
- **The body as a meter.** A bar for hunger and one for energy. It turns the body into a number to manage; words that come only when the body complains keep it a person's.
