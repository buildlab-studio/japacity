# The lived month

> The design of the lived month, on two principles: gameplay first, and the look stays. The bank of turns stays in state and gates nothing (`../rules/turn.md`). Nothing below changes the money, the routes, the papers, the people or the server's authority; it changes the player's unit of time and what a session is.
> The game carries the lived month (decision 0011, turn:month-lived-in-half-days), living by hand and the body as two qualities, belly and energy (decisions 0013 and 0011, quality:body-belly-and-energy), the world's own clock (decision 0011), the day's arrivals (decision 0012), the envelopes at seven in Lagos (clock:envelopes-show-real-waits), the market and the passbook (decision 0019) and the ajo (luck:savings-circle-holds-pot). The chapters (`../rules/chapter.md`) carry the journey, and a world tick is twelve hours.

## 1. The decision in one line

The month is lived by hand, as many in a sitting as you like; the chapters carry the journey at your own pace; the money is a passbook with stamps and roads; the real clock appears only where real life waits; the room fills with things you buy.

## 2. What a player sees

1. **A room, close and full.** Tap a thing, its acts open on one sheet: the time in words (a morning, a day, a weekend, a week), the cost, what it does in words, and why a locked one is locked. The figure walks for under a second and the thing answers where it stands: steam off the pot, water off the drum, the bulb. A line lands in the corner or over the speaker's head. The body speaks only when it complains ("Hungry", "Tired"); no meter, no percentage anywhere.
2. **The month turns when it is lived.** Acts spend the month's days; a job or a course takes its days by itself; talking, looking and buying take none. When the player sleeps, the month turns in the room, whatever days are left (world:sleep-ends-the-month): the results sheet opens with the month's moments and Kept, then "Into May". The month's name and phase (Early, Mid, Late, Month end) sit on the band. There is no bank, no page, no "Next month" button, no plan to fill.
3. **A passbook.** The Bank app opens on the road's money: held against the route's target, stamps at each mark it passes, the roads to it (the ladder, side jobs, the street's ajo, a family loan, the scholarship) each with what it needs and a tap, and a pace line: "At this pace: ready in 38 months. With the mid dev job: 9."
4. **The morning.** A test result, the endorsing body's answer or a visa decision arrives at 7am Lagos as an envelope on the phone's lock screen. Play goes on meanwhile; only that one ask waits. Nothing sells or skips it.
5. **The market.** A phone app sells things for the room and the road, delivered at once: a rider at the gate, a slip, the thing standing in the room. Each thing does something in life (light when NEPA takes it, naps that give more, the laptop that opens the portfolio's pieces at home); some cost to run; all show a picture of the very model that lands in the room.
6. **The world's date.** The Friday draw closes on real Fridays for everyone, December is real December, and presence in a place is real time, whatever month each life is in. Absence costs nothing: a life waits; the world moves on.

## 3. Under the hood

- **Time.** `turn/end` needs no banked turn. The month's free time spent is counted in half-days in state (turn:month-lived-in-half-days) and gates nothing: the month turns when the player sleeps. The bank, its earning and its refill stay in state and gate nothing. A world tick is twelve hours.
- **Envelopes.** The simulation resolves a result at the turn; the view withholds it until the envelope's time, set by the server (offline, by the device's clock).
- **The body.** Two qualities, belly and energy, moved by acts and by the time lived, folded into wellbeing as the month turns (quality:body-belly-and-energy). Shown in words only.
- **Inventory.** The `things` slice holds what is owned; the market's table is content's; a thing's effects modify acts and the light (decision 0019).
- **The ajo.** An obligation: pay in each month, the pot drawn in a payout month (luck:savings-circle-holds-pot).
- **The client.** The band without the bank; the act sheet; the passbook in Bank; the market; the morning on the lock screen; the results sheet in the room.

## 4. What stays

The door and the data page; the band's look, the phone and its apps, the sheets; the places, the rides, the walk home; lines over heads and in the corner; labels on tap; cash small; no robbery between players; no timers sold, no paid skip; the voice rules; the server's authority and the simulation's determinism.
