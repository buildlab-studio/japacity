# Rehearsal: the stageshow teaser

The record of the four scenes of `Stageshow` and `StageshowPortrait`, for whoever changes them: the reference scenes they started from, what each scene holds, how they were filmed and checked, what review found and what was not checked. It follows the form the stageshow skill's `verify.md` asks for. The second cut keeps [its own record](b/REHEARSAL.md), which says only what differs from this one.

## Reference scenes

- `phone-touch`, for the phone in the hand: a phone app shown as one continuous object, a touch cursor, a few beats to a payoff that holds.
  - Kept: the kit's `Phone` at a size that reads (452 wide in the 540 by 960 frame, with a gutter above and on either side, its foot past the bottom); a touch cursor that shows only where it taps; taps that open a surface in place; a payoff that holds.
  - Changed: the app is the game (its band, sheets, handset and apps in the game's tokens), and each scene plays once into the next instead of looping.
- `payout-flow`, for the month's results: a value that fills on its own clock and a payoff that holds.
  - Kept: the slow fill of a bar beside its figure, rolling with `Count`.
  - Changed: the bar is the game's savings bar and the figures are the game's.
- The laptop frame is the game in a browser (`Window` with its address). The closest layout is a whole window filling the stage, with the game's centred column in it, as the game draws it on a laptop.

## Scenes

| Scene | Length | What happens |
|---|---|---|
| `door` | 4.5 s | The deck of lives; the developer's card tapped and picked; the ways it opens settle in under it; Next pressed. |
| `step` | 8.6 s | The brief's chip tapped; the phone rises on Japa; the official page's card read with the phone's line over it; the phone put away; the giver's toast; the step's dot turns green. |
| `month` | 9.2 s | The results lead with the salary and what was kept; the savings bar fills toward the move; the ask's row opens the ask; Look closer finds the second sign. |
| `ways` | 4.3 s | The phone's home screen; Japa tapped; the plan and the other ways out. |

Each scene plays once (`play="once"`). The cut fades from one scene to the next, so no scene loops back on screen.

## Filming and the gate

- Widths: each scene at its shown width (1920 for the laptop, 1080 for the phone) and at 390, where the laptop's stage draws the phone's design (its compact layout).
- Look: the day paint only.
- Clocks: the compositions step each scene's virtual clock to the frame; the filmed runs use the browser's own clocks.
- Gate: each scene is checked at each width with `film.mjs --gate`.

## Review findings

Each finding from a review of the rendered frames, and what was done:

- The laptop's window stands whole with an even margin. It stays whole: the game's sheets and its yellow action stand at the window's foot, so letting it bleed off the frame would cut what the story presses. It fills nine tenths of the frame, which the gate reads as the stage's ground.
- On a laptop the door is a 600 wide reading column in a wide window, with sky on either side. That is how the game draws the door on a laptop. Its height already fills the window, so it cannot grow without cutting its action.
- The next life in the deck meets the column's edge. It fades out there instead of ending on a hard edge.
- Where the eye lands in the phone: the game's own other ways out and what is coming up, no filler.
- The home screen's wallpaper between the place and the apps is the game's own. Kept.
- The door on the phone: the life's picture takes the phone's taller size, as in the game, so the card, its ways and the age card fill the screen.
- The salary amount appears twice. That is the game's own results card. Kept.
- The laptop's arrow waits past the stage's edge before its first press, and after each press goes to the world beside the column, never resting on words.
- The end card's dark then navy ground is the lead cut's lights-off joke, kept as it plays there.

## Not checked

- Reduced motion, beyond the poster states each stage sets.
- Hover and keyboard: the scenes are filmed, not used.
