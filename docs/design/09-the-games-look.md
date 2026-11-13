# The game's look

## Context and scope

The look of the interface over the world: its surfaces, type, pictures, the fan of acts, the briefs, how much people say, and how things move and sound. The game is visual and light, never serious and dense. The structures it dresses (the world, the map, the phone and the lived month) are described in `07-the-world-first.md` and `08-the-lived-month.md`. The decision record is `../decisions/0025-the-games-look.md`.

The code:

- the system and the night paint: `apps/client/src/index.css`
- the fan and the brief: `apps/client/src/features/city/fan/` and `apps/client/src/features/city/brief/`
- the cues: `apps/client/src/shared/sound/cues.ts`
- the market and buy mode: decision 0019

## Goals and non-goals

**Goals.**

- One light, friendly system on every surface, day and night.
- A picture on every choice, and only a few words at a time.
- Lagos lives in the world and the words; the interface stays out of the way.

**Non-goals.** Chatter in the corner from nobody in particular; a document look (patterned headers, small capitals, hairline rows, buttons with black edges, a rule's words on screen); the month's close as a statement of account; a second theme; screens that compare one player with another; a page view; a fly-over in place of the scene.

## 1. Summary

One light, friendly system over the world:

- pale sky surfaces, white cards, navy ink, and danfo yellow for the one action;
- a picture on every choice, cut as a sticker from the game's own models;
- titles of a few words in Rubik, and one line in the game's voice;
- cost, time and effect as tilted sticker chips;
- a thing's acts fanned out of the thing itself, in the scene;
- the same shapes in navy at night in the world.

Lagos lives in the world and the words; the interface stays out of the way.

## 2. The system

**Surfaces.**

- The sheet is pale sky (`--sheet`, #eaf3fb).
- Cards are white, with a 20 px radius, a thin navy edge and a soft shadow.
- The ink is navy.
- Chips (the small labels for a cost, a time or an effect) are tinted pills.
- The one action is danfo yellow, with a 4 px navy underside that flattens on press.
- No sand or beige anywhere, and no pattern on everyday surfaces. The adire circle pattern appears only on the travel data page, the moment card's header and the account door's band.

**Night.** When the world's clock (clock:game-day-on-real-time) says it is night, the same shapes repaint: navy surfaces, cream ink and edges, and the yellow action unchanged. One system with two paints, driven by what already drives the sky.

**Type.**

- Rubik, self-hosted, in three sizes: 22 px for titles and money, 16 px for body text, 12 px for chips.
- Sentence case, with tabular figures for money.
- The Danfo display face appears on the share cards only. The wordmark is drawn as paths.
- No tracked capitals, handwriting or chalk, and no monospace outside the data page and a slip.

**Pictures.** Every choice, thing, place and reward carries a picture: a render of the game's own model where one exists (`tools/assets/shoot.ts`, the `tile` view), cut as a sticker with a white edge and a slight tilt. Where no model exists, an emoji stands in; `apps/client/src/shared/tiles/missing.ts` lists those stand-ins. People are shown by a name pill with a flat mark, never by a face render.

**Tints by kind.** A round act button and a tile are tinted by what the act is: food peach, study blue, money green, body lilac, people rose. Everything else keeps the sheet's tint.

**Words.** A title of at most four words, with one line under it in the speaker's voice (`../rules/text.md`), never the rule's words. Cost, time and effect go in chips ("₦1,500", "A morning", "+Belly"). A locked act says why in three words.

**Chips earn their place.** A chip says only what is not obvious.

- A price shows only where there is one.
- "Free" shows only on an act a player would expect to pay for (a meal, a ride), never on sleep, a bath or water, and never beside a "No cost" that says the same.
- The time shows only when it is longer than a morning (a day, a weekend, a week), never "a morning" on every card.
- At most two effect chips per card, and none that repeats the one line.
- The fan carries the price pill alone. The balance before (struck through) and the balance after belong on a sheet with room for them (the ride sheet, a purchase), not on a round button in the scene. The band's money counter is the balance: while a fan button is pressed, the counter shows what would be left, and it settles back if the press is released.
- No colour key on screen: the tints speak for themselves or they are not needed.

**Facts, in one order.**

- An act's facts are tilted sticker chips, each an icon and two or three words, always in the order of `FACT_ORDER` (`apps/client/src/shared/words/facts.ts`): pay (a coin), chance, time (a clock), when it pays or answers (a calendar), a bill over months (a receipt), a fee (a tag), a rate (two arrows), where it counts (a plane), and a catch (a warning sign).
- The chance is a word with a small three-bar gauge beside it (`ChanceGauge`). The bars carry the shape, the word is always there, and colour never carries meaning alone.
- What an act changes is an arrow tag (`ToneTag`): a gain with an up arrow, a cost to the body or the mood with a down arrow, in a person's words ("tires you", "wears you").
- What an act needs is a mark: a tick when met, a cross when not.
- A field the player types into states its condition the same way, in one line directly under its box (world:field-says-its-state). A problem shows in the out colour, with a small circle-and-mark icon and the box's edge in the same colour. A good state shows the tick in the money-in green. What the field is for goes under its label in the quiet ink, never bold and with no icon.
- The one line above the chips holds only what no chip says.
- A choice of ways (the ride sheet, Send money home) is a row of picture tiles, with the picked one in the pick colour and the picked way's facts as chips under the row.
- Where a chip does not work (a long fact that cannot fit in two or three words, or the dense lines inside a card that lists several things), the same facts appear as icon rows, each a small icon on a soft square with its words (`Facts`' rows).
- A check against a target is a bar with both figures under it and a stamp with the verdict (`CheckMeter`).

**One action.** One main button per surface: the verb in one or two words, and its price where it has one ("Apply" under the named job, "Sit exam · ₦120,000", "Let's go"), never repeating the title above it. A button with no title over it (the fan's, a row's) keeps the full name. Where every card is a tap (the fan, the market), there is no button: the card is the tap, and the price is a yellow pill on it with the balance before struck through and the balance after beside it, never "left".

**The laptop.** The band (the pill across the top of the screen), the chips, the sheets, the toasts and the phone sit in a centred column of phone width. The world fills the screen around it, and the fan opens at a larger radius. One layout rule, measured from the screen.

**The desktop door.** Before the world, a wide window is used in full, never as a stretched phone. The figure stands large on a stage with the travel data page filling in beside it. The choices sit in a panel docked on the right, with the one yellow action at its foot, and the steps are tabs in a band across the top. Nothing scrolls the page, every look and every life shows at once, and the action stays in one place. The arrow keys, Enter and R work, and a line listing the keys shows on a fine pointer. The phone's door is unchanged below the break point (`tuning.city.desktopMinWidth` wide and 640 px tall).

## 3. The fan

Tapping a thing in the world opens no sheet. Its acts fan out of the thing itself:

- The thing is the hinge. A curve sweeps sideways and down from it into the larger free side of the screen.
- The acts sit along the curve as round sticker buttons, each with a name pill outside the curve and the price pill.
- Up to six show, with a seventh peeking below the fold. A drag moves them along the curve.
- The buttons follow the thing as the camera eases, as the marks do.
- When the free space cannot hold the fan, or a thing has more than eight acts, the same acts open as a sheet of the same buttons.
- A list stays a list: jobs, routes, the market and any worded choice (an ask, an agent) are sheets or phone apps, never a fan (world:fan-of-sticker-buttons).

## 4. The brief and the marker

**The brief.** A brief is a step of the journey, handed over as a mission card by the person who sets it, in their voice, floating out of where they stand. It shows:

- their words first, with the title as a wink ("Papers, abeg");
- a picture of what you are after;
- the three things as sticker tiles, each with its two-word place underneath;
- one look for each state: a thing done recedes, with a tick and "Done" in place of its place; the current thing is filled and ringed; the rest are plain; a thing met before the brief stands first, saying where it happened;
- the reward as picture chips;
- the next brief, faint;
- one button, "Let's go".

**The marker.** At the place, the step's person or thing carries a marker: a white pill with two words and an arrow, a soft bounce, and a yellow ring at the person's feet. A thing done ticks with a pop and a toast in the giver's voice. The close brings the card back with the stamp, confetti and the next briefs as picture cards.

**The fun stays free.** The beer joint, the barber, the suya man and the club never get a brief, marker or toast.

**Only in the moment.** Nothing sits under the band by default. The chip appears for about two seconds after a brief is handed over, then slides into the Phone thumb button, whose Japa icon takes a dot. It appears again while you are at the step's place or beside its person, and goes when you walk away (world:nudge-says-one-thing). The chip says which brief; the marker says what to do. The Japa app is the log, and the map's strip shows the step's place. Nothing in the world is a checklist.

## 5. The talk budget

There are two channels and no more (world:street-talk-budget).

- **Pictures over people** (a plate, a naira sign, a danfo, a face) carry the ambient life and need no reading. At most two residents show a picture at a time, changing every few seconds.
- **Words over a person** appear only when that person is near the player's figure (about 7 m). At most one such bubble is on screen, of at most eight words, for about four seconds, followed by thirty seconds of quiet between overheard lines. The bottom corner is for lines about the player alone.
- A long line is clipped to two lines; a tap opens it whole in a sheet with the speaker's name.
- At most three callouts are over the scene at once. The callouts are the nudge's chip (the one line under the band that says what to notice next), a word bubble, the marker, and an open fan.
- Nothing speaks over a sheet, the phone or the map, or in the first three seconds in a new place.
- A crowd raises the pictures, never the words.
- A place's overheard lines are sorted into the two channels by length.

## 6. What the look covers

The look dresses the band, the nudge, the act surfaces, the ask, the ride sheet, the results, every phone app and the sheet frame. Its own parts are the fan, the picture tiles, the mission card and marker, the talk budget, the night paint, the centred column, toasts that answer every tap, and the market and buy mode (the mode for lifting and moving the things in your room, world:room-things-and-buy-mode).

These are drawn on their own terms: the two lights over the start screen (account:two-lights-and-wink-lines), the door, the data page and its stamps, the prologue, the world and its things, the sky and the street lamps, the scene's answers, sleep, the painted map and the ride, the handset with its lock screen and apps, the slips, Papers, the moment and share cards, the interview room and the December scene.

## 7. Motion and sound

Things move in ways people already like, and nothing moves for long (world:motions-under-half-second): every motion is under half a second, uses transform and opacity only, and becomes a fade under reduced motion.

- **Press.** Every tappable thing squashes a little on press (scale 0.96) and springs back on release. The yellow action's navy underside flattens.
- **Appear.** A sticker wobbles in (a small rotation that settles, 260 ms). The fan's buttons spring out along the curve one after another, 40 ms apart. A chip pops (260 ms). A sheet rises. A toast slides in from the top and out again.
- **Answer.** A tick pops with a short overshoot. A coin flies from the money toast to the band's counter, and the counter counts. A brief's close brings confetti and a stamp that lands with weight. The marker bounces softly and its ring breathes.
- **Refuse.** A locked card or a short balance shakes sideways three times each way in 280 ms, and nothing else happens.
- **Sound.** The game's own cue set (`apps/client/src/shared/sound/cues.ts`: short tones made in the browser, under the mute switch; `05-audio.md` section 2). A `tap` on a main button, a bright `ding` for a thing done, a `coin` for money, a `thud` for a stamp, a low double note (`no`) for a refusal, and a `whoosh` for the fan opening. Every sound has a visible cause. `ding`, `thud` and `no` are each under 300 ms, and every cue ends within half a second. No cue needs a recording.

## 8. Alternatives considered

- **A document look.** Patterned headers, small capitals, hairline rows and stamped buttons read as Lagos paperwork and as a form: a life sim that looks like an office. The light system keeps Lagos in the world and the words.
- **A sheet for every tap.** A list of acts opened over the scene for each thing hides the scene the act is in. The fan keeps the thing and its acts together, and the sheet remains for a long list.
- **A theme the player picks.** A second look to maintain and test on every screen. The night paint is the one variation, and the world's clock drives it.
- **Corner chatter.** Lines in the corner from nobody in particular fill the screen with reading. The talk budget keeps words to people near the player and pictures for the rest.
- **Faces as pictures of people.** A face render never matches every player's picture of a person; a name pill and a flat mark do.
