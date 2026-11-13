# Chapters

> The prologue is a set piece (`prologue.md`), not a chapter.
> Kind: `chapter`. One current at a time. Background: `../design/01-concept.md` section 10.

A chapter is a short checklist that teaches one part of the game. Closing it fills the bank of turns (turn:refill-fills-the-bank). The bank never holds a month back (turn:month-turns-on-empty-bank); its one use is the bank-full notice (clock:full-bank-push-notification).

## Rules

**chapter:first-chapter-starts-current** A new character's current chapter is the first by order, and none is done.

**chapter:met-items-close-the-chapter** In the `chapter` phase, if every item of the current chapter is met, the chapter is done, the next by order becomes current, and the turn bank is refilled. At most one chapter closes in a turn, except on the flight (below).

- **`closesOn`.** A chapter whose entry names a `closesOn` item closes when that one item is met, whatever the others say. Chapter 3's is `granted`, because a grant is decision day whether or not the held funds lasted.
- **The departure turn.** The chapter phase also runs on the turn the character departs, so chapter 4 can close and the send-off card be made (chapter:send-off-card-on-close).
- **A grant closes the chapters up to decision day.** Once a route with a country is `granted` or `departed` (every route but the road; a partner's and a dependant's count), the current chapter is finished whenever its base comes at or before decision day by order, whatever its items say. The skilled worker's route has no variant of its own, and the base's items name the master's.
- **The flight.** On a turn such a route is `departed`, the chapters close in order up to and including the send-off in that same turn, each as its own close with its own refill. So the send-off card shows from the flight (chapter:send-off-card-on-close) even when the life flew from an earlier chapter.
- **Closes on a grant can reopen.** A close made by the grant, not by the items, rests on that grant. A grant withdrawn before the flight reopens it (chapter:done-chapter-stays-done).

**chapter:done-chapter-stays-done** A done chapter stays done, whatever happens to its items afterwards, with one exception: a chapter closed on a grant that is withdrawn before the flight is reopened.

- **Which closes are on a grant.** Those made by the grant clause of chapter:met-items-close-the-chapter or by the flight's chain, when the chapter's items did not close it. The `chapter/closed` event then carries `onGrant` (the route granted or flown), and the slice keeps `byGrant` (`{ chapter, route }`, absent while there is none) for those closes.
- **Reopening.** When `route/withdraw` (person:joint-collapses-with-bond) takes a dependant grant back to `known` while the character is at home and no route is granted or departed, the chapter phase that turn emits `chapter/reopened`:
  - the chapters closed on the grant are no longer done;
  - the first of them by order is current again, as the variant standing in for its base under the lean as it stands (chapter:chapters-follow-lean-route);
  - `byGrant` is cleared;
  - no chapter closes that turn;
  - no refill is taken back;
  - the report says: "The visa is gone. Back to {chapter}."
- **A flight makes the closes final.** Once the route is `departed`, the chapter phase clears `byGrant` (`chapter/sealed`) and nothing reopens.

**chapter:no-chapter-after-last** When the last chapter is done there is no current chapter.

**chapter:items-are-live-requirements** Items are requirements, checked against the state as it is. The view shows each item of the current chapter as met or not.

## Entries

| Order | Id | Title | Items |
|---|---|---|---|
| 1 | `chapter.find-your-feet` | Find your feet | `job`: have a job. `pay`: one month in any job. `heard`: have heard of a route of your own effort (the UK master's, care, talent or skilled, Canada's points, the Gulf contract: any of them). `known`: have looked into it |
| 2 | `chapter.build-the-file` | Build the file | `passport`: passport held. `transcript`: transcript held. `english`: a bachelor's degree, which is the master's English (route:degree-meets-masters-english), met from the start and shown ticked so the player sees the degree counts. `offer`: an offer from a school |
| 3 | `chapter.decision-day` | Decision day | `deposit`: deposit paid. `held`: funds covered for a month. `tb`: TB certificate held. `applied`: application sent. `granted`: the visa is granted |
| 4 | `chapter.send-off` | The send-off | `departed`: you have flown |
| 5 | `chapter.landing` | Landing | `room`: a roof (an open `rent` obligation, or `status.gulf-worker` held, since the employer houses the Gulf worker). `job`: a job abroad held one month. `status`: the first rule of your status read (the `status/is` requirement holds). `request`: the first request from home answered, read as ₦150,000 or more in naira, bank and cash together (a family request comes only then, "not when broke" in `offer.md`, and is answered or lapses within a month). `file`: a first mark on the credit file (credit 3 or more) |
| 6 | `chapter.secure` | Secure | One item, `secure`, an `any` requirement met by any one path: settled (a settled or citizen status held); home (a return `with-papers` or `by-choice` recorded); second (a route granted in a month after the latest return home) |

The Order column is each chapter's place in the journey. In the data, these six have orders 1, 2, 7, 12, 13 and 14. The variants of chapter:chapters-follow-lean-route take 3 to 6 (the file for care, talent, points and the Gulf) and 8 to 11 (their decision days). The engine reads the base's place in the journey, and each order belongs to one chapter.

A refusal leaves chapter 3 open. Its items come undone and can be met again: regrouping is part of the chapter.

**chapter:send-off-card-on-close** Closing `chapter.send-off` produces the send-off card.

- **What it holds.** The view's `card` carries the route, the japacity figure, the months played, the standing, and the three lines the player chose most: the activities with the most months in `activity.played` (activity:months-played-counted), counted up to the month the chapter closes.
- **How it is shown.** The interface renders it as an image sized for WhatsApp. The card is data in the view and is never stored in the state.
- **When.** It shows from the flight until the first month abroad ends, so its standing and its lines are the flight month's.
- **One card per report.** A chapter that closes in the same report as the send-off (the flight's turn, chapter:met-items-close-the-chapter) has no chapter card of its own; the send-off card is that report's.
- **Not the flight screen.** The flight shows the send-off scene (chapter:send-off-scene-in-beats). The card is offered as the keepsake of share:send-off-card-kept.

**chapter:long-game-after-last-chapter** Chapters 5 and 6 refill the bank as every chapter does. After `chapter.secure` there is no current chapter, and the view shows the long game (`goal.md`) in its place.

**chapter:family-marks-the-grant** The month the story's visa is granted, home marks it. `offer.family-send-off` opens once at the family house: `when` the story's route is `granted`, `maxTimes` 1, `chanceBp` 10000 while the condition holds (never by chance), `expiresAfter` 2. It is staged on the house, so both the nudge's asks and the house's own act reach it.

| Choice | What it does |
|---|---|
| `party` | A send-off at the house. Costs `tuning.chapter.sendOffNaira` from the naira by transfer, the bank first. Wellbeing +6, standing +4, network +3. A results line names who came |
| `dinner` | A quiet last dinner. Free. Wellbeing +3, standing +2 |
| `skip` | No time. Standing -2 |

If the offer lapses, it counts as `dinner`. Nothing else in the simulation changes; the plane still needs the held funds returned (route:deposit-secures-school).

**chapter:chapters-follow-lean-route** The chapters follow the way out the life leans to.

- **Variants.** A chapter entry may carry `route` and `variantOf`: it is then that base chapter's variant for one route of the player's own effort. When the base chapter's turn comes by order, the variant for the lean route stands in for it if one exists; otherwise the base does.
- **The lean route.** The first own-effort route the life has heard of or looked into (`route.uk-care`, `route.uk-talent`, `route.canada-points`, `route.gulf-contract`, else `route.uk-masters`), read again each time a chapter closes.
- **Choosing the plan.** The player may choose the way the chapters follow with `chapter/lean` (`route`: a way of the player's own effort that has been heard of and has a file of its own; only while at home and with no visa granted). It sets `chapter.chosen`, which is read before the time order. The Japa app names the plan ("Your plan: health care"), and another way's page says what switching would do to japacity, with "Keep mine" and "Make this the plan". The view carries `plan: { route, ways }`.
- **The grant decides the plan.** Once any route with a country is `granted` or `departed`, the chapters follow it, before `chapter.chosen` and before the time order. That route is the one flown, else the one granted, in content's order; a partner's and a dependant's count, as for the send-off (chapter:met-items-close-the-chapter). The lean command is refused from that point.
  - The current chapter is judged, and the next chosen, by the variant standing in for its base under that route (the base when the route has none), not by the variant that happened to be current. Its close records that variant.
  - The view's items (chapter:items-are-live-requirements) read the same variant, so the Japa app shows the right checklist.
  - The view's `plan.route` names that route too, and `plan.ways` carries it even when it has no file of its own, so the Japa app's "Your plan" and the Papers app's counts name the route actually granted.
- **Item words.** Each item's words say what it takes in a person's words ("Twenty-four months on the ward, then the council's verification"). The nudge's ways for them are in the city's table.
- **Same for every life.** The first chapter and the send-off.

The variants of `chapter.build-the-file` and `chapter.decision-day`:

| Way | Build the file | Decision day |
|---|---|---|
| care | `tenure` (24 months as a nurse, `activity/tenure` on `activity.job-nurse`), `verification` (`document.nmcn-verification` held), `sponsor` (a sponsor recorded, the gate step), `applied` | `tb`, `police`, `applied`, `granted` |
| talent | `portfolio` (`quality.portfolio` at the endorsement's bar), `endorsement` (the gate step), `applied` | `tb`, `applied`, `granted` |
| points | `eca` (`document.eca` held), `english` (the band at 60), `pool` (the gate step), `invited` | `police`, `applied`, `granted` |
| gulf | `passport`, `medical`, `agent`, `contract` (the gate steps; the passport first, since only the road leaves without papers) | `police`, `applied`, `granted` |

**chapter:view-says-closes-and-next** The chapter view carries:

- `closes`: true when the current chapter would close at this month's end as things stand (every item met, or the one item its `closesOn` names, chapter:met-items-close-the-chapter);
- `next`: the chapter that follows it by order with the lean as it stands now (chapter:no-chapter-after-last, chapter:chapters-follow-lean-route), or null after the last.

Japa shows the chapter ahead from these and keeps no copy of the order or the lean.

**chapter:first-chapter-mission-card** The first chapter opens as a mission card handed over by its person, once per life, in their voice. It shows the three things as sticker tiles, the reward as picture chips, the next brief faint, and Let's go (`../design/09-the-games-look.md` section 4).

- **Tile looks.** A tile has one look for each state:
  - done: recedes (a muted fill, its picture and words faded but readable, a tick and "Done" where its place stood);
  - to do now: stands out, filled and ringed;
  - to come: plain.

  A tick is never a badge in a tile's corner, which reads as a picked photo.
- **Things met before the handover.** A thing met before the brief is handed over stands first, done, its line saying where it happened instead of where to go: "At a send-off" for a way out heard of in the years before, "Already working" and "Already earning" for a life handed over in a job. The things still to do keep their order after it. The brief records which things those were with its mark. Nothing stands met that the player was not shown happening: the years' way out is said on the handover's page (prologue:printed-page-hands-over).
- **Same looks elsewhere.** The Japa app's log and the close keep the same looks and order.
- **Shown once.** A mark kept on the device beside the save and the person is written as the card shows, so a reload never shows it again. A new life shows it again.
- **Waiting for the place.** The card waits for the place's first frame and stands on the drawn place, dimmed as behind the chapter's close, never on a blank world. The wait is marked in the document (`[data-brief-pending]`), so the keep-this-life ask (account:guest-secures-the-life) and the browser suite's helpers wait with it, and nothing is tapped under a card still coming.
- **Later chapters.** A later chapter, in a life that has not played a month, opens with the same mission card: its opening line and its brief in the giver's words, with Let's go.
- **The close card.** A chapter that closes while the world is open comes back as the close card with every tick, the stamp, confetti and the next briefs as picture cards.
- **Words and log.** The brief's words are content's, keyed by chapter (world:nudge-says-one-thing). The Japa app keeps the log of the briefs carried and done (world:phone-holds-what-phones-hold).

**chapter:send-off-scene-in-beats** The send-off is a scene: six beats, seen once per life, from the airport's gate to the first ride abroad. Each beat is one screen with one yellow button and nothing else to decide.

1. **Departures.** The airport place dressed as the hall: the counters, the board, two people ahead in the queue, the family behind the rope. As the hall opens, Mama says the first of the airport's own overheard lines (place.md, `place.airport-lagos.overheard.*`). The button "Step forward" is tapped three times. Each tap moves the queue one place and brings one line in a bubble over the speaker's head: the cousin's (line 2), Papa's (line 4) and the character's own (line 5). Line 3 is nobody's and is not said. After the third tap the counter comes by itself. The scene adds one line to the airport's: Papa's at the gate, `place.airport-lagos.overheard.6` with its `.by` (city:place-words-are-text-keys).
2. **The counter.** The passport and the boarding stub (the stub of share:card-drawn-on-device, landscape) slide across as stickers. The flight chip shows what was paid (the flight's figure of route:departure-pays-flight, or "Paid by the employer"). The counter asks "Window or aisle?" as two chips that change nothing but the seat words. The stub carries no seat letter: the choice is kept in words, "By the window" or "On the aisle" (share:send-off-card-kept). The stub sticker is the share stub's own words (The send-off, Lagos to the city, the first name, the seat words), never a boarding pass, a gate or a seat code (share:card-never-looks-official). The button is "Take the stub".
3. **The gate.** The character at the gate's door with the plane in the window, the family waving behind (the cheer pose turned to a wave), Papa's line. The button "Board the plane" is the one act that sends `route/depart`: the flight is paid here and the chapter closes here (chapter:send-off-card-on-close, route:departure-pays-flight). So beats 1 and 2 change nothing in the life, and leaving the scene before this beat leaves the life at the airport. A small "Not yet" button, or Escape, leaves beats 1 to 3 with nothing sent, and the act opens the scene again from its start.
4. **The plane.** A cut of about three seconds (world:plane-cut-at-send-off): the night map, the plane lifting off Lagos along a dashed line toward the route's city, the city's name arriving on a sticker. Under reduced motion, a still with the name.
5. **Out into the place.** The landing is the route's first neighbourhood: the country's hub place in content (`place.peckham` for the UK, `place.calgary-north-east` for Canada, `place.deira` for the UAE, `place.castel-volturno` for Italy), at dusk, with that place's weather chip, the bag on the ground, someone at the stop saying the place's first overheard line (Peckham's "You just land? Welcome. It gets colder." is in content), and the country's staple pulling in.
   - The button is the staple's first ride, in words alone, with no fare and no figure: London, the red double-decker with the hub's name on its blind, "Get on the bus"; Calgary, snow, breath clouds, a pickup and the long flat road, the chip at minus twenty, "Get in the truck"; Dubai, the heat shimmer and the game's cream taxi, "Get in the taxi"; Castel Volturno, the bus along the Domitiana, "Get on the bus".
   - The person at the stop is each city's own look from the published cast, of the sex the stop's label names (an aunty in London, a neighbour in Calgary, a man at the corner in Dubai, a brother at Castel Volturno; `STOP_PEOPLE` in `apps/client/src/features/city/sendoff/plan.ts`). Never one person for all, and never the character's own look.
   - They stand at the character's own scale, never smaller. The stop's line hangs from a fixed foot above the character's head, so a longer line grows upward and never covers the face.
6. **The first ride.** Inside the ride, with the place coming at the window (London the top deck's front window and Rye Lane, the others their own road).
   - The ride's inside is the staple's own: the top deck with its pole and seats for London, the pickup's cab with its wheel and bench for Calgary, the taxi's back seat behind the front seats and the driver for Dubai, the Domitiana bus with its rail, handles and pole for Castel Volturno.
   - The character holds the bag: "So this is it."
   - The family's first messages ping in a stack, each whole, beside the character and clear of her: first Mama's, from the sender the game has (`chats.from.mum`: "You have landed? Have you eaten? Is it cold? Call me."), then the cousin's (`family.size-44.text`: "You have landed. Send pictures. Also the shoes you promised. Size 44."), then Terna's. The friend's ping ends on the staple she rides ("Even the bus stop." on a bus, "Even the taxi.", "Even the truck."), while the phone's Chats keeps content's one line.
   - The chip "Send-off card saved" with a tick (share:send-off-card-kept) stands in the scene's toast lane under the band, and the Phone's badge counts the pings.
   - The button "Ring the bell" ends the scene, and the life stands in the room abroad as after any flight. The landing's moment card (moment:outcomes-that-are-moments) waits while the scene shows and follows Ring the bell as the landing's stamp with its count of months; the scene does not replace it.

**Client only.** Beats 4 to 6 run on the client over the view after the reply. The simulation knows nothing of them, and a life reopened after beat 3 opens in the room abroad with no scene.

**Motion.** Every beat's motion is transform and opacity under half a second (world:motions-under-half-second), and still under reduced motion. The plane's lift of about three seconds (world:plane-cut-at-send-off) is the one longer motion.

**Counting.** The scene is never counted beyond the events the flight sends (analytics:client-sends-interface-counts has no key for it).

**The band.** The scene's own band shows the character's first name, the age, the beat's place and the money: naira before the plane, the country's money after. Its place line is never cut: the age stays whole and the place wraps to a second line.

**Loading.** The scene opens from the gate's act and from the packed bag at home alike. It loads in its own chunk (engine:first-download-has-budget) and is handed the game and the person by the city, so it pulls nothing into the first visit.

**Layout.** The scene's people stand at one scale and clear of its buttons.

- The yellow button, Not yet and the thumbs stand in a lane at the foot (`LANE_TOP`) that no person of the hall, the counter or the gate reaches into.
- In the hall the character stands last in the queue, the two ahead and she at one size, stepping up one place a tap to the counter. The clerks behind the three counters are smaller with distance, and the family behind the rope nearest.
- At the counter the officer behind the desk is smaller than the character, his head no higher than hers, and the Window and Aisle chips are above his head.
- At the gate the waving family stand above the lane, and Papa's bubble hangs above their raised hands, its tail at him, clear of his head.
- Every bubble's tail sits in its border with no gap.

## Opening and closing lines

The Find your feet line below is the fallback. Each life has its own opening line for that chapter, keyed `chapter.find-your-feet.open.<scenario slug>`, and a life from sixteen uses its path's (`prologue.degree`, `prologue.trade` and the others) in `packages/content/src/chapter/chapter.text.ts`.

| Chapter | Opening line | Closing line |
|---|---|---|
| Find your feet | "Service year is over. The allowance has stopped. Everybody is asking what is next." | "You have a salary. Now you know what you want: to leave." |
| Build the file | "A file is paper and legwork: a passport, a transcript, a score, a letter." | "The offer letter is on your phone. You have read it eleven times." |
| Decision day | "Now the money. Show it, hold it, and answer for it." | "Granted. You read the email standing up." |
| The send-off | "One suitcase, 23 kilos. Everybody has advice." | "The plane lifts over the lagoon. Lagos gets small." |
| Landing | "Cold. A room with a lock. A number that is not yours yet." | "You have a key, a payslip and a name on a bill. Nobody here knows your father." |
| Secure | "The clocks are long now. Keep the rules, keep the job, keep sending." | "Whatever this is, it is yours to keep. The door is open both ways." |

## Effects and requirements this kind handles

The part before the slash names the kind that carries an effect out or judges a requirement (`engine.md` section 5). The types are in `packages/sim/src/engine/types.ts`.

| Type | | What it does |
|---|---|---|
| `chapter/done` | requirement | The chapter is done |
| `chapter/plan` | requirement | The way the chapters follow is this route; with none heard of, the master's is read as the plan |
