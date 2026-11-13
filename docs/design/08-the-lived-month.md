# The lived month

**Context and scope.** This page covers the player's unit of time and what a session is. A month of the character's life is lived by hand, one act at a time, in the room and the places, and it turns when the player sleeps. The real clock shows only where real life makes you wait. The decisions behind it are 0011 (the world's day and the life's months), 0012 (acts answer when they are done), 0013 (living is paid as it is lived) and 0019 (the things a life owns, and the passbook). The rules are on `../rules/turn.md`, `../rules/clock.md`, `../rules/quality.md`, `../rules/wallet.md` and `../rules/home.md`. Nothing on this page changes the money, the routes, the papers, the people or the server's authority.

**Goals.**

- Every month is played, and the player plays as many in a sitting as they like.
- The chapters carry the journey at the player's own pace.
- Money reads as a passbook (a savings book with stamps), not a ledger.
- The look stays as `07-the-world-first.md` and `09-the-games-look.md` set it: the world, the band, the phone and the sheets.

**Non-goals.** A month that turns by itself; a timer the player waits on; a paid skip or anything else that sells time; a meter or a percentage for the body; a "Next month" button; robbery between players.

## 1. Summary

The month is lived by hand, as many in a sitting as the player likes. The chapters carry the journey at the player's pace. Money is a passbook with stamps and roads to the target. The real clock appears only where real life makes you wait. The room fills with the things the player buys.

## 2. What a player sees

1. **A room, close and full.** Tapping a thing opens its acts. Each act shows its time in words (a morning, a day, a weekend, a week), its cost, what it does, and why it is locked if it is. The figure walks for about a second and the thing responds where it stands: steam off the pot, water off the drum, the bulb. A line appears in the corner or over the speaker's head. The body speaks only when it complains ("Hungry", "Tired"). There is no meter or percentage anywhere (quality:body-belly-and-energy).
2. **The month turns when it is lived.** Acts spend the month's free time. A job or a course takes its days by itself. Talking, looking and buying take no time. When the player sleeps, the month turns in the room whatever time is left (world:sleep-ends-the-month). The results sheet opens with the month's moments and Kept (what the month kept), then "Back to" the place. The band shows the month's name and the world's part of the day (Morning, Afternoon, Evening, Night), never the time left. There is no month page and no "Next month" button (world:no-classic-view-kept).
3. **A passbook.** The Bank app opens on the money for the planned route (wallet:passbook-against-plan-cost):
   - the money held against the route's whole cost, with a stamp at each mark it passes (wallet:savings-stamps);
   - the roads to the target, each with what it needs and a tap: the next rung of the job ladder, a side job, the street's ajo, the family, the scholarship (wallet:roads-to-the-target);
   - a pace line (wallet:saving-pace): "At this pace: ready in 38 months.", with each road's own figure beside it ("With the mid dev job: 9.").

   The ajo is a rotating savings circle: each member pays in every month and one member takes the whole pot (luck:savings-circle-holds-pot).
4. **The morning.** A test result, the endorsing body's answer or a visa decision is sealed until the world's next morning: six o'clock of the game's own day, at most one game day (105 real minutes) away. It then arrives as an envelope on the phone's lock screen (clock:envelopes-show-real-waits, clock:game-day-on-real-time). Play goes on meanwhile; only that one result waits. Nothing sells or skips the wait.
5. **The market.** A phone app sells things for the room and the road, delivered at once: a rider at the gate, a slip, the thing standing in the room. Each thing does something: light when NEPA (the power supply) cuts out, naps that restore more, a laptop that makes portfolio pieces at home in less time. Some cost money to run. Each shows a picture of the exact model that appears in the room (home:things-a-life-owns).
6. **The world's date.** The Friday draw closes on real Fridays for everyone, December is real December, and presence in a place is real time, whatever month each life is in. Absence costs nothing: the life waits while the world moves on.

## 3. How it works

- **Time.** The month's free time spent is counted in half-days in state (turn:month-lived-in-half-days). A life with no job has 60 a month; a life with a job has 20. Time never holds the month back: the month turns when the player sleeps.
- **The bank of turns.** Real time fills it, one turn every two real hours up to 24, and closing a chapter fills it (chapter:met-items-close-the-chapter). Each month lived takes one turn while the bank holds any, and an empty bank never holds a month back (turn:month-turns-on-empty-bank). Its only use is the notice sent when it is full (clock:full-bank-push-notification). No screen shows it.
- **Envelopes.** The simulation resolves a result as the month turns. The view withholds it until the next game morning, which the authority sets: the server online, the device's clock offline.
- **The body.** Two qualities, belly and energy, moved by acts and by time lived, and folded into wellbeing as the month turns (quality:body-belly-and-energy). Shown in words only.
- **Inventory.** The `things` slice holds what is owned. The market's table is in content. A thing's effects modify acts and the light (decision 0019).
- **The ajo.** An obligation: pay in each month; the pot is paid out in a payout month (luck:savings-circle-holds-pot).
- **The world tick.** Online, a world tick is twelve hours, so the rates move twice a real day.
- **The client.** The band, with no count of turns; the act sheet; the passbook in Bank; the market; the morning envelope on the lock screen; the results sheet in the room.

## 4. Alternatives considered

- **A budget of turns.** Each month spends a turn from a bank that real time refills, and a player with an empty bank waits. Rejected: it paces the game by the clock instead of by play, and a timer invites selling skips. The bank stays in state, filled by the clock, and gates nothing.
- **A month planned on one page and played out at once.** Fill the slots, press Next month, read the results. Rejected: it makes a month a form. Living it act by act in the room makes it a place.
- **Results shown at once.** A test band or a visa decision appears the moment the month turns. Rejected: real life makes you wait for these, and the wait to the next morning gives the envelope its weight. The wait is short enough to fall inside one sitting.
- **The body as a meter.** A bar for hunger and one for energy. Rejected: it turns the body into a number to manage. Words that appear only when the body complains keep it a person's.
