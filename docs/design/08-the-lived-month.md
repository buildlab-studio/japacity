# The lived month

**Context and scope.** Why a month of the character's life is lived by hand, one act at a time, in the room and the places, and turns when the player sleeps; and why the real clock shows only where real life makes you wait. The decisions are [0011](../decisions/0011-the-worlds-day-and-the-lifes-months.md), [0012](../decisions/0012-acts-answer-when-they-are-done.md), [0013](../decisions/0013-living-is-paid-as-it-is-lived.md) and [0019](../decisions/0019-the-things-a-life-owns-and-the-passbook.md). The rules are on [`turn.md`](../rules/turn.md), [`clock.md`](../rules/clock.md), [`quality.md`](../rules/quality.md), [`wallet.md`](../rules/wallet.md) and [`home.md`](../rules/home.md). Nothing on this page changes the money, the routes, the papers, the people or the server's authority.

**Goals.**

- Every month is played, and the player plays as many in a sitting as they like.
- The chapters carry the journey at the player's own pace.
- Money reads as a passbook (a savings book with stamps), not a ledger.
- The look stays as [page 07](07-the-world-first.md) and [page 09](09-the-games-look.md) set it: the world, the band, the phone and the sheets.

**Non-goals.** A month that turns by itself; a timer the player waits on; a paid skip or anything else that sells time; a meter or a percentage for the body; a "Next month" button; robbery between players.

## 1. Summary

The month is lived by hand, as many in a sitting as the player likes. Money is a passbook with stamps and roads to the target. The real clock appears only where real life makes you wait. The room fills with the things the player buys.

## 2. What a player sees

1. **A room, close and full.** Tapping a thing opens its acts, each with its time in words, its cost, what it does and why it is locked if it is. The thing answers where it stands (steam off the pot, water off the drum, the bulb), and a line appears in the corner or over the speaker's head (world:things-are-tappable-models). The body speaks only when it complains, in words, never as a meter (quality:body-belly-and-energy).
2. **The month turns when it is lived.** Acts spend the month's free time; a job or a course takes its days by itself; talking, looking and buying take none (turn:month-lived-in-half-days). When the player sleeps the month turns, whatever time is left, and one results sheet opens over the room (world:sleep-ends-the-month, world:month-end-results-sheet). Nothing on screen counts the time left or the months, and there is no month page (world:no-months-left-count, world:no-classic-view-kept).
3. **A passbook.** The Bank app opens on the money for the planned route as a savings book, not a ledger (wallet:passbook-against-plan-cost):
   - the money held against the route's whole cost, with a stamp at each mark it passes (wallet:savings-stamps);
   - the roads to the target, each with what it needs and a tap: the next rung, a side job, the ajo, the family, the scholarship (wallet:roads-to-the-target);
   - a pace line saying when the move is in reach at this pace, and how much sooner each road makes it (wallet:saving-pace).

   The ajo is a rotating savings circle: each member pays in every month and one member takes the whole pot (luck:savings-circle-holds-pot).
4. **The morning.** A result real life makes you wait for (a test band, the endorsing body's answer, a visa decision) is sealed until the world's next morning and then arrives as an envelope on the phone's lock screen (clock:envelopes-show-real-waits). Play goes on meanwhile; only that one result waits, and nothing sells or skips the wait.
5. **The market.** A phone app sells things for the room and the road, delivered at once: a rider at the gate, a slip, the thing standing in the room. Each thing does something (light when NEPA, the power supply, cuts out; better naps; a laptop that makes portfolio pieces at home), some cost money to run, and each shows the exact model that appears in the room (home:things-a-life-owns).
6. **The world's date.** The Friday draw closes on real Fridays for everyone, December is real December, and presence in a place is real time, whatever month each life is in. Absence costs nothing: the life waits while the world moves on.

## 3. How it works

- **Time.** The month's free time is counted in half-days in the simulation's state, and never holds the month back (turn:month-lived-in-half-days).
- **The bank of turns.** Real time fills it and closing a chapter fills it, but an empty bank never holds a month back. Its only use is the notice sent when it is full, and no screen shows it (turn:month-turns-on-empty-bank, clock:full-bank-push-notification; [page 01](01-concept.md) section 9).
- **Envelopes.** The simulation resolves a result as the month turns. The view withholds it until the next game morning, which the authority sets: the server online, the device's clock offline (clock:game-day-on-real-time).
- **The body.** Two qualities, belly and energy, moved by acts and by time lived, and folded into wellbeing as the month turns (quality:body-belly-and-energy).
- **Inventory.** The `things` slice holds what is owned, and the market's table is in content. A thing's effects change acts and the light (decision 0019, home:things-a-life-owns).
- **The ajo.** An obligation: pay in each month, take the pot in a payout month (luck:savings-circle-holds-pot).
- **The world tick.** Online the rates and stories move on the world's tick, not on the life's months (clock:world-tick-length-and-epoch).
- **The client.** The band, with no count of turns; the act sheet; the passbook in Bank; the market; the morning envelope on the lock screen; the results sheet in the room.

## 4. Alternatives considered

- **A budget of turns.** Each month spends a turn from a bank that real time refills, and a player with an empty bank waits. Rejected: it paces the game by the clock instead of by play, and a timer invites selling skips. The bank stays in state, filled by the clock, and gates nothing.
- **A month planned on one page and played out at once.** Fill the slots, press Next month, read the results. Rejected: it makes a month a form. Living it act by act in the room makes it a place.
- **Results shown at once.** A test band or a visa decision appears the moment the month turns. Rejected: real life makes you wait for these, and the wait to the next morning gives the envelope its weight. The wait is short enough to fall inside one sitting.
- **The body as a meter.** A bar for hunger and one for energy. Rejected: it turns the body into a number to manage. Words that appear only when the body complains keep it a person's.
