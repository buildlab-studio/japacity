# The interview and the set pieces

Some moments in a life are scenes, not acts: the visa interview, the night meeting on the road, the December visit home, a nurse's certification exam, a talk at the hub. The game calls them set pieces. A set piece:

- asks one question at a time;
- never shows a score;
- holds the month open: the month cannot end until it is finished.

The visa interview is the one most lives meet, and its answers move the chance of the visa.

<div style="display:flex;gap:12px;flex-wrap:wrap">
<img src="/pictures/interview-nudge.webp" alt="The world the month the application went in: the nudge says the visa interview waits at the visa centre" width="260">
<img src="/pictures/interview-enter.webp" alt="The visa interview waiting in the asks sheet, with Enter the interview room" width="260">
<img src="/pictures/interview-question.webp" alt="The officer's first question, Tell me what the course covers, with two answers" width="260">
</div>

## The visa interview

Sending a visa application opens the interview at once. The nudge says it waits at the visa centre, and a tap opens it among the things waiting on you. "Enter the interview room" starts it. That tap also lets the browser play sound, so the officer's lines are spoken and shown as text together. Every line is on screen, so the sound is never needed, and a switch mutes it.

The officer asks three questions, drawn from those that fit your file:

- Some always come up: why this course, who pays, what you will do after, what the course covers, where you will live.
- Some come only when something in the file calls for them: a large sum that arrived recently, or a transcript that is not genuine.
- Some answers bring a follow-up question, chosen by the answer you tapped, never by what it scored.

```mermaid
flowchart TD
  A["Send the visa application"] --> B["The interview opens: the month cannot end"]
  B --> C["Enter the interview room"]
  C --> D["The officer asks a question"]
  D --> E{"Your answer"}
  E -->|"It names a follow-up"| F["The follow-up is asked next"]
  E -->|"Plain"| G{"Questions left?"}
  F --> G
  G -->|"Yes"| D
  G -->|"No"| H["The room closes: the score goes on the application, unseen"]
  H --> I["Next month: the decision"]
```

The score is never shown. Each point moves the chance of refusal by one and a half in a hundred, either way. An answer that names real modules and real figures does better with interview practice behind it. With enough practice (40 or more), the screen marks the answers that would count against you.

::: tip Practice
Interview practice at the hub is an act like any other. It turns a detailed answer from a risk into a strength, and past 40 it shows you the weak answers before you choose.
:::

::: details Exceptions
- **Fake papers.** If the transcript you used was bought, the officer says the university has no record of it. Every answer to that question counts against you.
- **Unexplained money.** If more than three tenths of the funds you show came from unexplained sources, the officer asks about the large sum. Saying it was a gift from an uncle brings a follow-up.
- **Other commands still work.** Only ending the month waits for the interview.
:::

## The partner interview

A route that rests on a relationship (joining a partner in the UK, being sponsored by a spouse in Canada) ends in a different interview. Both partners answer five questions on their own, such as where they first met, what they did, how often they have met, what the other does for work and where they will live. The questions come from the pair's own shared record, and the answers are compared. While the interview is open, each partner answers from memory: the shared moments are hidden.

| Answers that matched | Result | What it does |
|---|---|---|
| 70 in 100 or more | Pass | Nothing more |
| 40 to 69 in 100 | Doubt | The refusal chance rises |
| Under 40 in 100 | Fail | Refused, for the relationship |
| A thin record that does not pass, or under 20 in 100 | Caught | Refused as a sham; every route into that country is shut for years, and standing falls |

::: warning A marriage for papers
The game lets you choose one. A thin record with answers that do not agree is how it is caught, and both lives carry the ban.
:::

::: details Exceptions
- A dependant with a long shared history is not called in at all; only a thin record is interviewed.
- When the other partner is a computer character, its answers are made when the interview opens.
- When the other player is away, a stand-in answers for them after a set number of real days, as a partner who lived the history would, so nobody waits for ever.
- If the bond ends before both have answered, the interview closes unscored and the application is withdrawn.
:::

## The other set pieces

| Set piece | When | Questions |
|---|---|---|
| The night meeting | After paying the road's deposit | One: get on the bus, or go home. See [The road](./road.md) |
| The truth | Three days north on the road | One: pay, call home, or find the migration agency |
| December at home | Once a year abroad, in December | Four, the first whether to go. See [Abroad](./abroad.md) |
| The certification exam | A nurse sitting her certification | Three, a pass at two |
| The talk | A developer giving a talk at the hub, once a life | One: how you start |

Every set piece holds the month the same way and shows how far along it is ("Question 1 of 3").

## Rules it rests on

- [Routes, schools and the interview](../../rules/route.md): route:application-fixes-figures, route:application-opens-interview and route:visa-refusal-chance and the set pieces.
- [The genuineness interview](../../rules/interview.md).
- [Activities and jobs](../../rules/activity.md): activity:waiting-months-build-profile (the certification exam and the talk).
- [Coming home](../../rules/return.md): return:december-visit-set-piece (the December visit).
- [The road](../../rules/road.md): road:road-night-allows-turn-back, road:road-truth-asks-more.
