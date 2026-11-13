# Words

> Conventions for writing. The content check enforces the keys; the rules at the foot carry ids.

The simulation never holds prose. It emits a key and some numbers, and content holds the words. This keeps saves small, lets the words change without touching a save, and leaves room for Pidgin and other languages.

## Where words live

Each kind's words are in `packages/content/src/<kind>/`, in `<kind>.text.ts`: a plain table from key to text. A large kind splits its table over several files (`activity.abroad.text.ts`, `activity.calgary.text.ts`). The interface's own words (labels, headings, sheets and each screen's lines) are in `packages/content/src/ui/`: `ui.text.ts`, and one `ui.<screen>.text.ts` file per screen.

| Thing | Key | Example |
|---|---|---|
| An entry's name | `<id>.name` | `activity.rest.name` |
| An entry's one-line description | `<id>.blurb` | `school.northgate.blurb` |
| An offer's title and body | `<id>.title`, `<id>.body` | `offer.roof.body` |
| An offer's choice | `<id>.choice.<choice>` | `offer.roof.choice.half` |
| An offer's sign | `<id>.sign.<sign>` | `offer.held-funds-agent.sign.office` |
| A news story at a stage | `<id>.<stage>.head`, `<id>.<stage>.body` | `news.naira-float.in-force.head` |
| A set piece question and answer | `<id>.q.<question>`, `<id>.a.<question>.<answer>` | `setpiece.credibility-interview.q.after` |
| A chapter | `<id>.title`, `<id>.open`, `<id>.close`, `<id>.item.<item>` | `chapter.send-off.close` |
| A chapter's brief, as the player is handed it | `<id>.brief.title`, `<id>.brief.giver`, `<id>.brief.reward.<n>`, with `chapter.brief.*` shared | `chapter.brief.giver` |
| A checklist item | `<route id>.item.<item>` | `route.uk-masters.item.funds` |
| A report line | `line.<kind>.<what>` | `line.wallet.short-count` |
| A rejection | `reject.<code>` | `reject.setpiece-open` |
| A place's name, blurb, signs and talk overheard | `<id>.name`, `<id>.blurb`, `<id>.sign.<n>`, `<id>.overheard.<n>`, in `place/place.text.ts` (city:place-words-are-text-keys) | `place.ojuelegba.sign.1` |

Numbers go in with braces: `"Salary: {amount}"`. The interface formats money, months and bands. A text never puts a currency sign next to a brace.

The content check fails when an entry has no name, a report line's key has no text, or a text names a number its line does not carry.

How the tables come together:

- `packages/content/src/index.ts` merges every words file into one `text` table with `mergeText`, which throws when two files give the same key, so one file never hides another's line.
- A new table in `ui/` is added to `textTables` there, so the voice test (`apps/client/src/cross-feature/voice.test.ts`) reads it.
- Words a first visit does not need (each country's places and rides, the painted maps abroad, the send-off) are in `ui/` files that content's `index.ts` never imports. The client fetches each on its own path (`@japacity/content/ui/london` and the others) when the life needs it (engine:first-download-has-budget).
- The client's `say` (`apps/client/src/shared/words/text.ts`) looks a key up in `text` first, then in a country's late words. A key with no words shows as itself, so a gap is seen in play rather than hidden behind a guess.

## Money on screen

- A line's money is a typed param (engine:report-money-is-typed). The screen formats it in its own currency, in whole units of the major currency (whole naira, whole pounds), and never guesses money from a param's name.
- Exception: a ride's fare abroad keeps its pence or cents wherever the real fare has them ("£1.75" on the ride sheet, the ride's pill and the way's button), since a whole-pound bus fare would be a false price. Every other sum abroad stays whole.
- One line says its money one way. Either every sum on it is in full ("₦738,000 of ₦2,010,667"), or a big sum is said short and rounded down ("₦2.5m"); a short sum stands only alone where room is tight (a stamp, a road's line), never beside a sum in full.
- **text:money-in-bank-words** Money moves in the words a Nigerian bank app and its users say: send, transfer, sent, received, paid, fee, charges, rate, balance, arrives, arrived, in the bank, as cash.
  - Credited and debited appear only as plain words in a line ("₦70,000 credited to your account"), never as an alert's label.
  - Never a writerly verb for a transfer: no "lands", "landed in your account" or "goes by app".
  - A fee or a loss is said in money or in a chance word, never as a percentage: "Fee £270", "No fee", "Sometimes it never arrives".
  - A money screen, a line about money or a share card must never look like a bank alert, a transfer receipt or a payment app: no bank names, no "credit alert" or "debit alert", no alert block (a sender, a reference, the balance after, a time stamp), no transaction references, no green tick next to a sum. "Sent" or "Paid" as a verdict stamp is a verdict, not a receipt.
  - This holds on every money surface: Send money home and the card after it, the month's results, Change money, the roads, the pace and the share cards.
- Every share card carries the words "Japacity is a game" in plain sight and the game's own name as the sender (share:card-contents), never a sum of money (share:card-carries-no-money), and never looks official (share:card-never-looks-official).
- Big wins are staged, not listed: their report lines carry `big: true` and the interface gives them a moment of their own. The list is luck:big-wins-are-staged.

## Voice

- Nigerian English, as spoken in Lagos. Short sentences. Dry, warm, never mocking the character.
- Second person, present tense: "You get the job."
- People talk the way they talk: "Come o", "abi", "my guy", "sort it". Use it where a person is speaking, not in the narrator's voice.
- Say the hard thing plainly. No moral at the end of a line.
- No exclamation marks from the narrator. No em-dash or en-dash in player text.
- Money is always a figure, never "a lot".
- Write a first draft plain and correct, then rewrite it for voice.

## Rules: jokes, the family feed and deadpan lines

**text:jokes-keep-a-plain-version** A common, neutral report line may carry three to five versions in `packages/content/src/comedy/`: one plain, the others with a joke. The plain version always exists, so a joke can be pulled without leaving a hole. Every version carries exactly the plain line's braces. A draw picks the version (`versionKey`), and draw 0 is plain. The screens show the plain line.

**text:bad-news-never-joked** Bad news is written straight. No refusal, robbery, illness, loss, parting, doubt, return home broke, social assistance, anything on the road route or anything about being poor ever takes a joke version, and a month whose report holds bad news shows every line plain. The content check fails a bad-news line with versions, and simulated play proves no joke shows on the road or beside bad news. Jokes aim at situations, systems and luck, never at a people, a religion, an accent or a body.

**text:family-group-feed** The family group feed (`packages/content/src/family/`) is a small feed beside the news: forwarded prayers, a cousin's business, chatter, and the billing that starts once the family knows the character is travelling. At most one post a month, no post keyed to bad news, and each fixed life's aunt and cousin are named from its own people.

**text:officialdom-is-deadpan** Officialdom is deadpan. Content holds a closing line, written completely straight, for the refusal letter, the bank queue and the embassy page (`official.<surface>.closer`, with the refusal letter's last line, `official.refusal.last`), and one worth posting for the japacity card and the decision card (`share.<card>.closer`). No screen shows them.

## Rules: how the interface speaks

**text:bands-not-figures** A quality is said by its band, never by its figure. The bands are quarters of the quality's range, each with its words (`ui.band.<quality>.<n>`).

- A count of real things may be said in words ("two of three" pieces in a portfolio).
- The interface never uses a system word for a thing a person would name: "Your family has a little behind it", "Living costs", "Time for three things this month", never "Family means up 32, to 32", "Upkeep" or "free slots".
- A quality whose name is what a person would say (English, the portfolio, land, the level of education) may be named.
- A bond's head in Chats says a person's words, never "moments", "Costs standing" or "Ask them": "Nothing shared yet", "Once together", "Three times together", "Six more times together before you can ask", "Ask Dele" (a friend who plays is "your friend"), "Ending it will be talked about", "Ending it will hurt", "Nobody holds it against you". Counts are in words up to ten, with a capital wherever one opens a sentence, filled in or not: "One don enter. Two more to go."
- The computer mark's word is "Not a player" (person:computer-candidates-labelled), shown as a person writes it, quiet, in its own case at 12 px, never in capitals. The ask's kicker over a person's name keeps the style every ask shares.
- No line about a quality's move names the quality or its direction (never "Network up", "Wellbeing down", "Care skill up" or "Wellbeing settles"). Each move's report line carries its cause (`params.source`: the act, the answer, or `month`):
  - an act's moves are one line in the act's own words where content has them (`line.quality.from.<source>`: "You know more people at the hub now", "Late nights on the project");
  - none where the act's own line already says it (an offer answered in its own words, the rest, the talk);
  - otherwise each move in a person's words by its quality (`line.quality.told.<quality>.<gain|loss|worn>`);
  - the month's drift, by where wellbeing stands against rest ("You were yourself again").
- Lines never explain the system; they are a person's words. The month's drift down from a high is "The good mood from last month passed."; a card when the free time is all taken says "Your free time is full this month"; the master's held funds read "Funds held a full month, and still there". Other lines in this voice: the agents' "someone else takes it", "We never sell months to play".
- "Chapter" is never said to the player. A chapter is a brief: "Done: {chapter}.", "Brief done", "You finished your first brief".

**text:hook-not-explanation** The first screen says what the game is about with a hook, not an explanation.

- Online, the start screen opens with one of three lines in two rows, picked once per visit (account:two-lights-and-wink-lines), with the whole game in three steps under it, an icon and a word each. The scene behind shows Lagos; the line never says it.
- Online, the door under "Who are you?" carries no sentence, since the hook was just seen and the question and the fields carry the screen.
- Offline, where the door is the first screen, it opens with the one hook of the three that needs no lights: "Japa is not by force. / How ready are you?". It is smaller than the start screen's, so the looks stay in view above Next, and the three steps stand above the fields in the start screen's style.
- On the start screen and the door alike, the three steps are a label strip to read (small capitals, an icon and a word each), never chips that look pressable.

**text:voice-by-surface** The voice, by surface:

| Surface | Voice |
|---|---|
| The band and the buttons | the game to the player: the act in the second person ("Sleep", "Pay back", "Buy a ticket") |
| A card | the person asking, in their own voice, first person, in quotes where it is speech |
| The results | the past month, past tense, plainly: what happened, never what you felt |
| News | a happening in the world, present tense, never "you hear" or "people are talking", never advice. Every story names its source with a small icon and a word (the radio, the paper, the official page, the street, or a person's name), and a rumour is marked as a rumour, so it never reads like a changed rule |
| A person's line | theirs, in quotes |
| The nudge | one thing to do, in the imperative (its length and choice: world:nudge-says-one-thing) |

No machine tells anywhere: no em-dash or en-dash, no stacked adjectives, no "delve", no mirrored sentences, no summing-up lines, no exclamation marks (a scam text's shout is a tell and the one exception), no "Oops", no "Get started", no word written twice in a row by mistake. A double people say ("now now", "sharp sharp") or a call with a comma ("Enter, enter") is speech and stays. A test walks every words table for these.

Asks:

- An ask names who asks (content `offer.<id>.who`, shown as the pill over the title). Mama's own asks and the scam's "Unknown number" keep their stand-ins.
- Its title is three words or fewer in the asker's voice. Its line is one sentence (the scam's shout excepted) with no percentage (a loan says naira on every ₦100,000).
- Offices, firms, the school, the court and the bank speak plain English; the street, the conductor and family speak Pidgin where it fits.
- Speech in an ask's line wears curly double quotes, never straight ones, whether the whole line is the person's words or a quoted part inside it.
- The ask's mark carries the first letter of who the person is (B for "Your brother", C for "The conductor"), never the letter of "Your" or "The".

The words scan (`apps/client/src/cross-feature/never.test.tsx`) walks every table a player reads and renders the results, the asks and the map.

**text:account-words-plain** The account's own actions use the words every app uses, one word per idea: a guest's life put on an account is saved ("Save this life", "Save", "Saved"), and coming back to it is signing in ("Sign in"). The game's voice is in titles and explanation lines, and "life" is the game's noun. No player-facing line in the start, sign-in, account, invite or boards words says keep, kept, secure or secured for this; a test walks those tables.

### No waiting words

Leaving is the point, but the months on the way are lived, not passed. A line never describes the player as idle, in dead time or waited on ("your life is waiting", "nothing to do but wait", "while you wait", "still waiting on you"). It says what they do or what moves ("Payday first, then the meetup", "Back to your life: the embassy emails", "Asked of you").

- A plain "wait for X", where X is truly on its way, is allowed.
- A character's own words said in character stay theirs (the agent's "Just wait." is his lie).
- "The waiting months" (activity:waiting-months-build-profile, activity:side-jobs-pay-by-tier) is a term of the rule pages and never appears on a screen.

A scan over content's words, the interface's own included, fails on the dead-time phrasings and pins the lines that say what moves instead.

**text:show-then-tell** The interface's own words show first, then tell.

- A fact is an icon and two or three words. Its state is a mark that differs in shape and colour, never colour alone, each mark with its word for screen readers (the shared `Mark`, `FactChip` and `ToneTag`).
- A gain or a cost is a tag with its sign, never a sentence. A cost an act takes from the body or the mood is a tag with a down arrow in a person's words ("tires you", "wears you").
- A sheet's line never carries a figure, a chance or a time that a chip shows. An act's facts stand as chips in one order (`FACT_ORDER` in `apps/client/src/shared/words/facts.ts`: pay, chance, time, when it pays or answers, a bill over months, a fee, a rate, where it counts, a catch), its changes as arrow tags and its needs as marks.
- Facts are chips. An icon row (the shared `Facts` in its rows) stands only where a chip cannot carry the fact: a long fact that cannot be two or three words, or the dense lines inside a card that lists several things.
- A thing said once in a box is not said again in the line beside it.
- A sheet's line is one line; a second sentence is usually a chip, a number or nothing.
- Full sentences belong to a person or a paper speaking (text:voice-by-surface), never to the shell.
- An act the scene shows gets no line (the figure lies on the bed, so nothing says "You lie down").
- A person's words are theirs, over their head, with no narration round them (world:things-are-tappable-models).
- Plain beats compact when a chip cannot be understood without its sentence.
- Nothing is smaller than 12 px (world:reach-and-read).

Each screen's test cites this rule for the words it shortens.
