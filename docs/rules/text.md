# Words

> Conventions for writing. The content check enforces the keys; the rules at the foot carry ids.

The simulation never holds prose. It emits a key and some numbers, and content holds the words. That keeps saves small, lets the words change without touching a save, and leaves room for Pidgin and other languages.

## Where words live

One file for each kind: `packages/content/src/<kind>/<kind>.text.ts`, a plain table from key to text. The interface's own words (labels, headings, sheets and each screen's lines) are in `packages/content/src/ui/`, one `ui.<screen>.text.ts` file each.

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
| A checklist item | `<route id>.item.<item>` | `route.uk-masters.item.funds` |
| A report line | `line.<kind>.<what>` | `line.wallet.short-count` |
| A rejection | `reject.<code>` | `reject.no-turns` |
| A place's name, blurb, signs and talk overheard | `<id>.name`, `<id>.blurb`, `<id>.sign.<n>`, `<id>.overheard.<n>`, in `place/place.text.ts` (city:place-words-are-text-keys) | `place.ojuelegba.sign.1` |

Numbers go in with braces: `"Salary: {amount}"`. The interface formats money, months and bands. The text never contains a currency sign next to a brace.

The content check fails when an entry has no name, a report line's key has no text, or a text names a number its line does not carry.

## Money on screen

- A line's money is a typed param, `{ currency, amount }` in minor units, never a bare number; the screen formats it in its own currency and in whole units of the major currency (whole naira, whole pounds). A bare number in a line is a count, a band or a point, and the screen never guesses money from a param's name. A ride's fare abroad keeps its pence or cents wherever the real fare has them ("£1.75" on the ride sheet, the ride's pill and the way's button), since a whole-pound bus fare would be a false price; every other sum abroad stays whole.
- A money screen, a line about money or a share card must never look like a bank alert, a transfer receipt or a payment app: no bank names, no "credit alert", no transaction references, no green tick next to a sum.
- Every share card (the send-off card, the real-story card, a lottery win) carries the words "Japacity is a game" in plain sight, and the game's own name as the sender.
- No share card carries a sum of money in any currency (share:card-carries-no-money): the lottery card says "won the Friday draw" and no figure.
- The big wins are staged, not listed: the first salary of a life, the visa grant, the first dollar salary, the send-off, the first pay abroad shown in naira, the December visit, a win on a draw. Their report lines carry `big: true` and the interface gives them a moment of their own.

## Voice

- Nigerian English, as spoken in Lagos. Short sentences. Dry, warm, never mocking the character.
- Second person, present tense: "You get the job."
- People talk the way they talk: "Come o", "abi", "my guy", "sort it". Use it where a person is speaking, not in the narrator's voice.
- Say the hard thing plainly. No moral at the end of a line.
- No exclamation marks from the narrator. No em-dashes anywhere.
- Money is always a figure, never "a lot".
- A first draft is plain and correct, and is rewritten for voice.

## Rules: joke versions, the family feed and the closers

**text:jokes-keep-a-plain-version** A common, neutral report line may carry three to five versions in `packages/content/src/comedy/`, one plain and the others carrying a joke; the plain version always exists, so a joke can be pulled without leaving a hole; every version carries exactly the plain line's braces; a draw picks the version (`versionKey`), and draw 0 is plain. The screens show the plain line.

**text:bad-news-never-joked** Bad news is written straight: no refusal, robbery, illness, loss, parting, doubt, return home broke, social assistance, anything on the road route and anything about being poor ever takes a joke version, and a month whose report holds bad news shows every line plain. The content check fails a bad-news line with versions, and simulated play proves no joke shows on the road or beside bad news. Jokes aim at situations, systems and luck, never at a people, a religion, an accent or a body.

**text:family-group-feed** The family group feed (`packages/content/src/family/`) is a small feed beside the news: forwarded prayers, a cousin's business, chatter, and the billing that starts once the family knows the character is travelling; at most one post a month; no post keyed to bad news; each fixed life's aunt and cousin named from its own people.

**text:officialdom-is-deadpan** Officialdom is deadpan: content holds a closing line for the refusal letter, the bank queue and the embassy page, each written completely straight (`official.<surface>.closer`, with the refusal letter's last line, `official.refusal.last`), and one worth posting for the japacity card and the decision card (`share.<card>.closer`). No screen shows them.

**text:bands-not-figures** A quality is said by the band it is in, never by its figure (a count of things that are things, the pieces in a portfolio, may be said in words: "two of three"), and the interface never says a system word for a thing a person would name: "Your family has a little behind it", "Living costs", "Time for three things this month", never "Family means up 32, to 32", "Upkeep" or "free slots". The bands are quarters of the quality's range, with words for each (`ui.band.<quality>.<n>`). A bond's head in Chats says a person's words, never "moments", "Costs standing" or "Ask them": "Nothing shared yet", "Once together", "Three times together", "Six more times together before you can ask" (a count in words up to ten), "Ask Dele" (a friend who plays is "your friend"), "Ending it will be talked about", "Ending it will hurt", "Nobody holds it against you"; the computer mark's word is "Not a player" (person:computer-candidates-labelled), shown as a person writes it, quiet, in its own case at 12 px, never in capitals; the ask's kicker over a person's name keeps the kicker's style every ask shares. No line of a quality's move names the quality or which way it went (never "Network up", "Wellbeing down", "Care skill up" or "Wellbeing settles"). Each move's report line carries its cause (`params.source`: the act, the answer, or `month`); an act's moves are one line in the act's own words where content has them (`line.quality.from.<source>`: "You know more people at the hub now", "Late nights on the project"), none where the act's own line already says it (an offer answered in its own words, the rest, the talk), and else each move in a person's words by its quality (`line.quality.told.<quality>.<gain|loss|worn>`), the month's drift by where wellbeing stands against rest ("You were yourself again"). A quality whose name is what a person names (English, the portfolio, land, the level of education) may be named. Lines never explain the system; they are a person's words: the month's drift down from a high is "The good mood from last month passed.", a card when the free time is all taken says "Your free time is full this month", and the master's held funds read "Funds held a full month, and still there". "Chapter" is never said to the player (a brief: "Done: {chapter}.", "Brief done", "You finished your first brief"). Other lines in this voice: "Next month any minute now", the agents' "someone else takes it", "We never sell months to play".

**text:hook-not-explanation** The first screen says what the game is about with a hook, not an explanation. Online, the start screen opens with one of three lines in two rows, picked once per visit (account:two-lights-and-wink-lines), with the whole game in three steps under it, an icon and a word each; Lagos is shown by the scene behind, never said in the line. Online the door under "Who are you?" carries no sentence, since the hook was just seen and the question and the fields carry the screen. Offline, where the door is the first screen, it opens with the one hook of the three that stands with no lights hung on it, "Japa is not by force. / How ready are you?", smaller than the start screen's so the looks stay in view above Next, and the three steps above the fields, in the start screen's style. On the start screen and the door alike the three steps are a label strip to read (small capitals, an icon and a word each), never chips that look as if a hand could press them.

**text:voice-by-surface** The voice, by surface. The band and the buttons: the game to the player, the act in the second person ("Next month", "Pay it", "Buy a ticket"). A card: the person asking, in their own voice, first person, in quotes where it is speech. The results: the past month, past tense, plainly, what happened, never what you felt. News: a happening in the world, present tense, never "you hear" or "people are talking", never advice; every story names its source with a small icon and a word (the radio, the paper, the official page, the street, or a person's name) and a rumour is marked as a rumour, so it never reads like a changed rule. A person's line: theirs, in quotes. The nudge: one thing to do, imperative, under eight words. No machine tells anywhere: no em-dash or en-dash, no stacked adjectives, no "delve", no mirrored sentences, no summing-up lines, no exclamation marks (a scam text's shout is a tell and the one exception), no "Oops", no "Get started", no word written twice in a row by mistake (a double people say, "now now", "sharp sharp", or a call with a comma, "Enter, enter", is speech and stays). A test walks every words table for these. An ask names who asks (content `offer.<id>.who`, shown as the pill over the title; Mama's own asks and the scam's "Unknown number" keep their stand-ins); its title is three words or fewer in the asker's voice, its line one sentence (the scam's shout excepted) with no percentage (a loan says naira on every ₦100,000); offices, firms, the school, the court and the bank speak plain English, the street, the conductor and family Pidgin where it fits; the words scan (`apps/client/src/cross-feature/never.test.tsx`) walks every table a player reads and renders the results, the asks and the map. Speech in an ask's line wears curly double quotes, never straight ones, whether the whole line is the person's words or a quoted part inside it; and the ask's mark carries the first letter of who the person is (B for "Your brother", C for "The conductor"), never the letter of "Your" or "The".

**text:account-words-plain** The account's own actions use the words every app uses, and one word for each idea: a guest's life put on an account is saved ("Save this life", "Save", "Saved"), and coming back to it is signing in ("Sign in"). The game's voice stays in titles and explanation lines, and "life" stays the game's noun. No player-facing line in the start, sign-in, account, invite or boards words says keep, kept, secure or secured for this; a test walks those tables.

The journey, not the wait: leaving is the point, but the months on the way are lived, not passed. A line never narrates the player as idle, in dead time or waited on ("your life is waiting", "nothing to do but wait", "while you wait", "still waiting on you"); it says what they do or what moves ("Payday first, then the meetup", "Back to your life: the embassy emails", "Asked of you"). A plain "wait for X" where X is truly on its way is allowed. A character's own words said in character stay theirs (the agent's "Just wait." is his lie). The term "the waiting months" (activity:waiting-months-build-profile, activity:side-jobs-pay-by-tier) stays a term of the rule pages and never stands on a screen. A scan over content's words, the interface's own among them, fails on the dead-time shapes and pins the lines that say what moves instead.

**text:show-then-tell** The interface's own words show, then tell. A fact is an icon and two or three words, with its state as a mark that differs in shape and colour, never colour alone, each mark with its word for screen readers (the shared `Mark`, `FactChip` and `ToneTag`); a gain or a cost is a tag with its sign, never a sentence; a thing said once in a box is not said again in the line beside it; a sheet's line is one line, and a second sentence is usually a chip, a number or nothing; full sentences belong to a person or a paper speaking (text:voice-by-surface), never to the shell; an act the scene shows gets no line (the figure lies on the bed, so nothing says "You lie down"); a person's words are theirs over their head, with no narration round them (world:things-are-tappable-models); plain beats compact when a chip cannot be understood without its sentence; nothing is smaller than 12 px but a label over a value. Each screen's test cites this rule for the words it shortens.
