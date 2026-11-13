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

The rules that carry the look are on [the world rules](../rules/world.md) and [the text rules](../rules/text.md); this page says why it looks as it does.

## 2. The system

**Surfaces and night.** A pale sky sheet, white cards with a thin navy edge and a soft shadow, navy ink, tinted pills for chips, and one danfo yellow action whose navy underside flattens on press. At night in the world the same shapes repaint in navy with cream ink, the yellow unchanged: one system with two paints, driven by what already drives the sky (world:colours-are-role-tokens; the values are the role tokens in `apps/client/src/index.css`). There is no sand or beige, and the adire pattern stays on the few surfaces that rule names, so it keeps its weight where it appears.

**Type.** Rubik, self-hosted, in three sizes set in `index.css`: titles and money, body text, and chips, with nothing smaller than a chip (text:show-then-tell). Sentence case, and tabular figures for money so sums line up. The Danfo display face is kept for the seal and the share cards, and the wordmark is drawn as paths. No tracked capitals, handwriting or chalk, and no monospace outside the data page and a slip: each of those reads as a document, not a game.

**Pictures.** Every choice, thing, place and reward carries a picture: a render of the game's own model where one exists (`tools/assets/shoot.ts`, the `tile` view), cut as a sticker with a white edge and a slight tilt. Where no model exists, an emoji stands in; `apps/client/src/shared/tiles/missing.ts` lists those stand-ins. People are shown by a name pill with a flat mark, never by a face render (see the last alternative below).

**Tints by kind.** A round act button and a tile are tinted by what the act is: food peach, study blue, money green, body lilac, people rose. Everything else keeps the sheet's tint. The tints speak for themselves, so no colour key is shown.

**Words.** A title of at most four words, with one line under it in the speaker's voice ([the text rules](../rules/text.md)), never the rule's words. A locked act says why in three words. Cost, time and effect go in chips ("₦1,500", "A week", "+Belly"), and a chip says only what is not obvious (the "Chips earn their place" line of world:costly-acts-confirmed). An act's facts stand as chips in one fixed order, its changes as arrow tags and its needs as marks, so the eye learns where to look (text:show-then-tell). A chance is a word with a small three-bar gauge beside it (`ChanceGauge`), and a check against a target is a bar with both figures and a stamp (`CheckMeter`). A field the player types into says its state in one line under its box (world:field-says-its-state). Colour never carries a meaning alone.

**One action.** One main button per surface: the verb in one or two words, with its price where it has one ("Sit exam · ₦120,000"), never repeating the title above it. Where every card is a tap (the fan, the market), the card is the tap and carries its price on a yellow pill; the balance before and after belong on a sheet with room for them (world:fan-of-sticker-buttons, world:costly-acts-confirmed).

**The laptop.** The band, the chips, the sheets, the toasts and the phone sit in a centred column of phone width, and the world fills the screen around it (world:world-fills-the-screen). One layout rule, measured from the screen, so the laptop needs no second design.

**The desktop door.** Before the world, a wide window is used in full, never as a stretched phone: the figure large on a stage with the travel data page beside it, the choices in a panel docked on the right with the one yellow action at its foot, and the steps as tabs across the top. Nothing scrolls, every choice shows at once, and the action stays in one place (prologue:front-door-three-screens).

## 3. The fan

Tapping a thing in the world opens no sheet. Its acts fan out of the thing itself, as round sticker buttons along a curve into the free side of the screen, and follow the thing as the camera eases. When there is no room, or too many acts, the same buttons open as a sheet. A list stays a list: jobs, routes, the market and any worded choice are sheets or phone apps, never a fan. The rule, with its counts, is world:fan-of-sticker-buttons.

The fan keeps the thing and its acts together, so the player's eye stays in the scene (see "A sheet for every tap" below).

## 4. The brief and the marker

**The brief.** A step of the journey is handed over as a mission card by the person who sets it, in their voice, floating out of where they stand: their words first with the title as a wink ("Papers, abeg"), a picture of what you are after, the things to do as sticker tiles with a two-word place under each, the reward as picture chips, the next brief faint, and one button, "Let's go" (chapter:first-chapter-mission-card). A mission from a person reads as a game; a checklist reads as a form.

**The marker.** At the place, the step's person or thing carries a marker: a white pill with two words and an arrow, a soft bounce, and a yellow ring at the feet. A thing done ticks with a pop and a toast in the giver's voice, and the close brings the card back with the stamp, confetti and the next briefs (world:things-are-tappable-models, chapter:first-chapter-mission-card).

**The fun stays free.** The beer joint, the barber, the suya man and the club never get a brief, marker or toast, so play there never feels like a task.

**Only in the moment.** Nothing sits under the band by default. The step shows in the world only for a moment after a brief is handed over, and again while the player is at its place (world:nudge-says-one-thing). The chip says which brief; the marker says what to do. The Japa app is the log, and the map's strip shows the step's place. Nothing in the world is a checklist.

## 5. The talk budget

A street full of people could fill the screen with reading. The talk budget keeps it a scene to look at, with two channels and no more (world:street-talk-budget holds the counts and times):

- **Pictures over people** (a plate, a naira sign, a danfo) carry the ambient life and need no reading. A crowd raises the pictures, never the words.
- **Words over a person** appear only when that person is near the player's figure, one short bubble at a time, with quiet between overheard lines. A long line opens whole in a sheet on a tap. A place's overheard lines are sorted into the two channels by length.
- **Few callouts at once.** The nudge's chip, a word bubble, the marker and an open fan are the callouts, and only a few stand over the scene together.
- **Nothing speaks over a sheet**, the phone or the map, or just as the player arrives in a place.
- **The bottom corner** is for lines about the player's own act alone.

## 6. What the look covers

The look dresses the band, the nudge, the act surfaces, the ask, the ride sheet, the results, every phone app and the sheet frame. Its own parts are the fan, the picture tiles, the mission card and marker, the talk budget, the night paint, the centred column, toasts that answer every tap, and the market and buy mode (the mode for lifting and moving the things in your room, world:room-things-and-buy-mode).

These are drawn on their own terms: the two lights over the start screen (account:two-lights-and-wink-lines), the door, the data page and its stamps, the prologue, the world and its things, the sky and the street lamps, the scene's answers, sleep, the painted map and the ride, the handset with its lock screen and apps, the slips, Papers, the moment and share cards, the interview room and the December scene.

## 7. Motion and sound

Things move in ways people already like from phone games, and nothing moves for long, so the game feels quick on a slow phone (world:motions-under-half-second holds the timings and the reduced-motion fade).

- **Press.** Every tappable thing squashes a little on press and springs back on release. The yellow action's navy underside flattens.
- **Appear.** A sticker wobbles in. The fan's buttons spring out along the curve one after another. A chip pops. A sheet rises. A toast slides in from the top and out again.
- **Answer.** A tick pops with a short overshoot. A coin flies from the money toast to the band's counter, and the counter counts. A brief's close brings confetti and a stamp that lands with weight. The marker bounces softly and its ring breathes.
- **Refuse.** A locked card or a short balance shakes sideways, and nothing else happens.
- **Sound.** Short tones made in the browser (world:interface-sounds-made-live; the cue set is in [Audio](05-audio.md) section 2): a `tap` on a main button, a bright `ding` for a thing done, a `coin` for money, a `thud` for a stamp, a low double note (`no`) for a refusal, and a `whoosh` for the fan opening. Every sound has a visible cause, and no cue needs a recording.

## 8. Alternatives considered

- **A document look.** Patterned headers, small capitals, hairline rows and stamped buttons read as Lagos paperwork and as a form: a life sim that looks like an office. The light system keeps Lagos in the world and the words.
- **A sheet for every tap.** A list of acts opened over the scene for each thing hides the scene the act is in. The fan keeps the thing and its acts together, and the sheet remains for a long list.
- **A theme the player picks.** A second look to maintain and test on every screen. The night paint is the one variation, and the world's clock drives it.
- **Corner chatter.** Lines in the corner from nobody in particular fill the screen with reading. The talk budget keeps words to people near the player and pictures for the rest.
- **Faces as pictures of people.** A face render never matches every player's picture of a person; a name pill and a flat mark do.
