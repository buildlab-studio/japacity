# The month and the Calendar

A life moves a month at a time, and the month is lived by hand.

- Acts at home and across the city each take a little of the month's time (a morning, a day, a weekend).
- A job or a course takes its days by itself.
- Talking, looking and buying take no time.
- The month turns when the character sleeps on the bed. Everything the month held then comes at once in the month's close, in the room.

The phone's Calendar app holds the month: the job, what carries on, the chores done and what is coming. There is no Next month button and no count of months to spend.

<div style="display:flex;gap:12px;flex-wrap:wrap">
  <img src="/pictures/dev-14-month-2-plan.webp" alt="The Calendar with a job: Working, remote developer for a foreign company; coming up, the brother's school fees, the visa decision for a master's in the UK and the credential assessment" width="220">
  <img src="/pictures/dev-12-month-1-results.webp" alt="The first month is done: something new needs an answer, the laptop, and nothing moved" width="220">
  <img src="/pictures/dev-15-month-2-results.webp" alt="The month is done: payday leading as a card with the salary, a new job started, and kept this month" width="220">
</div>

## Commitments and free time

There is no plan to fill in each month. A month-act the player starts at a thing (a job, a course, study, the portfolio, practice) is a commitment. It carries on every month until the player stops it, from its Stop on the thing's fan or from the Calendar, or until it ends by itself (a course finished, a way shut, a hunt whose job is now held).

What carries on is limited by the month's free time:

| The life | Free time a month |
|---|---|
| With a job | Two |
| With no job | Three |
| Worn down (wellbeing under 25) | One fewer |
| Ill, or holding a side job | Fewer again, as each lock says |

Free time left empty is rest, so rest is never planned.

Quick acts (a purchase, a conversation, an application, a chore) answer at once and never count against free time. They spend the month's time instead, counted in half-days and never shown as a number: a life with no job has the whole month, and one whose job takes its own days has a third of it.

The body, not a count, stops a run of acts. Once the character's energy is low, every act that takes time says "You are spent. Sleep." where its button was, while talking, looking and buying stay open.

The Calendar lists, in order:

1. the job;
2. what carries on, each with its Stop, and any lock with its reason;
3. the chores done this month;
4. what is coming, soonest first, each shown as months away.

## How the month turns

```mermaid
flowchart TD
  N["Sleep, on the bed, at any hour; at night, when the body is tired (energy under 30), the nudge says Night. Go to bed"] --> Q{"The first sleep of the life?"}
  Q -->|yes| C["One small card: Each night you sleep is a month of your life. Sleep or Not yet"]
  C --> S["Asleep: the room dims, Asleep · tap to wake, about half a minute"]
  Q -->|no| S
  S -->|"Wake up early"| W2["A nap: no month turns"]
  S -->|"The sleep runs out"| MO["Any staged moments of the month"]
  MO --> R["The month's close, in the room"]
  R -->|"Back to the place"| W["The world, a month on"]
```

Sleep is a timed act from the bed. The figure lies down, the room takes a soft dark wash, a chip under the band says "Asleep · tap to wake", and a Wake up button stands above the Phone thumb. Waking early turns no month and counts as a nap ("Up again. The night is still yours."). When the sleep runs out, the month turns once.

Then come any moments the month staged, and then the month's close, short, in the room:

- The best thing that happened (payday, or the best moment) leads as a card with its picture.
- Money in comes before money out.
- Rent shows as a chip when it was due.
- Three moments show, with the rest behind See the whole month.
- Then Kept, and one button back to the place.

A loss is said in quiet ink, never as the loudest thing. What was bought or done by hand during the month was paid as it was done and is not listed again. The rest of the month's report stays in the phone's News app. On the twelfth month the results say the character turned a year older.

::: info No month numbers
No running month number shows anywhere a player sees. A deadline reads as months away ("in 2 months", "next month"), and a past month as months ago. The band shows the age in years and months; the phone's wallpaper shows the real date, since the world runs on the real calendar.
:::

## Quiet months

The game never runs months in a row for the player. A quiet month is lived in minutes by hand, with the home's free acts, and turns when the character sleeps. Abroad the months work the same way.

## The world's day and the life's months

<img src="/pictures/dev-11-month-1-plan.webp" alt="The Calendar in the first month: nothing carrying on yet, and a birthday coming in eleven months" width="220" align="right" style="margin-left:16px">

The world keeps its own day, the same for every player. One game day runs in an hour and three quarters of real time, so a sitting sees the sun move, and the band names the part of the day in words (Morning, Afternoon, Evening, Night).

The months of a life are its own: they turn only when that life sleeps, as many in a sitting as the player likes. There is no count of months left and no wait for the next month. Only a result that real life makes you wait for (an English test band, the endorsing body's answer, a visa decision) waits for the world's next morning. It then arrives as an envelope on the phone's lock screen; play goes on meanwhile.

<div style="clear:both"></div>

::: details Exceptions in a month
- **A spent body.** Acts that take time are shut with "You are spent. Sleep." until the character sleeps. The city and the phone stay open meanwhile.
- **Online.** The server's clock gives the world's day on every reply, and the client reads the same clock on the device between replies, the server's reading winning. Nothing in a life moves on that clock while its player is away. Nothing on the phone or in the world counts the months held or the time to the next one.
- **A month with nothing new.** "A quiet month. Nothing changed that you need to know about."
:::

## Rules it rests on

- [Turns](../../rules/turn.md): turn:month-turns-on-empty-bank (the month turns whatever the bank holds), turn:free-slots-per-month (free time and rest), turn:turn-stores-a-report (the month's report), turn:slots-can-be-locked (locked free time), turn:month-lived-in-half-days (the lived month and its time in half-days).
- [The world](../../rules/world.md): world:top-band-is-a-pill (the band, no month numbers), world:month-acts-carry-on (commitments and the Calendar), world:month-end-results-sheet (the month's close), world:sleep-ends-the-month (the bed's Sleep), world:no-months-left-count (no count of the months left, no Next month), world:no-auto-run-months (no months run in a row: a quiet month turns when the player sleeps), world:month-passes-as-lived (the month's time is the simulation's).
- [The clock](../../rules/clock.md): clock:no-month-countdown-shown (nothing counts the months held), clock:envelopes-show-real-waits (envelopes), clock:game-day-on-real-time (the world's own clock).
- [Activities and jobs](../../rules/activity.md): activity:now-acts-and-month-acts (acts that answer now), activity:now-acts-spend-half-days (the time an act takes), activity:spent-body-refuses-acts (the spent body).
- [Chapters](../../rules/chapter.md): chapter:met-items-close-the-chapter (a chapter closes at the month's end).
