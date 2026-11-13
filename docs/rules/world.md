# The world first

> Rests on `../design/07-the-world-first.md` (sections 2, 3 and 6), `city.md`, `text.md` and `engine.md`. city:places-change-no-state, city:place-shows-only-the-view and city:overheard-talk-from-view hold here.
> Kind: none of its own. These are rules for the player's screen, the places' files and the content that ties the story to places. The game's rules code holds nothing for them.

This page is for anyone building or testing what the player sees: the place fills the screen, the player does everything by tapping something that is there, the support pages live in a phone, the map is the city, the story leads, and there are no forms.

On a desktop, the screens before the world (the door first, prologue:front-door-three-screens) use the room a wide window gives and never stretch the phone:

- nothing scrolls the page;
- every option a step has shows at once where there is room;
- the one action stays in one place;
- the steps are always in view and can be gone back to;
- the keys work (the arrows, Enter).

The world keeps its centred column (world:world-fills-the-screen), and the phone keeps its handset.

## Rules: the screen, the top band and the nudge

**world:world-fills-the-screen** The world fills the screen. Over it sit only a top band, two thumb buttons at the bottom corners (Map at the left, Phone at the right, round and white with a picture each, in the centred column on a laptop), and a rise of japacity passing up for a moment (world:japacity-bag-by-door). Nothing sits under the band by default (world:nudge-says-one-thing), and nothing else is on screen until the player taps something. A sheet, the phone, the map and the results each open over the world and close back to it; the world stays visible behind a sheet. A moment (a chapter's card, a share card) may take most of the screen while the world stays visible and moving behind it, dimmed. One tap dismisses it, and sharing is offered, never required. Before the first month of a life is played, the current chapter's mission card (chapter:first-chapter-mission-card) opens over the dimmed world.

**world:top-band-is-a-pill** The top band is a rounded pill, white by day and navy at night (decision 0025). It carries no pages, no count and no Next month (decision 0011), and nothing on it ends the month (world:sleep-ends-the-month). It holds:

- **The name.** The character's name comes first, with the age and the place's name small under it. A tap on the name or the age opens the data page (prologue:front-door-builds-a-person). The age is the character's age in years and months; twelve months make a birthday.
- **The status line** beside the age. It names the body in words only when it complains: "Hungry" under thirty belly, "Tired" under thirty energy, "Hungry, tired" for both (quality:body-belly-and-energy). Never a figure.
- **The month's chip** beside the name. It says the world's part of the day in words (Morning, Afternoon, Evening, Night) from the clock view's `world` (clock:game-day-on-real-time), moving on the device each minute, never a clock time in digits. The month's name in it is screen-reader text only (month 0 is the calendar month the life began in, from the authority). The month's spent time does not show. A tap on the chip opens the phone's Calendar app.
- **The money**, as a green counter that counts when it changes.

Months and dates:

- No running month number shows anywhere a player sees: not on the phone, the results, an ask's deadline, a slip or a chat heading. A deadline or a wait reads as months away ("in 2 months", "next month"); a past month reads as months ago.
- The chip under the band says the soonest thing coming. A tap on it opens the Calendar app on its coming list, soonest first, each as months away: an ask's deadline, a paper on its way, a visa decision, the next birthday, and a route's age limit once it is within three years. It lists only dates the player can act on or is waiting on, never the whole calendar. Each row opens where it is dealt with (a paper or a wait in Japa, a due in Bills), and an ask names the place where it is answered.
- The phone's wallpaper shows the real date and time, since the world runs on the real calendar.
- The results sheet leads as world:month-end-results-sheet says, with the age small beside it. On the twelfth turn it says the character turned a year older.

The second row and fitting words:

- The band is one slim row. A handle under it opens a second row with the nudge and what is coming soonest. While closed, that row peeks for a few seconds whenever its words change. The handle shows only while something is coming; the nudge line needs no handle.
- The band shows nothing more, except a guest's "Not saved" chip under the money (account:guest-reminded-to-secure). A secured account's band and the local game's band carry none.
- A tap on the place's name does nothing.
- Words fit their boxes and labels never cover each other. The band names a long place by its own short name (`<place>.short`), the ride's title wraps to a second line, the page's chips wrap, and the things' labels over a place are lifted clear of one another.
- The place line for a home names its kind in a few words, at most 24 letters, short enough to stand whole beside the age and never cut with an ellipsis:
  - "Your room, Ojuelegba" for the room in a compound;
  - "Your hostel room, Yaba";
  - "The family house";
  - "The room on the water" for a life in Makoko, in a scene that does not name itself, and "Your room, Makoko" in the room on the water itself;
  - abroad, the room's short name of world:painted-maps-abroad.
- A place of several scenes shows each scene's own short name from its file (`stage.name`) instead of the place's or the home's: "Makoko" on its channel, "Viewing centre", "Net shed" and "Smoking deck" behind their doors (city:makoko-holds-five-scenes).
- Nothing anywhere says "slots", "3 of 3 things planned" or "takes no slot".

The game opens something by itself only as the answer to the player's own tap: never unprompted, and never over a walk, a moment or a sheet. A teach is one small card the player dismisses. The same measure holds for every screen that opens by itself.

**world:nudge-says-one-thing** The nudge says one thing: the next thing to notice. It is chosen from the view in this order: an open set piece or interview question; an open offer; the chapter's next undone step, in its own nudge words; a report line waiting; else the month's end. It is one sentence of at most eight words, from content, and never two lines. Nothing sits under the band by default: only an ask waiting, a due abroad and the night's bed keep their line there, and the report and the month's end wait on the phone.

The journey's step in the world:

- The step shows in the world only at two moments. For about two seconds after a brief is handed, the chip under the band shows the brief's picture and title, then slides into the Phone thumb, whose Japa icon takes a dot until the app opens. And while the player is at the step's place or beside its person, the chip shows with its three dots and the marker of world:things-are-tappable-models stands on the thing or person; a done thing ticks its dot with a pop and the giver's toast, for as long as a toast stands. Leaving the place removes it.
- The chip says which brief; the marker says what to do.
- While the first brief's card or a chapter's close stands, the band's second row waits: no chip and no nudge under the band repeat what the card already says. The chip comes once Let's go has carried the brief.
- The briefs' words live in content beside each chapter (`chapter.<id>.brief.*`, with `chapter.brief.*` shared), read by the client: the title with a wink, the giver and where they stand, the rewards, the two-word place under each thing, the toasts, and which thing is lit as now (the one the nudge names). The place under a thing is where that life does it, the stop the nudge sends it to: the racks for a life in Makoko's room, the clinic for a nurse, a trade's motor park, a trader's stall, else the chapter's table. The interface keeps only its own words.

Showing and tapping the nudge:

- The nudge hides while a sheet, the phone, the map or a thing's fan is open. It comes back by itself when that closes, by a tap anywhere outside it, its sheet's close or Back (Escape), never needing a tap on the floor.
- A tap on the nudge opens the way to what it names:
  - the asks, when a question or an offer waits;
  - for the chapter's step: the acts of the thing that does it when that thing stands in this place, the map with its stop picked when it is elsewhere in the city, and the Calendar app when the step is the month's end. The step's places are the interface's table in `nudge.ts`. The thing the nudge points at pulses gently at its mark (world:things-are-tappable-models);
  - the phone's News, when a report line waits.
- The step's marker over the thing is itself a tap target: its pill picks the thing as the chip's tap does (`followStep`), so a person standing in front of the thing never takes the tap meant for it.
- The first chapter's "Look into it" names and opens the page of the life's own way out once it is heard of (a trade's Gulf, the first meetup's fit for a degree, guide:first-meetup-hears-fitting-route), so the chapters follow that way (chapter:chapters-follow-lean-route).
- Go on the opening words and Go on the chapter's sheet take the step's way, as a tap on the nudge does.

What the nudge says for a step:

- A step already started names the wait instead of the act: a paper on its way says when it comes; a school applied to says when it answers; a hunt or a test planned says to end the month; a paper or an application planned this month says so (`.planned`); funds short of the line say how much more to show. These are the story's `.started`, `.planned` and `.short` words for the step.
- A step is taken when its act is planned or done this month (a hunt at a board, the racks or the clinic, the shop opened, a test sat, a paper or an application sent), or when its paper or a school's answer is on its way. A taken step's way is the month's end: neither the chip nor the marker stands on the thing that took it, and a tap on the nudge opens the Calendar, while the brief still lights that step as the current one. The month after, a step its act did not meet (a hunt that missed) gets its chip and marker back.
- A step the player cannot afford names the gap and a way to the money (a better job, a gig, the family) instead of the act, and its tap opens the jobs board, where the money is. Once a hunt for better pay is planned it says so, and once the job's pay covers the gap within a month it says to work and save. Every step whose act costs naira has its own gap and payday words, so a step the naira held cannot pay is always nudged as the shortfall, with the board as its way, never as the act.
- While a paper is on its way, a better-paid job on the board comes before "work and save", and so does the life's own waiting-month act (activity:waiting-months-build-profile).
- Once News has been read for the month's report, "the month's news is in" goes.
- A hunt planned abroad, or while a job is held, says the application is in.
- A hunt missed last month, with other jobs on the board, names another way.
- The nudge never points away from a job whose months a way out counts (the nurse's, route-gates:care-route-needs-verification), and a job offer says what taking it ends.
- With no chapter step left, the nudge is the nearest open goal's first act (goal:view-shows-goal-items).
- When a tuition instalment was already missed and the next is not covered, the dues come before any ask and say the visa is at stake.
- When held funds block the plane, the nudge says what blocks it and goes to the bank's counter.

Abroad:

- Whenever the month's dues in the country's money are more than that money held, the gap comes before the step, every month: the report nudge names the gap and opens the Bank at the change. The dues count the month's pay coming in before the bills.
- A step with no place in the world is a line only, and a step's way opens as at home: the map with the stop picked.

When there is no fare, the nudge names a free step instead of the step. This happens when the money held where the character is cannot pay the cheapest ride this month and the step's stop is too far to walk:

- The money held is the naira at home or the country's money abroad, cash and bank together.
- The cheapest ride at home is the cheapest way's flat fare under the month's fares. Abroad it is the cheapest of the country's ways' flat fares, which is nothing in a month the pass covers a way or at a stop the employer's shuttle serves.
- Abroad, walking distance is measured with the country's own `lonMetresPerE3`.
- The free step is, in this order: walking home whenever the character is not at home, however far; the racks, for a life in Makoko with no job; a job on a board within walking distance. Its tap opens that way.
- At home with none of these, the step itself is named, since the long walk out of home reaches it (place:rides-between-city-places). "End the month" is the free step only for a life with no home to walk to.
- The ride sheet opens on the first way whose fare the money held pays, so with no fare a stop on foot opens on Walk.

Papers, needs and calls:

- A step whose act is a call or a message (world:phone-holds-what-phones-hold) says "on your phone" in its nudge words. A tap opens the phone's Papers app on that act's card, wherever the player stands.
- The passport's step names the passport office (world:phone-holds-what-phones-hold) and goes there like any visit.
- A step shut by a need names that need's own act and opens it (`<step>.needs.<quality>`): the coding course at the hub's desk for tech, the portfolio's work there for the pieces, the hub's meetup for the people who will write. "Apply for the endorsement" opens the endorsement's own card at the desk, and the meetup's step opens the meetup's own card, in one tap.
- A need whose act is already in the month's plan or carries on in it ("Ongoing") is passed over for the next need. With every need's act running, the step says the plan is set (`ui.needs.planned`), and its tap opens the Calendar.

The care file:

- The nurse's certificate counts on the care checklist (route-gates:care-route-needs-verification), so it is a waiting-month act. In the months on the ward it comes first, and while a paper is on its way it comes before the paper's wait. It is named only while the naira held pays for it; otherwise the nudge gives its gap and payday words (`ui.nudge.meanwhile.nurse-certification.short`, `.saving`). Its tap opens the certification's card on the clinic's notice, in one tap.
- The TB test is never pointed at before the file's other steps are met. At the care application and the care decision day it comes after the passport, the English test, the police paper, the sponsor at the bar and the window. At the talent decision day it comes after the passport it needs.
- The sponsor step reads the window. While health care is shut to applicants abroad, no sponsor takes a nurse, so the nudge says so ("Care sponsors are closed: keep the file ready"). Its tap goes to the file's next paper that can be got now: the passport, then the English test. It never goes to the decision day's TB test or police paper: both run out, so they are taken last, and their visa centre opens on the map with the decision day (world:map-is-painted-lagos). With no such paper, the tap goes to the certification's card while she can pay for it, else to the Calendar. Once the window opens, the sponsor step reads as any other.
- The nudge never says how many months until the window opens: the client is sent only the world of the current tick (clock:client-gets-current-world-only), and online a tick is not a month.

The talent file's nudges follow the order in which its papers must be met and paid for:

1. The passport comes first, at its office, in any step of the file, while it is neither held nor on its way. While it is on its way, the file's own work goes on (the portfolio, the endorsement's needs), and a step waits on the passport only when nothing else in the file can be done.
2. The endorsement is named only once the passport is held and the naira held pays for the endorsement, the TB test and the application together, at the bank now with its charge, so both can follow while the endorsement is valid (route-gates:talent-visa-needs-endorsement). Short of that, the nudge names the gap ("Find ₦X more before the endorsement", with the board as its way).
3. With the endorsement held: the TB test, then the application, and short of its fee, the gap.

A step whose act the news has shut (the route's window closed, route:closed-window-blocks-applying) says so plainly, never "needs more": "Every route is closed for now" while every route with a window is closed (the pandemic), else that way's own words ("The talent route is closed for now"). Its tap opens Japa, whose locked chip says the same and to watch News, so no desk is pointed at for an act that cannot be taken.

**world:thumb-buttons-carry-dots** The Phone button carries a dot when an app has something new (world:phone-rises-over-scene). The Map button never carries a dot. Both hide while riding and while the results show. A wide home adds a round button over Phone, "See another side", which turns the house a quarter (world:room-seen-down-its-length). It steps back while a sheet, the phone, the map, a fan, the sleep or the home's card is up.

### Why both screens

The game is built for a phone and a desktop alike. In September 2026 phones were 75% of web traffic in Nigeria and desktops 24%; in the United Kingdom, where many of the people this game is about live, desktops were 42% ([StatCounter, Nigeria](https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/nigeria), [United Kingdom](https://gs.statcounter.com/platform-market-share/desktop-mobile-tablet/united-kingdom)). The browser tests run at both sizes.

## Rules: things, acts and sheets

**world:things-are-tappable-models** A thing is a model copy in a place that the player can tap, declared in the place's file with its label and the entries it stages. A tap on a thing, or on its mark, opens its fan (world:fan-of-sticker-buttons), never a chip.

- An act with no cost and no story just happens (sit). An act with a pose shows on the thing at once: the character sits on the chair, lies on the bed.
- Rest is not an act: the bed and the couch offer Lie down and the chair Sit, done at once with the pose and no slot, since an empty slot already rests (turn:free-slots-per-month).
- An act that costs money or moves the story opens its sheet, whose one button says the act itself, never "add to month".
- A job on a place's board or stall is an act whenever the hunt lists it, whether or not a job is held (the board stays once hired, and its card says why a hunt is shut). Its sheet is the hunt's card with that job named.
- Held funds still open are paid back at the bank's counter through the command act `obligation/pay`.
- A choice inside an activity that no thing has made (which job, which school) opens the picker, never a card that takes the first.
- The kiosk's "Buy a ticket" makes its choice, one ticket, so its slip opens. More tickets are picked on the slip and sold at once (activity:now-acts-and-month-acts).
- The street kiosk is the one thing whose sheet changes with the world: online it sells the Friday draw (lottery:draw-runs-online-only).
- The papers box has one act, Look in the box, which opens the phone's Papers app (world:phone-holds-what-phones-hold) and tells no line in the corner.

Marks, names and the marker:

- A thing shows no label by default. Each interactive thing carries a quiet mark at its anchor: a small still dot (6 px, the theme's signal colour at about 60%). The thing the nudge points at pulses gently.
- A thing's dot stays on its thing whatever names show. Only a name shown over it moves, lifted clear of the other names and of every dot, at most two rows above its own dot. A name with no room within two rows waits unshown while its dot stays, so no name floats into the sky over a place seen whole.
- A person keeps a name over the dot only while holding an ask or as the nudge's target; otherwise a person shows the dot, like a thing.
- The first time a place is entered in a life, every name shows for two seconds and fades. This happens once per place per life, kept on the device beside the save.
- The step's thing or person carries the marker: a white pill with two words and an arrow, a soft bounce and a yellow ring at the feet. The marker never stands on the joint, the barber, the suya man or the club.
- A month-act (`docs/design/03-structure-and-conventions.md` section 1) started at a thing carries on (world:month-acts-carry-on): its fan shows it (world:fan-of-sticker-buttons), and the thing's name says "Ongoing" whenever the name shows.
- A tap on the player's own figure opens nothing, no card, and the nudge stays (the data page is on the band's name, world:top-band-is-a-pill).
- A person's or a shopfront's card closes on a tap anywhere outside it or on Back (Escape), and the nudge comes back by itself. The card sits at the foot of the screen as the sheets do, never under the band.

Speech, told lines and toasts. People speak where they stand, and nothing narrates over the world. No card stands across the middle of the world to tell what happened or what someone said.

- A person's words float in a bubble over that person in the scene, off-white with their name small above the words (Mama's "You have eaten? Sit small.", the agent's "Not today.", the visa officer's "Nothing for you today.", Mama's "God bless you. Light is back." when the light bill is paid at home). The bubble follows the camera, is held inside the screen and under the band, hides while the person is behind the camera, shows one speaker at a time for about four seconds (world:street-talk-budget), and goes on a tap.
- What an act does to the world is told in the bottom corner (world:street-talk-budget) in one short line in the third person about the world ("Mama presses a bag of oranges on you.", "In the box: the passport.", "The parcel is yours."), never narrating the player's own act.
- An act the scene shows (sit, rest, cook, fetch water) gets no line at all (text:show-then-tell). A planned act is its thing's state, never a line.
- A toast slides in under the band and out again, on transform and opacity (world:motions-under-half-second). It stands long enough to read: at least four seconds, plus a second for every twelve letters past forty, and it holds while a finger or the pointer rests on it. What a toast tells is also in News. The toasts are:
  - money in from the player's own act: its picture, the act and the figure on a green pill, with a coin flying to the band's counter (`MoneyToast`);
  - the interview's close (`SaidToast`);
  - an act done at once that answers in the place (activity:now-acts-and-month-acts).
- Such an act starts at the tap: its sheet closes, and the toast says it in a few words, with the act's picture and name and, where an answer is to come, when it comes as a tag ("Look for a job" with "Answer at the month's end", "Apply for a passport" with "Comes in 3 months"). The toast names the act as its card does, so a job a board names in its own words is named by them, with its own picture (the racks' Start work toasts "Work the fish racks", never "Look for a job"). There is no sheet and no Done, and the place's own line for the act is kept in News.
- One toast answers one act. Where the act meets the brief's step, the brief's tick and its giver's toast answer it; where money comes in, the money toast does.
- An act's answer stands as a sheet, with one button, Done, only where it carries what the player must see to choose: the kiosk's ticket and the bet slip, as their slip; the paper bought (with the kiosk's own word once the month's tickets are all sold); the driver's answer when asking around, which names a way out; and a grant made at once (the Graduate visa).
- The brief's giver speaks through the brief's chip (world:nudge-says-one-thing), and the market's delivery is a note at the top of the Market app (world:phone-rises-over-scene).
- Money going out is the price the player tapped and has no toast. A stop reached or a refusal ("Your free time this month is all planned") is a line told in the corner.

The room's acts:

- The room's things carry the acts that answer at once (activity:acts-may-repeat-in-month, decision 0011): the cooking corner's meals, a fan button each (world:fan-of-sticker-buttons); the drum's water and bath; the bed's nap; a TV on its stand; Mama's gist and her shop; the table's study, course and portfolio. Every repeat act is staged at the family house and at the home lived in (the interface's `byHandAt`). Cooking and the water answer at once (obligation:cooking-and-fetching-water).
- Each act answers where it stands, for a few seconds, growing in and out on scale only: steam, drops off the drum, the screen's flicker, the lantern turning up, the figure lying down. A repeat act's line is told every time, Mama's over her head.
- A thing's act may keep hours: `parts` names the parts of the world's day it is open in (clock:game-day-on-real-time, decision 0012, streets:lagos-street-spending). Outside them the act is not offered. A thing left with no act keeps one shut button on its fan saying when it opens ("Opens in the evening"), and its tap tells why in the corner, in the thing's words. So the viewing centre and the joint open in the evening and at night, and the street has a shape.
- The sun and the sky light of every place follow the world's clock (clock:game-day-on-real-time): a low warm sun in the morning, full light in the afternoon, an orange sun low on the other side in the evening, and a navy sky at night with the bulb and the lantern as warm points (`stage.light.lamps`), eased over about 600 ms. `?clock=morning|afternoon|evening|night` pins the part, in development only.

**world:fan-of-sticker-buttons** The fan (decision 0025, `../design/09-the-games-look.md` section 3). A tap on a thing opens no chip: every thing fans its acts out of the thing itself.

- The acts are round sticker buttons along a curve that sweeps sideways and down from the thing into the larger free side of the screen (a radius of 170 px on a phone and 200 on a laptop). Up to six show, with a seventh peeking and a drag along the curve. The buttons follow the thing every frame and spring in 40 ms apart. A refusal shakes the button and plays the low double note.
- Now-acts (`docs/design/03-structure-and-conventions.md` section 1) are priced buttons: the act's picture as a tile inside a sticker, a name pill outside the curve and the price pill alone (no balance pair, no legend). A sheet act whose entries are all now-acts splits into one button each. While a button is pressed, the band's counter shows what would be left, and settles back when released.
- Any other act (a pose, the bed's Sleep, a sheet that opens a card, a command, out, enter, ride, an app, a word with someone) is a button with the act's own label and its tile or a glyph drawn for its kind (`shared/tiles/Glyph.tsx`: sit, lie, sleep, pay, papers, pack, out, in, talk, look, ride, home, stop, shut), with no price and no Free.
- The thing's name stands in a pill over it, with the person's mark where the game plays them. A thing with no act shows its name alone.
- A planned act is a shut Ongoing button with a Stop beside it (world:month-acts-carry-on). A spent act's button is shut and carries the words of activity:spent-body-refuses-acts.
- With no room beside the thing, or more than eight buttons, the tap opens the activity sheet (all now-acts) or a small sheet of the same buttons (`FanSheet`).
- A tap follows the act's own way: a now-act is sent on arrival; a pose poses; Sleep opens the first-night card or sleeps; a card opens after the walk; a command sends; out opens the map.
- The fan is the same in every build; no address turns it off.

**world:one-action-one-sheet** One action, one sheet. No sheet is a wall of words, and the words come only when asked.

Rows and chips:

- A row in a list says its name and one figure, on a line that never wraps. Anything else to know folds behind a tap on the row (the needs of a job out of reach, the details of a bill).
- Every act's facts are chips, never a sentence, in the order of text:show-then-tell, with its changes as arrow tags and its needs as marks, so its line holds none of them.
- A picker of several acts is rows with one button in the foot. Each row shows an act's picture, name and facts. A tap picks a row, and only the picked row shows its line, what it still needs and any choice inside it (a route, a university). The one button does the picked act, with its price and the balance before and after under it.
- What a job still asks is said as chips, never a sentence: months in a trade as a progress chip ("2 / 18 months") with the jobs that count behind a tap, and each other need as a chip with its mark, a cross while unmet and a tick once met. This covers Jobs' next rung and side job, and the Bank's roads, whose tap is the road's and which show the chips without the fold.

Asks:

- An ask that belongs at a place (the family's send-off at the house, chapter:family-marks-the-grant) is answered there. Away from it, the asks sheet says someone is waiting at that place, and its one button goes there: the map with the stop picked.
- A sheet takes the form of what it shows: a card for an ask or a choice, or a paper slip with a torn edge for a paper thing (a bill, a ticket, a receipt).
- An ask shows the asker's name pill and mark, a title in their voice, one line, and the replies as rows with the cost on them.
- The small line over a sheet's title, its kicker (who asks, the place, the clock), starts with a capital: "The clinic" over the card where a sentence says "at the clinic".
- The asks sheet is named for who asks (the asker, the set piece, the interview). Over the ask's own card, whose name pill and title are its head, that name is for a screen reader only, so no heading such as the nudge's "Answer the person asking" stands over a card.
- An ask that may be a scam has no main button. Its answers are plain, the free ones first (advice:scams-show-their-tells).

Buttons:

- Every sheet has one main button, and a way to say not now.
- The title names the thing. The main button says the act's verb in one or two words, in sentence case with no full stop at its end, with its price where it has one ("Sit exam · ₦120,000" under "Sit the certification exam", "Apply" under the job named, "Collect" under "Parcel for you"). A noun is added only where the verb alone reads oddly ("Sit test", "Book flight"). Never a bare "it", and never the title again.
- Each act's button words are content's: `<id>.button` beside its name.
- A button with no title over it keeps the act's full name: a round button of the fan and its name pill, a row in a list, the small sheet of a thing's acts.
- A button's name for a screen reader holds its visible words.
- The sheet rises from the bottom; the top of the scene stays in view. The words come from content.
- The month itself is not a sheet (world:month-acts-carry-on).

**world:back-closes-topmost** The browser's Back (a phone's back button or gesture) and the Escape key close the topmost thing the player opened, one at a time: a sheet, an app on the phone and then the phone, the map, a ride's sheet before the ride starts, and a step of the start screen, the age screen or the door. Each opening adds one entry to the browser's history and each close by the game's own control removes it again, so Back never steps through things already closed. With nothing open in the world, Back leaves the game as it leaves any site. Back does not close a ride under way, the cut into a place or the send-off's beats: there it waits until the beat ends.

**world:sheets-one-frame** Every sheet has one frame: a handle that closes it when dragged down past a third of its height or flicked down, and one close button at its top right with a hit area of at least 44 by 44 CSS pixels. Tapping the handle does nothing else.

- The handle, the title and the close stand in a head that never scrolls. A sheet's main button, where it has a foot, stands in a foot that never scrolls either. Only the body between them scrolls, so on a 375 by 667 phone neither the close nor the main button leaves the view.
- A step inside a sheet (a change, a confirmation, a way out) takes the body as its own view, with one Back to the sheet and its heading taking the focus. It never opens under what already stands there. A short question about one row (removing a passkey, signing out on every phone) is asked in that row's own place instead.
- One step or question stands at a time: opening one closes any other, and a refusal goes with the step it came in.
- On a laptop every sheet rises in the centre.

**world:lazy-part-fails-softly** A part of the client loaded on first use (the map, the bag, the send-off, the maps abroad and any other) that fails to load leaves the world up and shows the connection card ("Could not connect", engine:browser-authority-for-dev-only) with Retry, which loads that part again. The broken-screen card is kept for real faults.

- **Retries.** A part the world's first load waits on (the place's scene and the bag) is fetched again after 1 s and 3 s, as a failed view is, before the card shows; Retry fetches it at once. Once the world is up, those parts are fetched ahead while the connection is idle. When the connection comes back, a request that failed because of it is tried again once.
- **The life's screens** (everything drawn once a life exists, one part apart from the start screen: engine:first-download-has-budget) are a part the world's first load waits on. They are fetched ahead when the start screen is idle. They are fetched at once, even when the player asked the browser to save data, where the browser keeps a person or the life mark, or where the account the game read as it started has a character; the place's scene and three.js follow in the same chain.
- **The life mark** is `japacity.life.here` in the browser's storage: "1" or nothing, and no account data. It is set when a life opens in the browser, from a kept person or from the account's character. It is removed when the browser is left with no life to open: signed out (by the player, by a deletion or by the server), told the account has no character, or after a life ended with none chosen after it. Only the fetches ahead read it, never the choice of a screen, so a stale mark costs one early download of the life's screens and never a wrong screen.
- **Preloading.** Where the browser keeps a person or the life mark, the page also names the life's screens to the browser as it loads. A small classic script, written by the build into the page itself ahead of its first script and stylesheet, only adds preload links to the part's own hashed files, so they download beside the first screen's code with no round trip of their own. A browser with neither is told nothing. While they come, the opening splash stands with "Opening your life...", never a blank.
- **Old builds.** A tab left on an older build asks for parts a release removed. When a part still fails after its fetches again, and the page the server serves now (read once, with no cache) carries a build (`<meta name="japacity-build">`) other than the page's own, the page reloads once to it instead of showing the card. A mark in the tab's storage keeps that to once until the life's screens load. With the builds equal, or either unread, the card shows as above. The reload keeps what the player has: online the life is the server's, and the door's run, the person and the month in play are kept on the device (engine:browser-authority-for-dev-only).

**world:reach-and-read** Every control a player taps has a hit area of at least 44 by 44 CSS pixels, made with padding where the drawn shape is smaller.

- Text, and any line that carries meaning (a refusal, a free or taken name, a cannot-pay), meets a contrast of 4.5 to 1 against its ground, by day and by night. A control's edge or icon meets 3 to 1.
- Text is at least 12 CSS pixels.
- Every label sits whole inside its control, with the same inner space at its edges as its neighbours have, at 375 by 667, 390 by 844 and 360 by 780 CSS pixels, by day and by night. A segmented choice whose labels cannot stand on one line wraps its longest label rather than run past its pill.
- Keyboard focus shows a ring at least 2 px wide in the game's own colours.
- Under an open sheet or the start screen, the scene behind is inert: no Tab stop and no tap.
- Under Reduce Motion, a bar that shows time passing steps once a second instead of standing still or jumping to full, and nothing turns on its own.

**world:field-says-its-state** Every field the player types into or picks an answer in (the username, the character's name, the email, the code, the age answer, the light's name and years, feedback, an amount) says its state the same way, calm and never alarming, through one shared line (`FieldNote` in `apps/client/src/shared/ui/`).

- Its parts stand in one order: the label; the help line under the label, saying what the field is for, in the quiet ink (`text-2`), never bold, with no icon and never in a state colour; the box; and, directly under the box, the one state line, at most one at a time.
- A problem with what the box holds (a refusal, a shape the box does not take, a name taken, a wrong code) is a line in the out colour, at the bold body weight a free name's line uses, with a small circle-and-mark icon (lucide's `CircleAlert`) before it. While it stands, the box is marked invalid (`aria-invalid`) and described by the line (`aria-describedby`), and its edge takes the out colour, with the yellow focus ring drawn outside the edge so both read.
- A good state (a free name) is the tick in money in's colour, at the same weight.
- Colour never speaks alone: the icon carries the state too.
- Nothing is noisy: no filled banner, no shake, no icon on help.
- Both inks read on the sheet by day and by night (world:reach-and-read).

**world:costly-acts-confirmed** An act that throws away something the player paid for or cannot get back asks once more and names what is lost: turning back from a ride (its fare), removing a passkey (and that phones signed in with it are signed out), and leaving a guest life. The safe choice is the main button; the costly one wears the warning colour, never the main yellow, and sits apart from it. Starting a new life asks for a press and hold (account:start-a-new-life).

Priced acts:

- A priced act's button says its verb and its price ("Cook · ₦1,500" under "Indomie and egg"). Under it stand the balance before, struck through, and the balance after beside it. Nothing moves until the tap.
- No act, ride or the kiosk says "₦X left". "₦X short" is the one exception: when the cost cannot be paid from the naira in cash and bank, less what the month's plan already pays for, the main button is shut and says how much is short.
- After a fee in another money, the balance after is the naira the band reads after it, with the cash counted, though only the bank buys the foreign money.
- The phone's own asks (change money, send money, a bill) keep their words.
- The main button's second line says "Now" for an act that happens at once (a ride, the deposit, the plane); otherwise it says that the act counts when the month ends.
- A reason from the world that stops the act (held funds open before a flight) shuts the button, which says only "Not yet", and the reason stands once on the card.
- The sheet says the time the act takes in words (activity:now-acts-spend-half-days) and what it does in words ("fills you", "rests you", "lifts you", "+2 English").
- Chips earn their place. A price shows only where there is one. Free shows only on an act a player would expect to pay for, never on sleep, a bath or water, and never beside a price. The time shows only when it is more than a morning. At most two effect chips show.

Bands and counts:

- The English band a sheet or a result names is the plan's route's own, read from that route's content (its file's English item, whose figure each route's page gives). So the file, the centre's "Sit the test" sheet and the result ("That meets the route's 5.5.") say one figure. With no plan, or a plan that asks no band (the master's, whose English is the degree, route:degree-meets-masters-english), the sheet and the result say the band alone and name no route's figure.
- The asks sheet's count is the asks still waiting, "1 of 3" over three; with one left there is no count. Over a set piece (the exam, the visa interview) the asks sheet's header holds no count and says where the player stands: the set piece counts its own questions ("Question 1 of 3"), so only one counter stands.

**world:month-acts-carry-on** The month plan has no page and no sheet. A month-act the player starts from its thing (a course, study, the portfolio, practice) carries on every month until the player stops it, from the Stop on its thing's fan or from the Calendar app, or until it ends itself: the view no longer allows it, it can no longer be paid for (a course finished, a way shut), or it was the search for a job now held.

- The client keeps these commitments across the month's end (every pick still allowed and paid for that is not a now-act) and sends them with each month's `turn/end`. The game's rules code keeps no plan of its own.
- An exam of one sitting (the nurse's certification) leaves the plan in the month it runs, pass or fail, so it never carries on. A failed exam is sat again, and paid for again, only by a new tap on its card.
- An exam of several sittings (the chartered exams, document:trade-papers) is studied between its sittings and carries on until it is stopped or its paper is earned.
- Every other act, `once` or not, carries on. `once` means at most once a month (activity:waiting-months-build-profile): the master's at home runs twelve months of one slot.
- A life's free time is the month's half-days (turn:month-lived-in-half-days, decision 0011), spent by hand.
- The Calendar app shows the job; each commitment that carries on, with its Stop (with none, one empty dashed slot that says to tap a thing in the world, and no line on how carrying on works); the chores done this month; and what is coming. It has no free-time rows and no Next month.

**world:month-end-results-sheet** The month's end opens one results sheet over the scene, however the month was ended (world:sleep-ends-the-month). It is short, and it leads with the money. It shows, in this order:

1. **First and alone, when there:** the visa's answer when the month's lines hold it (the line that leads alone, `leadsAlone`, as the hero card), and the room on the water cleared away (home:makoko-eviction-draw).
2. **The money.** Payday (the salary line) as a card with its picture when there is one, and rent when due as a chip, each labelled with what it is ("Salary, junior developer", "Rent") beside its figure, so the amount is said once. Then what the month kept or lost, Kept in green or Down in quiet ink (a loss is never the loudest thing), with the changes and tags under it. Then the savings bar toward the move.
3. **The people asking.** Each ask still open, as a face: the asker's mark and name with the ask's own title (`offer.<id>.title`), or for an offer of work the job it names and its pay a month, the soonest due first. A tap on a face closes the results and opens that ask's card. No line says "Something new needs an answer".
4. **The month's events** that changed what the player holds or answered what the player started, in the story's order: a stamp reached (right after the visa granted line, wallet:savings-stamps), a bill unpaid, a bond ended, a job or a side job got or ended, a hunt's answer, what an act came to, the adviser's reading, a school's, a sponsor's or a route's answer, a paper come, gone or banded, a status, the interview's outcome, an ask left to lapse (in its own words), the cash warning, the draw's outcome, then the chores (food cooked, water fetched). Three are shown, and the rest are behind See the whole month, a link that opens them in the sheet.

The money's bar:

- A check against a target (the funds a way asks to see) is a bar with both figures under it, what was shown and what is needed, and a stamp with the verdict ("Not covered", "Covered"). In a month with a check, the check's bar stands in the savings bar's place, so the sheet shows one figure for the money held.
- With no funds to show, the bar toward the move says how ready in a band word (`readyWords`), never a figure.
- A month in which no money came or went says so in words of money, "No money came or went", in Kept's place, never "+₦0", and only when the sheet has nothing else to tell. With a face, an event, the draw or a paper running out to show, nothing stands in Kept's place and the sheet goes on to them.

What the results leave to News:

- The rest of the month lives in News only: what an act already said in the place (a page read, a paper or an application sent), a way out heard of, a chapter or a goal, an ask answered in its own words (told in the corner as it was answered), the set piece's opening and close, the hunt's offer whose employer stands among the faces, and news for you.
- Nothing the results say is missing from News, and no line points to the phone in words.
- News tells each of the month's events once: an act done at once by its place's own line, never "Done this month" beside it; a hunt's offer by its own line, never "Something new needs an answer" beside it; an exam by its mark, never "is over" beside it.
- An ask that came up as the day was lived (decision 0012) and was answered then is not told again at the close.
- There is no "Done this month" for an act that answered at once, no living line at home, and no list of every naira in and out (News and the Bank keep those).

Also:

- The draw's numbers show with any matched one lit, then one button returns the player to where they are.
- The morning's first result is a white card on the lock screen, with the others under Also this morning.

Changes of money:

- Kept is the month's net of wallet:months-kept-counted, so a change of money counts for nothing either way and the bank's charge stays money out.
- Each change of money in the month has its own line under Kept, in the order made, both sides as they were, saying what went at the rate, without the charge ("Changed ₦1,022,058 into £561": naira into pounds or dollars, or back; with the FX man, what was handed over). It is quiet and plain, never like a bank alert (`text.md`), and it replaces the plain "changed" tag, so the change is said once (text:show-then-tell).
- The bank's charge is counted once, as its own money line, money out, in the results' words ("The bank's charge for the change: ₦15,331."). So Kept plus each change is the band's move (for example Kept +₦69,336, a change of ₦1,022,058, the band down ₦952,722). A charge too small to show as a figure has no line, and Kept still counts it. The client's telling of a change (`shared/words/money.ts`) counts the charge once too.
- A purchase whose foreign side waits in the bank's queue is told by its own line in the month it is paid in, with no changed-into line, since only one side is on that month's lines.
- All of this is read from the report lines; the game's rules code and the view hold nothing more for it.

Papers, draws and offers:

- A paper asked for whose result is out in the same month (a test's band) is told once, as out, never with "on the way" beside it.
- A month in which a lotto ticket was bought says the draw's outcome in words, never only the ticket's tag: the kiosk's draw among the month's events, after them and before the chores, never cut by a full month (luck:kiosk-sells-lotto-tickets); and the Friday draw's "Your ticket did not win." under its numbers in the month its result comes (lottery:draw-result-on-front-page).
- An offer's answer whose effects move a quality says what came of it in one line.

News afterwards:

- The month's report lines stay in the phone's News app afterwards. News puts money that went unpaid first, as the results do.
- News tells the month in the results' own words: every line the results tell, and none that contradicts them. A paper a route judges says only when the answer comes, never that it should be ready.
- News never lists the lines of the years before (a grade, a quality up or down, their money); the years are told once, on the page.

## Rules: the camera and the place

**world:camera-always-raised** The camera is always raised, never at eye level and never straight down.

- One finger turns the view within the place's limit.
- The pinch zooms, and on release the zoom snaps to one of two states: the whole place, or close on the character. For a wide home the close state is a room, not the character.
- When close, a chip offers "See the whole place". It stands only while the world is free: it steps back under a card, a sheet, a share card, the chapter's close, the first brief's card, a fan, the first-night card and the sleep, and while a line of the player's own stands in the corner, so it never shares the foot with that line.
- Every place file declares what the whole view looks at, how wide it must be, its pitch far and near, and its turn limit, so the whole place fits whatever the screen's shape.
- A place file whose turn limit is 360 turns the full circle and rests on quarters (the wide homes). There a vertical drag is a second one-finger gesture, tilting toward the view from above, still raised and never straight down.
- Entering a place always shows the whole of it.

**world:nothing-roams** Nothing roams: the character moves only by the walk of city:tap-to-walk, and route-finding and strolling stay off. Nothing between a tap and its result takes longer than about a second and a half. A fan button's act follows once the character has walked to the thing, whatever its kind.

**world:place-is-one-screen** A place is one screen.

- An outdoor place is a frontage of about 24 metres. An indoor place is a room of about 16 by 9 metres seen down its length (world:room-seen-down-its-length), so it fills a portrait screen, with its two far walls and no roof.
- That size does not bind a home. A wide home is an exterior place of about 13 by 13 metres (the family house, with its yard and carport) or an interior (the compound room's house, sized in home:compound-room-is-a-home, and the hostel, about 9 by 8), seen whole and walled as world:room-seen-down-its-length says. Its yard fences stand 2.1 m.
- Makoko's small scenes (city:makoko-holds-five-scenes) are seen whole as a wide home is. The room on the water (about 5 by 4 metres with its porch) and the viewing centre (about 6 by 4.4 with its porch) are interiors with their near walls at the knee. The net shed's deck (about 6 by 4.4) and the smoking deck (about 7.2 by 5) are half-open exteriors.
- People: at most 6 outdoors and 4 indoors in low mode, 10 and 6 in high. The send-off party keeps its ten and its dancers.
- Moving sheets: at most one per place, none in low mode.
- A half-open scene (a deck or a shed under a roof with open sides) is held to the outdoor limits.
- The place check enforces these limits and the sizes.
- The Inverter Room (`place.yaba-hub`) is dressed as its own room, not the hub's: rows of small laptop desks with their stools on a grey floor, the inverter with its two batteries on the side wall, a standing fan, the chair, the notices and the door. So the hub and the Inverter Room are two pictures.

**world:faces-never-share-height** No two horizontal faces in a place stand within one centimetre of the same height; anything laid over the ground sits above it or draws with a depth offset. A model the place stands lifted or lowered (`lift`, assets:metre-units-and-origin) is read at the height it is drawn at. The shadow camera covers only the place, with a bias and a normal bias set. It reaches about half the scene's own floor plus a margin (never less than 8 m either side, never past the city's 24), since a wide home's floor is wider than a place's width. The place check fails a file that breaks the first sentence.

**world:entering-is-a-cut** Entering a building is a cut: the screen goes dark for under half a second and the room opens as its own scene. "Step outside" cuts back. The same cut carries every scene change except the ride.

- A place may hold several scenes, each its own file under the one place (Makoko's channel, room on the water, viewing centre, net shed and smoking deck, city:makoko-holds-five-scenes).
- A door names the scene it opens (`inside` on its act, else the file's own `stage.inside`) and lists the things that stand behind it (`leads`). So a nudge that points at one of them from outside points at the door instead, and the night's nudge points at the door of the room where the bed is.

**world:opens-where-last-stopped** The game opens where the player last stopped, or at home.

- Where the player last stopped includes a room and a scene: a reload made inside opens in the same scene, not outside. Only a move to another place steps back outside.
- Home is per country: the family house in Nigeria, and the room abroad once the character lands.
- The family house is a place on the map with a position. It has no inside: it is one wide house seen whole from above, and a reload at home opens on the house whole.
- The people of the story (the partner, a friend, the family) have homes that are places the player can visit.
- The family house stays on the map for every life in Nigeria, home or not, a little from the home spot, so the people met there (world:nobody-picked-from-list) can be reached from a room in a compound or in Makoko.

## Rules: the map and the ride

**world:map-is-painted-lagos** The map is the city seen from the air: one painted Lagos drawn as SVG at two zooms (decision 0026).

Folded and open:

- Folded, the map is a strip at the top over a neighbourhood card beneath. The strip shows the lagoon, the bridges, Makoko, the stadium, the towers and the toll gate, with a dot for the neighbourhood you are in, a house for home and a yellow dot for the step's place. It carries the city's landmarks drawn upright and its fold panels, so it reads as the whole city folded.
- The card is the same drawing zoomed to fit its district, with pager dots and a swipe between the nine neighbourhoods: Ikeja, Yaba, Ojuelegba, Surulere, Bode Thomas, Ebute Metta, Makoko, the island, Lekki.
- A tap or a drag down on the strip unfolds the whole map in about 280 ms on transform and opacity (a fade under reduced motion). A tap on a district or a pin folds it back to that card. On a laptop the open map fills the screen over a row of three cards.
- The open map's head row and stickers fade in over the unfolding's last 160 ms, ending as its 280 ms motion ends, so the open map stands whole at the motion's end whenever the fold is told it has settled. Its drawing is not redrawn while it moves.
- While the map's code loads, a small running bar (engine:browser-authority-for-dev-only, named "Getting the map ready") stands where the close button stands, and the close stays so the player can leave.
- The map opens on the card of the neighbourhood you stand in, or on the step's card when a step is live. While open it pauses the place underneath. It is put away while a ride plays.
- The night paint darkens the ground and the roofs, lights a few windows among them (never more than 320 on the whole paper, and none by day) and the bridge lamps, and makes the stickers glow.
- The stops list is for screen readers (world:painted-maps-abroad).

Places and names on the map:

- Only built places are on the map, each marked been, can go, or not yet. Unbuilt places are not on it.
- A stop the story has not reached shows as not yet until its chapter is current or done, so the first map holds the places that matter now: the test centre and the agent's office before the file is built; the bank's office, the clinic and the visa centre before decision day; the airport before the send-off.
- A stop where a life's own first step is opens before its chapter does (the nurse from sixteen: the clinic, where her job is).
- A rented room or the hostel is on the map only as the home lived in (city.md's rows; `shared/world/rentedHomes.ts`).
- Every built place is its own sticker of its tile, and the sticker is the pin. A ring shows only on the stop picked and on the step's place. Where the player stands is a blue dot with a soft halo at the place's foot, with its name.
- A name shows on those, on home, and, on a neighbourhood's card, on a place already visited, moved clear of the names already there. A card also names at most three places never visited, nearest its middle first and only where the name fits whole on the part seen (`NEWEST` in `paper/World.tsx`). The open map and the strip name no other place, visited or never visited.
- Here, home and a picked stop that meet are moved clear of each other (down, up, then aside).
- On a card, a name that matters whose sticker stands near the card's side moves in from that side until it stands whole inside the card, never cut by the card's edge.
- A district's name painted on a card is left off where the card's title pill would cover it or the card's edge would cut it, so no name runs under the pill or stops at the edge (`cardLabels` in `paper/CardView.tsx`).
- Places sit where content's positions put them, through one whole-number fit from latitude and longitude to paper (`features/map/paper/fit.ts`), with a small fixed spread where neighbours crowd.

The city from the air:

- The streets carry their side lanes. The land between them is packed with small roofs in rust, brown and zinc, with a rare faded blue or green, each lit on its top and left side on a card. The roofs are thickest at the heart of each neighbourhood card and looser toward its edges, never more than 5,000 on the whole paper. Land far from any road stays open. The water keeps its gentle waves.
- The roofs, the lanes and the waves come from a seeded layout cut into the paper's 120-unit squares. Each square is laid from the layout's skeleton (the roads, the lanes and the places a block may stand along them) and its own seed alone, so the same seed gives the same city whatever order the squares are laid in. Each view draws only the squares it shows; a square's roofs are one path per colour, held once, and the lit edge is drawn from the same paths.
- The layout is laid in idle slices of a few milliseconds while a view of the map stands, the squares the card in front or the open map shows first. It is never laid in one long task, and never while the map is put away. The land, the water, the roads, the names and the stickers stand at once, and each square laid while a view stands fades in.
- The roads are drawn by kind, pale like tarmac in the sun on dark warm earth: the expressways and the bridges widest and palest, the main roads narrower, the streets a narrower grey and the lanes bare grey tracks. The main roads and the expressways stand at 3 to 1 or more against the ground, by day and by night.
- The lagoon is a murky green-brown and the sea a deeper blue, with a lighter line along the shore. Parks are a dark muted green.
- A few streets carry their names along them, the names content already holds for them (Herbert Macaulay Way, Ikorodu Road, Adeniran Ogunsanya Street, Bode Thomas Street, Broad Street, the Marina, Allen Avenue, the Lekki-Epe Expressway, Eko Bridge, Carter Bridge). They are set at 12 px, bend with the road, and show only where the whole name fits on the part seen and clear of the stickers.
- Every name painted on the map (the districts, the streets, the water and the bridge) is near-white at the face's heavier weight over a dark halo 6 px wide, so it reads over the roofs and the roads at 4.5 to 1 or more, by day and by night.

**world:one-country-at-a-time** One country at a time. A dropdown names the country shown; the others are listed locked, with the reason (no visa yet, not in this life yet). A locked country cannot be opened from the map. The dropdown's list opens away from the edge its pill stands on: upward from the folded map's foot, and downward from the top of the open map and of the list abroad, so every country is on the screen and can be tapped. Once the map unfolds, the open map's menu at the top is the only one.

**world:ride-sheet-shows-fares** Picking a stop opens the ride sheet: the place's picture with its name and a state chip; the ways as picture tiles with the fare and the time under each (a way out of reach greyed, with its reason); the balance before, struck through, and the balance after; and one Go naming the way and the fare.

- The ways and their fares are those of place:rides-between-city-places, at the pace `tuning.city.ride` gives.
- On foot is the slowest way. Past the walking limit of place:rides-between-city-places, a stop says "Too far to walk". The ride's minutes are display only and its scene can be skipped, so a free walk everywhere would make every fare pointless.
- Where that rule lets a life with no fare walk home or out of home past the limit, Walk stays open and plays long. With a fare in hand, that Walk is greyed, saying "Too far. You have the fare", and the sheet opens on a ride.
- While the car stands at home, Drive comes first on the sheet, with the car's tile, "Drive there" and the fuel as the fare.
- The fare is paid through the command `place/ride` (place:rides-between-city-places), and the ride plays only once it is accepted.
- At the stop where the character stands, the button says "Stay here" and closes the map with the sheet, back to the place.
- A danfo, a keke or an okada standing in a place is a thing whose act opens the same ride sheet.

The ride:

- The route draws as a dotted yellow line along the roads, with the sticker of the way picked on it: on the card within a neighbourhood, on the strip across the city, and on the open map whenever it is open.
- The ride plays as a short scene seen from above for about six seconds, with a progress bar and Skip. Arrival is told in the corner with the place's name.
- The ride carries people. On the okada, a pre-roll of at most a second and a half shows the rider astride and the character climbing on as pillion, with one line from the rider; then both ride. The keke has its driver and the character on the back bench. The danfo's pre-roll is outside at the stop with the conductor's line, and the ride then cuts by itself to above, the window and the seat (world:ride-cuts-between-angles). On foot the character walks. The pre-roll counts inside the six seconds, and Skip ends it all at once.
- A walk to or from home past the walking limit plays longer than a ride, the walk's own picture for about twelve seconds, and cannot be skipped: it has no Skip.
- The drive is the car seen at the kerb and then from above, with the player inside behind dark glass and no figure drawn. The boy who parks you out has his Pidgin lines.
- The card says where you are as the ride goes (pulling out of the place left, a road line, the stop named near the end), on the ride's own clock. On foot its first line is the walk's own ("Setting off from Computer Village on foot."), never that it pulls out, the long walk included.
- The card carries Turn back beside Skip: the character gets down at the next stop and walks back, and the fare is gone.

**world:ride-cuts-between-angles** The ride cuts between its angles by itself: outside at the stop during the pre-roll, then from above, then, for the danfo, the window and the seat, each for a share of the ride's seconds on its own clock.

- The danfo's window is seen from the aisle, out of one sliding window: the yellow pillars, the rail across it, the street sliding past. The seat is seen from a back seat: the row in front at the edges, the roof, the dashboard, the road through the windscreen.
- On a keke the view is out of its open side from the bench; on an okada, the rider ahead and the open street.
- The cuts are the cut of world:entering-is-a-cut (a short dark, never a slide across the screen), and no setting changes the angles.
- The card's where-you-are lines follow the ride's clock. Once the danfo's ride cuts from the window to the seat, the card's road line moves on to the next, so the two angles never carry the same caption.
- Skip and Turn back act as on any ride (world:ride-sheet-shows-fares).
- A slow frame never jumps the ride ahead (the step is clamped). A frame up to a second long counts whole, so a slow but steady device keeps the ride's pace and still shows every angle (no frame is longer than the shortest angle). Only a frame past a second (`STALL_MS`) is a stall, and it moves the clock one step.
- The ride still ends once the wall clock has run its length plus three and a half seconds (`RIDE_SLACK_MS`), so a slow phone never holds the player in the ride.

**world:lantern-canoe-on-map** The lantern canoe. On the open map of Lagos (world:map-is-painted-lagos, the paper map), one canoe is moored on the open water of the lagoon north-east of the Third Mainland Bridge, where nothing is staged and no ride goes, with a lantern at its prow.

- By day it is one more canoe of the water's decor, with a warm dot. At night it is the one light on that water, its glow drawn above the night paint so it never goes out.
- Its spot is `[6515, 3425]` (`LANTERN_CANOE` in `paper/geometry.ts`), clear of the open map's close button at every opening. It keeps a constant size on screen at every zoom, scaled like the place stickers. Its glow is the shell's `glowFill` (world:colours-are-role-tokens).
- It is not a stop: no board, no name, not in the stops list nor among the map probe's stops, never on the strip or a card, never the target of a ride, and no route crosses it. No wave is drawn within 22 units of it.
- When the open map's first look from a card would show only part of the canoe, or put it under the head row, the look moves by the least that brings it whole into view below the head row (`openingView` in `paper/view.ts`). A look that leaves it wholly off the screen stays as it is. So the canoe is never half off the screen as the map opens, from any stop.
- A tap on it (a hit area of at least 44 px) opens the dedication page (account:dedication-page-and-its-doors) and folds nothing. A screen reader hears "A canoe with a lantern".
- Once the account's own light is lit (account:name-a-light-for-yours), the canoe carries a second lantern at its stern.
- Abroad the map has no lagoon and no canoe (the five taps of city:credits-screen-attributions reach the page there).
- The lantern's glow breathes by opacity alone and holds still under reduced motion (world:motions-under-half-second).

**world:plane-cut-at-send-off** The plane cut (chapter:send-off-scene-in-beats beat 4; the teaser's shot drawn in the game).

- After "Board the plane", the painted map of Lagos (world:map-is-painted-lagos) is shown at night, folded out, with the lagoon under it. A small plane sticker lifts off from the airport's position along a dashed line toward the top of the screen in the route's direction, for about three seconds, by `element.animate` on transform alone (the one exception to the half second of world:motions-under-half-second).
- The city the plane lands in arrives on a sticker card ("London", "Calgary", "Dubai", "Naples"), keyed by the hub place's `city` in the scene's words, so Castel Volturno's plane comes down at Naples. Then the cut ends into beat 5.
- Under reduced motion, the map, the plane standing at the line's end and the sticker are shown still for the same time.
- It draws nothing the map does not already have except the plane sticker and the dashed line: no tiles of its own and no three.js scene. It is one layer over the paper map and costs the map nothing when it is not shown.
- The shell hands the cut to the scene (`planeCut`), so the scene and the map import nothing of each other.

## Rules: the phone

**world:phone-rises-over-scene** The phone is a handset that rises over the scene.

- Its lock screen is plain navy with no pattern: the big clock, the day in words ("Tuesday 13 October"), the place as a pill with its picture, and notices as white cards naming their app.
- Its home is a grid of apps, the icons cut with a white edge. The sponsored tile sits on the home under the notices and above the grid: one at most, and nothing offline or when the hour has no advert (advert:slots-capped-per-place).
- One tap grows it to nearly the whole screen. On a laptop the grown handset fills the centred 430 px column, never the whole screen, and the world fills the screen around it.
- Each app has one job and one short screen. The apps, in order: Calendar, Bank, Chats, Japa, Papers (beside Japa, world:phone-holds-what-phones-hold), Jobs, Market, Lotto, Bills, News and Settings.
- Settings says each thing once: the account's row; the sound and the graphics in one card, whose line on when a graphics choice takes hold shows only once a choice is made; From the team, Feedback and Blocked as the rows of one card; About the game's Credits and guides as the rows of one card, each its name alone; This life's Start a new life as a row of its own card; and the version line last.
- An app carries a dot when it has something the player has not seen. The Calendar carries no dot. Papers carries one while a paper that came or moved at the month's end is unseen (world:month-passes-as-lived).
- The phone's contract carries a context pill beside each app's name (`PhoneApp.context`), under the name where the phone at rest has no room: Jobs' offers waiting, else the jobs open on the board; Lotto's Draw on Friday; Bills' bills to pay or the next rent in months; the Bank's next stamp or All in. Nothing counts days.
- Each app's head is its own tile and name on the sheet, with the round grow button, never a navy band. The apps are cards, tiles and chips in the game's look (decision 0025).
- Back returns to the grid from an app's first screen. From an inner screen of the app's own (a Chats thread, the People slots) it returns to that app's first screen, the one way back; no app draws a second back link of its own. The home bar closes the phone.

The apps:

- The Calendar holds the month (world:month-acts-carry-on).
- The boards (city:boards-switch-when-and-who) sit on Chats' people page in the game's look.
- Where no offer waits, the Jobs screen says the board's count ("No offer yet. 8 jobs are open on the board: ask there."), never "No job offers right now" under "8 open", and shows the board at the hub where jobs go up, with the way to it on the map.
- The hunt's list at the board and the offers are picture cards, with the pay as a green chip and the chance as a word in a pill.
- Offline, where the street kiosk runs its own draw, the Lotto app shows the month's tickets held, the last draw's result from the last month's results when it had one, and one line that tickets are sold at the street kiosk, with the street's name ("Bode Thomas Street") and the way to the kiosk on the map. So it is never a bare one-line screen.
- The Market app (`market`) is a two-column grid of sticker tiles of the very models, each with one line of what it does and its price on the yellow pill, and a running cost as a chip. It lists what can be bought first, then what is owned, then what needs something first, then what has no place here. A pick shows the balance before and after, and Buy. After buying come the coin cue and the toast Delivered, at once: a rider at the gate, a slip, and the thing standing in the room when the phone closes. An owned thing offers Sell (home:things-a-life-owns).
- Bills carries the car on finance and the undertaking's months.
- News carries the era's months and the Friday draw line.
- Chats' slots end with the sponsoring card, and a thread has read and new marks, phrase chips and refusals in words.

**world:phone-holds-what-phones-hold** The phone carries what a phone carries: texts and the family group, bill notices, the visa appointment and its reminder, the plan's steps, the bank. The papers themselves (the passport, the file) are a thing at home, a box under the bed. On the day of an appointment the character takes the file from under the bed before the ride. Every date on the phone's surfaces is said as months ago or away, never a month number (world:top-band-is-a-pill).

Papers:

- The papers are told in the phone's Papers app, the one source, which the papers box at home and Japa's papers step both open.
- It holds every paper the life has or is waiting on: the visa first once granted (the status after the flight), then each paper the plan's route asks for, in its order, then any other paper held. Each shows its state in words (held and how long, on its way and when, run out, not yet) and the ways out it counts toward.
- A paper's act shows while the view offers it. An act that is a call or a message in real life (the transcript asked of the registry, the degree sent for assessment, the council's verification, the licence's renewal) opens its own card in the app, the card a thing's sheet shows, and its answer is told in the corner. An act that is a visit says where ("At the passport office") and opens the map with that stop picked.
- The passport is a visit to Immigration: the passport office in Ikoyi, which stands in the visa centre's hall with its own passport desk.
- Papers also carries the status abroad with its renewal, where you are with the fare home and past returns, and the qualities as You.

Japa, the road's log:

- Under the way's card (its tile, the way and its file, a chip for the road, and how ready you are as a bar that fills, never a percentage) stand the briefs: the one carried now first, ringed, with its picture, title, giver, dots and the giver's opening line, and each of its things with a picture and a two-word place, ticked as the world ticks it; then the briefs done, each stamped Done with its giver's closing line; then the next, faint.
- Nothing in the log says step, item, task or chapter.
- The shell hands the log to the phone, since the phone does not import the city.
- Japa carries a file for each way looked into (the gate, the universities, the funds, the record with refusal reasons in words) and the goals with their steps.
- A way's file lists the papers its application needs that are not steps of its chapter, each before the step it must come before, ticked as the route's checklist ticks it, with where it is got: the talent file's passport before the endorsement, and its TB test before the application.
- While the plan's way is closed by the news, one locked chip under the head says so: "All closed · watch News" when every route with a window is closed, else "Closed · watch News".
- How ready the character is to go has one source: Japa's figure (the japacity figure, else the plan's own while no route's figure counts yet). The data page's READY and its strip read it, on the band's page and on the page at the handover alike. The data page's Ready is a word by quarter (Just starting, On the way, Past halfway, Nearly there, and All set at the whole), from `readyWords`, never a percentage.

The Bank:

- At home the Bank opens on the passbook (wallet:passbook-against-plan-cost, wallet:savings-stamps, wallet:saving-pace and wallet:roads-to-the-target): what is held for the road against the whole cost, both in full naira on one line, with a bar; the pace line; the pockets as chips; the stamps as round stickers (reached ones filled, with Mama heard or Ready); last month, in before out; and the roads as cards with one tap each (a job opens Jobs, an offer its own card, the family call its card; a road that waits shakes with the no cue and sends nothing). Saved for the move, Lately and the choosers stand behind it in the same dress. Change money and Move money sit at the foot.
- Abroad the balance card stands first.
- The Bank carries what arrives in naira per channel, both rates, the changes on their way, the family's naira at home and the credit file abroad.
- Abroad, Send money home shows its ways as tiles, as the ride sheet shows its ways (world:ride-sheet-shows-fares): each way's picture, its short name, the naira that arrives and when. Under the tiles, the picked way's fee in money and its rate show as chips, with the catch of sending through someone; then one Send with the sum and when it arrives. The card after it says the same facts as chips, never in a sentence.
- A change of money shows both sides, each in its own money, with the FX man's or the bank's words.
- A lotto ticket is a ticket on the results, never money going out.
- The Bank's "Saved for the move" is the results' own figure. It is read from the plan's lean as the chapters follow it, from the month the plan is set, not from the month its official page is read. A way with funds to show counts what its decision day asks for plus the fees still ahead (the route's acts with a cost in its money, less those done). The money counted toward it is all the bank and cash hold, at the official rate.
- A plan with nothing to count yet (a way only heard of, whose page is unread and which asks no fee ahead) and no plan at all both say there is no plan yet, as the results show no figure.
- The employer paying for the way is said only for a way whose employer pays.

**world:nobody-picked-from-list** Nobody is picked from a list. A person the character could meet shows up in a place the player already spends time in (the hub, or the family house, where the people met after church and a friend of the family visiting are found), and a friend's message in Chats can point there; it is never a hunt. Courting starts by tapping them there. Everything after the meeting follows `person.md` and `pair.md` as written, and the invite path for real friends stays. Their calls and messages arrive in Chats.

Where people are met:

- The church is not a built place, so the people met after the service are met at the family house.
- A friend's guest is a friend of the family visiting there, since meeting in a friend's room before courting would contradict their room opening only once courting.
- The meetup's two stand at the meetup in the hub (`place.yaba`).
- Nobody is met in their room.
- The computer partners stand where content meets them (person:computer-candidates-labelled, person:courting-opens-a-bond), the two at the family house in its parlour. Where two meetings share a thing (after the service, a friend of the family), one person stands there at a time, the one met only in December first.

Their room:

- Their home is one shared room, `place.their-room`, so one place serves every partner. It has a place file of its own, opens on the map once a bond with a partner is courting, near the place content gives their home, and stages the visit on its chair (person:time-together-is-an-act).
- It is dressed per person. A place file's dressing names a person beside an offer (city:set-piece-shown-where-staged), read when their room opens for a bond with that person. Their room's file has one for each computer partner content gives a home there: a prop or two from the shared kit that say who lives there, and the partner standing in it as themselves, in the model they are met in, clear of the chair and the door.
- A room dressed for a person shows no crowd, so the partner is the only figure in it.
- A tap on the partner shows their name with the `computer` mark and no act (person:computer-mark-is-quiet): the bond's choices live in Chats, and the visit stays on the chair (person:time-together-is-an-act).
- With more than one bond courting, the room is the one the map puts it near, else the first courted. A bond with a player, or no bond, keeps the plain room.
- A bond's Chats thread carries a head over its messages: the stage, an answer waiting, what can be asked, the joint, the sponsoring once partners, and ending it, one row each with the details folded behind it (world:one-action-one-sheet).
- Chats' People row opens the slots of this life, with the invite card on an empty partner slot or a computer sibling (person:invite-fills-a-slot). It is the one place the slots are seen in the world.

## Rules: look, sound and motion

**world:colours-are-role-tokens** Every interface colour is a role token: a component names a role, never a colour.

- The look is one system with two paints (decision 0025, `../design/09-the-games-look.md`). The day paint, on the root: a pale sky sheet, white cards, navy ink and edges, the danfo yellow action with a navy underside, and soft tints by kind of act. The night paint, under `data-paint` night: navy sheets, cream ink and edges, the action unchanged. The night paint is driven by the world's clock (clock:game-day-on-real-time; `shared/world/paint.ts`, `NIGHT_PAINT_LIVE`); the development switch `?paint=night` also shows it.
- The two paints are the only themes, and Settings offers no choice of look. The 3D world keeps its own colours.
- Yellow is the action and the signal and never fills a band. Offers and the hunt's jobs are picture cards with the pick ringed in yellow.
- The adire circle pattern is drawn on the data page, the wordmark, the door's and the prologue's headers and the moment card, and on nothing else.
- The Danfo display face is on the seal and the share cards alone; every other mounted surface sets Rubik.

Round things:

- Things drawn round are few: a dot, a person's avatar, and the look's round parts (the thumbs, the fan's buttons, the stickers' pins, the marker's ring). The look's own pills (`.pill`, `.sticker-chip`, the face mark) are round by design and are not counted against them, and the front door's round header buttons, its colour swatches and the page's round stamp are the exception.
- A thing's mark (world:things-are-tappable-models) is one of the few round things, with a hairline. What it opens keeps its role colours.

Pictures that keep their own colours, as the 3D world does:

- The two lights over the start screen (account:two-lights-and-wink-lines) are a picture of everyone, not the interface. They alone may draw soft gradients, two of them: the dusk across the top and the glow of each bulb. The palette's test counts them apart.
- The third light, a player's own light beside it and the dedication page's light (account:dedication-page-and-its-doors, account:name-a-light-for-yours) glow with the same fill, read from the two lights' file. No other gradient is drawn for them.
- The dedication page's picture (account:dedication-page-and-its-doors) uses literal colours like the two lights and the paper map: the sky `#172647`, the water `#111d38`, the boxes `#24345a`, `#3b4c77`, `#c8c3b4` and `#8e97ab`. It adds no gradient.
- The drawn map's water token (`--water`) is `#5f9fc0` in both paints (`apps/client/src/index.css`), so water reads as water wherever a map draws it, never as the bands' navy. Lagos's map overrides it with the murky lagoon of world:map-is-painted-lagos, `#565d41` by day and `#121612` by night (`.paper[data-city="lagos"]` in `apps/client/src/features/map/paper/aerial/aerial.css`); the painted maps abroad keep the token.
- Google's own mark on its sign-in button (`apps/client/public/brand/google-g.svg`, drawn as Google ships it, with its gradient) is the one outside mark the palette rule does not touch, since Google's branding guideline requires it unchanged.

**world:interface-sounds-made-live** Interface sounds are small cues made on the fly, with no files: a tap, a coin, a confirm, a whoosh, the cues of world:motions-under-half-second, and a `pop` for a thing lifted in buy mode. Mute in Settings silences them; muted, nothing is fetched.

**world:officer-voice-drawn-per-interview** Each credibility interview is held by one officer, a man or a woman, drawn once for that interview from a value the interview already carries. So the same interview always speaks in the same voice, a reload changes nothing, and across interviews both are heard. The officer is never named or described as a man or a woman in words; only the voice says it. The draw lives in the client (sound is presentation; the game's rules code is untouched), and it never reads a score.

**world:motions-under-half-second** Every motion of the interface takes under half a second: sheets rise, chips pop, the phone rises tilted, the money counts. The one motion allowed over half a second is the plane's lift of world:plane-cut-at-send-off, about three seconds. Reduced-motion settings cut them to a fade.

- Wherever it costs nothing, a visible state change is smooth, never abrupt. A sheet, a card, the phone or a folded row opening, closing, appearing or expanding moves by a plain CSS transition on transform and opacity only (the compositor's), 150 to 250 ms, never on a layout property and never by a render loop. The shared sheets and cards carry it (`index.css` `.motion-*`, `Sheet`, `WorldSheet`, `AskSheet`, `FullScreen`, the moment card, every `<details>`), and under reduced motion each snaps.
- The phone grows and shrinks as one transform from the box it left to the box it is laid out in (measured once, FLIP), its content hidden in flight and faded in once the frame is in place. It is put away by dropping back the way it rose. Nothing under it is laid out again.
- The look's motions, the press squash (120 ms), the wobble in (260 ms), the pop (260 ms) and the shake (280 ms, three times each way), are transform and opacity only and cut to a fade under reduced motion. The cues `ding`, `thud` and `no` are in the set, each under 300 ms (decision 0025).
- Reduced motion reaches the camera too. When the phone asks for reduced motion (`prefers-reduced-motion: reduce`, read by `motionReduced` in `shared/ui/motion.ts` and followed while the game is open), the camera's own moves change at once instead of easing: a wide home's quarter turn, its tilt, the ease in on a room and back out to the whole house (`easeRoomView`, the rate `ROOM_EASE`), every place's zoom and the street's rise to the plan view. A finger turning or tilting still moves the view live under it, and the snap on release is at once. Where the page cannot answer the query, the camera eases.

**world:no-classic-view-kept** Every address opens the world, `?classic` among them, and the shell has no month page. Rule tests run against the world and the phone. The client keeps no view it does not mount: the month's facts are on the phone's apps (world:phone-holds-what-phones-hold), and nothing counts the months held (clock:no-month-countdown-shown).

**world:street-talk-budget** Street talk follows the talk budget (decision 0025, `../design/09-the-games-look.md` section 5).

- Pictures over people carry the ambient life: emotes over at most two residents at a time, changing every few seconds. An emote over a resident is a tap target, and its tap is a tap on that person, so their line comes up as a tap on their figure would bring it.
- Words over a person come only when that person is near the player's figure (within about 7 m, `NEAR_M`, as for every voice): at most one bubble, at most eight words, for about four seconds, then a quiet of thirty seconds between overheard lines (`QUIET_MS`). A long line shows its words too, clipped to two lines in the bubble, and a tap opens it whole in a sheet with the name.
- At most three callouts stand over the scene (the fan, the chip and the marker first; the bubble waits).
- Nothing speaks in the first three seconds in a new place, nor over a sheet, the phone or the map.
- There is no corner chatter tied to nobody: the bottom corner holds only the answer to the player's own act (world:things-are-tappable-models), one line at a time, a told line staying about 7 seconds so a line of two sentences can be read.

Lines and bubbles on screen:

- Lines and the speech bubble are off-white with dark text by day and by night, lighter than the band, with a soft shadow and a hairline.
- While a sheet, the phone, the map, a card or the results cover the world, the corner and the bubble hide.
- Over the phone, a told line ("You quit", "Money changed") stands in a lane of its own just above the handset, below the band, never inside the glass on an app's icon or button. Grown, the handset leaves room for that lane above it.
- The corner keeps out of the thumbs' columns, so the turn button never stands on its line.

Who says an overheard line:

- A line overheard that one person plainly says names them. Content gives the speaker beside the line, `<place>.overheard.<n>.by` in `place.text.ts`: a person's name of at most two words ("Mama", "Your brother", "Conductor", "Trader"), never an engine word. `overheard.ts` reads it, and the bubble says that name instead of Someone nearby or Someone in the house.
- Where that person stands in the place as a thing (Mama at the family house), the words float over them only while that thing is near the player's figure (`NEAR_M`); otherwise the line is held.
- A line with no `.by` keeps the house's or the street's voice, over the resident nearest. At home the overheard voice is Someone in the house, not a stranger's.
- The named lines are the family house's three (the gate line a brother's, the uncle line Mama's, the pot line a sister's), the hostel's corridor where one person speaks, and the street's conductors calling a stop and sellers calling their goods.
- A place's own lines name what only that place has, so none reads as another kind of home or place. The room in a compound hears the compound's sweeping rota, next door, its one tap for ten rooms and the landlord. The family house hears the father, Mama and the uncle, in lines short enough to float whole. The room abroad hears its shared kitchen.

Where a bubble stands:

- A word bubble is placed from the whole scene, not from its speaker alone. Its tail is never longer than a bubble's height (80 px) and always ends over the speaker.
- First choice is a spot over or beside the speaker's head, clear of every head, every name shown and the marker. Among those, one over a thing's dot or the road is better than one further off (a dot can be tapped a moment later; a face is read). Only where no spot within the tail's reach is clear does the bubble stand over the crowd, its tail at the longest and the bubble as low as that allows, covering least.
- It keeps the spot it had while that stays clear, so it does not hop as the crowd idles.
- The tail is the bubble's own, in its fill, with its edge round it and its underside, by day and by night.
- Every line in a bubble wears one pair of curly quotes, the bubble's and never the line's, so the overheard lines, the news and a person's words read one way.
- While a bubble stands, the emotes fade and wait, so no picture sits at its tail. Opening a thing's fan hushes the bubble. The street's talk waits while a place's names are taught on its first entry and while the first brief's card stands.

## Rules: sleep, months, the room and its things

**world:sleep-ends-the-month** The bed is a thing, and its Sleep is how the month turns, at any hour. There is no automatic turn (decision 0011), and the game's rules code has no command and no rule of its own for it.

- The bed's fan buttons are Nap (`activity.nap`, a sheet) or Lie down (a pose, world:things-are-tappable-models), and Sleep. While no nap can be had, Lie down stands in Nap's place (the contract's `otherwise`). Sleep carries the sleep glyph and no price.
- Night falls on the world's clock. When the body is tired (the band's "Tired", world:top-band-is-a-pill), the nudge says "Night. Go to bed" unless a question or a person asking waits. A night the body can still take keeps the nudge as it was.
- Sleep is a timed act of about thirty-six seconds (`SLEEP_MS`; `?sleep=<seconds>` in development): the figure lies down, the room takes a soft dark wash, the moon chip under the band says "Asleep · tap to wake" with a thin bar running down, a large Wake up sits above the Phone thumb, and a small mark floats over the bed.
- While the sleep runs, the others in the place are not seen under the wash (the crowd, the dancers and those standing at a thing of their own); the sleeper alone stays. Waking, or the sleep running out, brings them back.
- When the sleep runs out, the month turns (`turn/end` once, with the commitments as they stand; the time left is rested, as an empty slot rests) and the results sheet opens in the room (world:month-end-results-sheet).
- Waking early, from the chip or the button, turns no month and is a nap (`activity.nap` when allowed), with "Up again. The night is still yours." in the corner in the evening and at night, and "Up again." by day.
- The first time a life sleeps, one small card, the first-night card, says "Each night you sleep is a month of your life." before the first sleep, with Sleep and Not yet. It shows once per life.
- A sleep never moves the world's clock.

**world:no-months-left-count** Nothing on screen counts the months left or the months held (decision 0011). The month turns only at the bed's Sleep (world:sleep-ends-the-month), and the bank of turns behind it never holds a month back (turn:month-turns-on-empty-bank). The player never reads "turn" or "banked". A card's button says the act ("Buy a ticket", "Study"), never "Add to month" or "Add to this month", and a small line under it says it uses this month's free time when it does. Nothing lectures before play (world:no-walkthrough-before-play).

**world:no-auto-run-months** Nothing runs months in a row for the player (decision 0011). A quiet month is lived in minutes by hand, with the room's free acts, and turns when the player sleeps (world:sleep-ends-the-month), whatever time is left. The same holds abroad. The game's rules code has no batch command.

**world:room-seen-down-its-length** The room, at home and abroad, is seen down its length: the camera is turned so the long side runs up a portrait screen, fitted to the room's width with nothing cut off, so the room looks about twice as large as from the front. From straight above, a standing figure is a dot in a room this long, so such a room's whole view looks in from no higher than 50 degrees, at the file's distance and width, with every corner of the floor still on screen.

- The room holds the basics a life uses, each a thing with its acts on its fan (world:things-are-tappable-models, world:fan-of-sticker-buttons): the cooking corner ("Cook", obligation:cooking-and-fetching-water), the water drum ("Fetch water", obligation:cooking-and-fetching-water), the mattress (Nap or Lie down, and Sleep, as world:sleep-ends-the-month), the lantern or the desk (study), and the bag by the door (pack, once the route is granted).
- Needs are not bars: the band names the body in words only when it complains (world:top-band-is-a-pill), and the room's acts answer it at once.

Wide homes:

- A home is one wide house of walled rooms (decision 0018), each named in its place file (`rooms`: the floor it covers and the view eased in on it). It is seen whole, straight down its length, on a longer lens (`Shot.fov`, 30 degrees), with the near walls cut low.
- A tap on a room, a pinch or the wheel eases the camera in on that room in under 400 ms. A thing tapped from the whole house eases in first, so its fan opens close. A tap outside the room, on another room or past the walls, a pinch out, or the whole-place chip eases back out. The view does not reset when the same place is shown anew after an act.
- The things of a home carry its acts wherever they stand: the family's pledges and the send-off at the centre table (`family`), the way out on the slippers by each door (`out`, which opens the map), and the family's bed as `mattress` and the hostel's as `bunk`, since the picture table allows one model per id.
- The things a life owns and the car stand where world:room-things-and-buy-mode puts them.

Turning a wide home:

- A wide home turns the full circle a quarter at a time, four fixed views, by the round button over Phone or by a one-finger sideways drag that snaps to the nearest quarter on release. The quarter is kept per home beside the save, so the home opens as it was left.
- Each outer side of the shell is built twice: full, with its windows, doors and wall things, and knee-high (0.6 m) with none. The pair facing away from the camera stands full and the near pair low, and on the way round a wall only ever rises behind the rooms, never in front.
- Rooms ease in at every quarter, the view fitted across the turned floor between 2.4 and 7 metres; past 7 the room's middle shows and its ends run off the sides.
- A vertical drag tilts between the normal view and a 65 degree view from above, and snaps to one. The tilt is not kept.

**world:month-passes-as-lived** The month passes as the player lives it. The days of the month are the rules code's: the view's `halfDays` (turn:month-lived-in-half-days, decision 0011) says how much of the month's free time is spent, and the interface keeps no count of its own. The rules code's outcomes come at the month's end, and nothing runs on real time.

- Each month-act planned tells of itself as the month passes, in a line of its own ("Module 1 done. Two to go.", "Your first shift ran late. You came home at eleven."), one or two a month, from content. Its day is read from the share of the free time spent.
- These lines arrive as phone notifications once the character is home (the house or the room), never on the street. The phone's dot shows them waiting, and at home they stand on its wallpaper ("This month so far"). Away from home the wallpaper says only how many wait ("Something to read at home.").
- The Calendar app says when the plan stretches the character (work, a class and a side job together: "Work, then class, then the tutoring. You will be tired."). The cost itself is the rules code's.
- The results keep their place as the month's telling.
- A paper that comes or moves at the month's end (issued, run out, made void, a copy on its way or brought forward, from the report's paper lines) is told on the wallpaper above the month's lines, at home or away, as a message from the office. It uses the paper's own words where it has them ("Your transcript is ready to collect.", "The council has verified your licence."), else the kind's ("Your {paper} is ready."). A tap on it opens Papers; it and the app's dot stay until Papers is opened.
- Nothing opens by itself: the phone opens on its home screen.

**world:japacity-bag-by-door** Japacity is shown two ways at once: in the band's tap-open figure, and in the room as the bag by the door.

- The bag swells with the figure (small at nothing, full at a hundred, eased toward a new size over about half a second) and carries on top what is held (the passport, a folder of papers, the flyer once a route is known).
- It wears a small luggage tag with the bare figure, never a percent sign. The tag is hidden while no route is heard of.
- Every rise of the figure flies up from the room as "+N" toward the band and fades, one at a time, never on a fall. While a sheet, the results, the map or a card covers the world, the figure waits, and the rise and the growth come together when the cover goes.
- The rise is the one thing that may pass over the world unbidden (world:world-fills-the-screen).
- It is one model scaled, a drawn tag and a CSS animation.

**world:no-walkthrough-before-play** Nothing lectures before play. On a device that has not played, once the first brief is carried, the Map and Phone thumbs carry their word at their foot until each is tapped once. The device records that it has played under its key (`japacity.walkthrough`, `shared/storage/storage.ts`) once both thumbs were tapped, and at once for a life that opens with a month behind it.

**world:room-things-and-buy-mode** The things in the room, and buy mode.

- Each home's place file has `stage.owned`, a set spot for each thing it may hold. A spot may name a model it replaces (`hides`: the foam mattress replaces the old bed) and carry the `acts` the thing brings (the TV's watch, the laptop's portfolio and tech, the gas cooker's cooking). `showOwned` adds each owned model where it stands, and the car stands at the home's car spot, `stage.car`, through `parkCar`, only while the life has one, the market's car or one on finance.
- Buy mode is on only in the home lived in, when it is a home of your own (the compound room, the hostel, Makoko, the room abroad) and something owned stands there. Never at the family house, a street, an office or someone else's room.
- A hold of 420 ms on a thing you own lifts it (a ring, a shadow, the `pop` cue, the hint Drag to move, tap to turn). A drag sets it down where it fits: its footprint's corners on the walkable floor, no overlap with any other footprint, and 0.2 m from the door's spot, people's spots and the spots things are walked to. Otherwise it shakes back to the last spot that fitted, with the `no` cue. A tap while lifted turns it a quarter; a tap anywhere else sets it down.
- Where things stand belongs to the device, kept beside the save by life and home (`japacity.arranged`) and cleared when a new life starts; it is never the rules code's. Moving home puts things at the new home's set spots.
- The lifted copy moves by its transform alone; the room is rebuilt once, when the thing is set down.
- A test holds each home's budgets with everything it may hold owned and the car parked.

## Rules: abroad

**world:painted-maps-abroad** The painted maps abroad (`../design/10-london.md` section 3, `../design/11-calgary-dubai-and-castel-volturno.md` section 6; decision 0017). Abroad the map folds and opens as Lagos's does (world:map-is-painted-lagos, world:one-country-at-a-time, decision 0026), each country on the same descriptor (`paper/city.ts`), but on the painted paper rather than from the air.

- The look is the pale paper, with its houses, trees and waves from a seeded whole-number layout drawn in squares, so each view paints only what it shows, and a ring where the player stands. Lagos's own colours and its drawing from the air are on Lagos's map alone.
- Each country's own chunk loads only when the map shows that country: its own fit from content's positions, its own land, roads and district names, the strip, the cards and the open map, every built place of the country as its sticker, and the home sticker at the country's home spot (`../design/11-calgary-dubai-and-castel-volturno.md` section 3).
- The UK's map is south-east London: the river across the top, the railway through Peckham, the districts Peckham, Camberwell, Nunhead, the Old Kent Road, Elephant and Castle, London Bridge and the City across the water, and Heathrow on an inset in a corner of the paper with the plane, since it is too far west for the paper.
- Calgary's is the grid with the CTrain line to downtown, the airport north and the river south (cards: the north-east, the airport, downtown).
- Dubai's is the creek, the metro line, the airport south-east, the camp east and the site south across the creek (cards: Deira, the airport, the camp, the site).
- Castel Volturno's is the sea along the west, the Domitiana the length of the paper, the river and the fields, with Naples airport on an inset (cards: the town, the Domitiana, the fields).
- The country menu and the ways back are as at home, and there is no lantern canoe (world:lantern-canoe-on-map). The stops list stays, for a screen reader alone.
- The room abroad is named per country in content (`place.the-room.name.<country>`: the basement room, the bed space at the camp, the room in a shared flat), with the full name on the place's own card. On the band and on the map's sticker it wears a short name of the client's ("The shared room, Peckham" in London, by its hub's short name, "The basement, Calgary", "The bed space, Dubai", "The shared flat, Castel"), since content's full name runs past the band's width and off the paper.

**world:ride-abroad-and-workplace** The ride abroad, and the workplace with a door (`../design/10-london.md` sections 3 and 4, `../design/11-calgary-dubai-and-castel-volturno.md` sections 4 and 6).

The ride abroad:

- Picking a stop abroad opens the ride sheet with the country's ways from the view's `place.ways` (in the UK the bus at its flat fare, the train by distance, and on foot within walking distance), priced by `rideFare` as at home. The fare pill names the country's pass in a month the pass is bought (place:country-pass-covers-ways).
- The ride plays as the danfo's does (world:ride-cuts-between-angles) inside the country's own vehicle: London's red bus from a top-deck seat and its window, and the train from its carriage; Calgary's bus and the CTrain car; Dubai's metro car, the labour bus and the taxi; Castel Volturno's bus and the white van. The cuts and the clock are the ride's.
- The labour bus and the van are the shuttle's, priced and labelled as place:employer-shuttle-rides-free says.
- Dubai's city bus rides in Calgary's bus model, and Calgary's taxi in Dubai's.

The workplace:

- A workplace is a place with things (world:things-are-tappable-models): the door, the desk or the clock-in where the job is got and held (the hunt's card with that job named; the thing's label says "On shift" once held); the rota board for `activity.overtime` (staged at every workplace, city:places-stage-their-acts); the manager's door or the glass office for the next rung; and a colleague at the tea point, the kitchen or the shelter who says a line (a bubble, world:things-are-tappable-models).
- The job's days pass as the lived month plays (world:month-passes-as-lived).
- The things, their labels and their spots are the place file's.
- A workplace reached by the shuttle says On shift as any other. The Gulf's site is On shift from the first morning, since the job comes with the agent's contract.
- The interiors a country shares with London (the big shop, the care home, the office, the warehouse, the church) are London's scenes under the country's own entry, with the country's signs and lines. A shared interior's stage file is the country's own copy in a folder named after its place id (`public/assets/places/<place id>/place.json`), with the models inside London's at the same spots. The client reads it for a place abroad whose id-named folder holds a published file, else the `assets` folder.
- The tills, the staff notice and a manager's door with no rung in that country are look-only. The Gulf site's guard post and cleaner's trolley keep a look act for the job the contract did not give.

## Numbers

| What | Value | Source | Rule |
|---|---|---|---|
| Nudge line | at most 8 words | Working value | world:nudge-says-one-thing |
| Buttons on a thing's fan | up to 6, a seventh peeking; more than 8 open a sheet | Working value | world:fan-of-sticker-buttons |
| Cut | under 500 ms dark | Working value | world:entering-is-a-cut |
| Outdoor frontage | about 24 m wide | Working value | world:place-is-one-screen |
| Indoor room | about 16 by 9 m | Working value | world:place-is-one-screen |
| People, low mode | 6 outdoors, 4 indoors | Working value | world:place-is-one-screen |
| People, high mode | 10 outdoors, 6 indoors | Working value | world:place-is-one-screen |
| Moving sheets | 1 per place, 0 in low | Working value | world:place-is-one-screen |
| Faces at one height | none within 1 cm | Working value | world:faces-never-share-height |
| Ride | about 6 s, skippable | Working value | world:ride-sheet-shows-fares |
| A walk home past the walking limit | about 12 s, not skippable | Working value | world:ride-sheet-shows-fares |
| Interface motion | under 500 ms | Working value | world:motions-under-half-second |
| A walk before an act | about 1 s, a second tap ends it | Working value | world:nothing-roams |
| An overheard line | about 4 s over its speaker, then 30 s quiet | Working value | world:street-talk-budget |
| A told line stays | about 7 s | Working value | world:street-talk-budget |
| Lines in the corner | one at a time | Working value | world:street-talk-budget |
| A person's words over them | about 4 s, one speaker at a time | Working value | world:things-are-tappable-models |
| The band's second row peeks | about 5 s | Working value | world:top-band-is-a-pill |
