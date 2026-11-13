# The city and the places

The game is played in a 3D Lagos seen from above. Each place is one screen: a street frontage, a market, a home.

- The player taps a thing to walk to it, and its acts fan out of it.
- People near the character speak in short bubbles over their heads.
- The answer to the player's own act is a short line in the bottom corner.
- The map takes the player across the city by danfo, keke, okada or on foot.

Walking round a place costs nothing, and the game's state never hears of it: only acts change the life.

<div style="display:flex;gap:12px;flex-wrap:wrap">
  <img src="/pictures/water-06-the-world.webp" alt="Makoko on the lagoon by day, a line from someone in the house over the water, and Get a job marked by the racks" width="220">
  <img src="/pictures/city-thing-chip.webp" alt="The cooking corner of the family house with its fan open: its name in a pill, then Food from the pot, free, and A big pot for the house with its price, as round sticker buttons" width="220">
  <img src="/pictures/dev-37-the-world-at-the-end.webp" alt="The family house with words in a bubble from someone in the house: My cousin's friend went by the UK talent visa. It is not easy, they say." width="220">
</div>

## What is on screen

The world fills the screen. Over it sit only:

- **The band** at the top, a white pill by day and a navy one at night. It shows the character's name with the part of the day beside it (Morning, Afternoon, Evening, Night), the age and the place small under it, and the money as a green counter. Tapping the name or the age opens the data page; tapping the part of the day opens the phone's Calendar.
- **The nudge**, one line under the band, only when something waits: a question, an offer, money due or, at night, the bed. Nothing sits there by default. The brief's chip shows there only in the moment (see [the first months](./first-months.md)).
- **Two thumbs** at the bottom corners, round white buttons with a picture each: Map on the left, Phone on the right. The phone carries a dot when an app has something new. On a device that has not played yet, each thumb carries its word ("Go places", "Chats, bank, news") once the first brief is carried, until it is tapped once. In a wide home, a smaller round button over Phone, "See another side", turns the house (see [the home](./home.md)).

A sheet, the phone, the map or the month's results open over the world and close back to it.

## Tap to walk

Nothing roams.

- A tap on a thing walks the character to it in a straight line, in about a second whatever the distance, and the act follows. A second tap ends the walk at once.
- A tap on the ground walks there only inside the place's walkable ground, with no route round things in the way.
- The camera is always raised. One finger turns the view within the place's limit. A pinch snaps between the whole place and close on the character, with "See the whole place" to go back.

## Things and their acts

Each thing the player can use carries a small still dot at its anchor. The thing or person the brief's step needs carries the marker instead (see [the first months](./first-months.md)).

Tapping a thing or its dot opens its fan:

- the thing's name in a pill over it;
- its acts as round sticker buttons along a curve that sweeps sideways and down from the thing into the free side of the screen;
- on each button, the act's picture and a name pill, and a price pill only where there is a price;
- up to six buttons, a seventh peeking; a drag moves them along the curve.

A tap outside the fan, or Escape, closes it. When there is no room beside the thing, the same buttons open on a small sheet. The first time a place is entered in a life, every name shows for two seconds and fades.

```mermaid
flowchart TD
  T["Tap a thing"] --> C["Its fan: a round button for each act"]
  C --> K{"What kind of act?"}
  K -->|"A pose: Sit, Lie down"| P["Done at once, seen on the thing"]
  K -->|"A now-act: a meal, Fetch water"| N["Paid and answered on arrival, the scene shows it"]
  K -->|"An act with a card: a job, a course, the meetup"| S["Its card opens after the walk; the button says the act"]
  K -->|"Look in the box"| A["The phone opens on Papers"]
  K -->|"Sleep, on the bed"| M["The sleep, then the month turns"]
  K -->|"Go in, Step outside"| X["A short cut to the other scene"]
  K -->|"Ride, the gate, the canoe"| R["The map, to pick a stop"]
```

- **A now-act** is sent once the character has walked to the thing. While its button is pressed, the band's money counter shows what would be left.
- **An act with a card** opens its card after the walk. The card's one button names the act and its price, with the balance before struck through and the balance after beside it, and the time it takes in words when that is more than a morning.
- **An act that fills the month** (a job, study, a course) carries on each month until stopped. Its fan then shows a shut Ongoing button with a Stop beside it.
- **Entering a building** is a cut: the screen goes dark for under half a second and the room opens as its own scene.

<div style="display:flex;gap:12px;flex-wrap:wrap">
  <img src="/pictures/dev-06-the-world.webp" alt="The family house seen whole from above early in a life: the band with the name, the part of the day, the age and the money, a line from the brother over the house, and the round Map and Phone buttons with Go places and Chats, bank, news between them" width="220">
  <img src="/pictures/home-family-house-parlour.webp" alt="The family house eased in on the parlour, its things carrying their dots" width="220">
  <img src="/pictures/dev-18-month-3-thing-sheet.webp" alt="A thing's card: Read the official page, what it is, and the one button with when it happens" width="220">
</div>

## Speech bubbles and the corner line

Nothing narrates over the middle of the world. Words go to one of two places.

**Over a head.**

- A bubble floats over a person only when that person is near the character ("You have eaten? Sit small.").
- At most one bubble shows, of at most eight words, for about four seconds, gone on a tap. After an overheard line, at least thirty seconds of quiet follow.
- A longer line is clipped in the bubble; a tap opens it whole in a sheet with the speaker's name.
- An overheard line names its speaker where one person plainly says it (Mama at home, a conductor calling his stop, a trader calling her goods), and floats over them while they stand near the character. Any other line is Someone nearby, or Someone in the house at home.
- Nothing speaks in the first seconds in a new place, nor over a sheet, the phone or the map.
- The rest of the street's life is shown as pictures over people (a plate, a naira sign, a danfo). A tap on one is a tap on that person.

**In the corner.** Only the answer to the player's own act goes in the bottom corner, one line at a time ("Mama presses a bag of oranges on you."), for a few seconds. Street talk tied to nobody never goes there.

Other feedback:

- An act the scene shows by a pose alone (sitting, lying down) gets no line.
- A planned act shows as Ongoing on its fan, never as a line.
- Money that comes in from something the player did slides in under the band as a short toast with a picture and the figure, and a coin flies to the money counter.
- A refusal shakes the button and plays a low double note.

::: info People in a place
A place shows a sample of people, never a list, and no count beyond a band (quiet, busy, packed). Online, other players fill it before the city's residents do, up to the place's headcount, while the people a place needs (the trader at her stall, the clerk at the counter, the officer behind the desk) always stay. A resident carries no tag; a tap opens a small card with a name, a role and "Lives in the city". Online, another real player carries a name tag only when close by or after a tap. The sample for a place on a given day is the same for everyone, chosen from a hash, never from the simulation's draws.
:::

## The map and the rides

<div style="display:flex;gap:12px;flex-wrap:wrap">
  <img src="/pictures/dev-07-map-with-a-stop-picked.webp" alt="The painted map folded on Bode Thomas with Bode Thomas Street picked, and the ride sheet: danfo, keke, okada or walk with fares and minutes, and Go" width="220">
  <img src="/pictures/dev-08-on-the-ride.webp" alt="On the danfo to Bode Thomas Street, seen from above, with Turn back and Skip, and a line at the foot" width="220">
</div>

The map is one painted Lagos, drawn in the game's sticker style.

- **Folded**, it is a strip at the top of the screen over a card for one neighbourhood (the same drawing, zoomed in). The strip shows the lagoon, the bridges, Makoko, the stadium, the towers and the toll gate, small, with a dot for where you are, a house for home and a yellow dot for the step's place. A swipe moves between the nine neighbourhoods.
- **Unfolded**: a tap or a drag down on the strip unfolds the whole map, and a tap on a district or a place folds it back to that card.
- The map opens on the card of the neighbourhood the character is in, or on the step's when a step is live.
- Every built place stands as a sticker of its own picture, and the sticker is the pin. A ring shows only where you are, on the stop picked and on the step's place.
- Unbuilt places are not on the map. A stop the story has not reached yet (the visa centre before decision day, the airport before the send-off) opens later in the life.

Picking a stop opens the ride sheet: the place's picture and name, then the danfo, the keke, the okada and on foot as picture tiles with a fare and minutes under each, the balance before struck through and the balance after, and one Go naming the way and the fare. The route draws as a dotted yellow line with a danfo on it.

- The fare leaves the naira, cash first.
- Walking is free and the slowest. It is open only to a stop within two kilometres, except a walk to or from home when the money cannot pay any ride.
- While the character's car stands at home, Drive comes first.

The ride then plays, cutting between its angles by itself, and can be skipped.

::: details Exceptions in the city
- **No money for a fare.** The ride sheet opens on the first way the money held pays, so with no fare a stop in walking distance opens on Walk, and a farther one says "Too far to walk". The nudge then names a free step instead.
- **Many acts.** A fan shows up to six buttons, a seventh peeking. With no room beside the thing, or more than eight buttons, the same buttons open on a small sheet.
- **A step that belongs elsewhere.** An ask that belongs at a place is answered there. Away from it, the asks sheet says someone is waiting at that place, and its one button goes there by the map.
- **One country at a time.** The map's dropdown names the country shown; other countries are listed locked with the reason.
- **Slow devices.** A phone starts in the low graphics mode, with fewer people. Motion is never turned off, only the mesh is coarser. An idle scene lowers its frame rate.
:::

::: tip One look, two paints
The interface is one light system: pale sky surfaces, white cards with a navy edge, navy ink, danfo yellow for the one action, and Rubik for the words. At the world's night the same shapes repaint in navy with cream ink, and the yellow action stays the same. There is no look to pick in Settings. The 3D world keeps its own colours, its sky and lamps following the world's clock.

<img src="/pictures/city-danfo-theme.webp" alt="The family house at the world's night: the band and its lines in the navy paint, the rooms lit, and words from someone in the house over it" width="200">
:::

## Rules it rests on

- [The world](../../rules/world.md): world:world-fills-the-screen (what is on screen), world:top-band-is-a-pill (the band), world:thumb-buttons-carry-dots (the thumbs and the turn button), world:things-are-tappable-models (things, acts, bubbles, the marker and the corner), world:camera-always-raised (the camera), world:nothing-roams (nothing roams), world:place-is-one-screen (a place is one screen), world:entering-is-a-cut (the cut), world:map-is-painted-lagos, world:one-country-at-a-time and world:ride-sheet-shows-fares (the painted map and the ride sheet), world:colours-are-role-tokens (one look, two paints), world:street-talk-budget (the talk budget), world:ride-cuts-between-angles (the ride's angles), world:no-walkthrough-before-play (the thumbs' first words), world:fan-of-sticker-buttons (the fan).
- [The city](../../rules/city.md): city:places-change-no-state (the city changes no state), city:overheard-talk-from-view (talk only from what the view holds), city:crowd-sample-capped, city:players-fill-the-crowd, city:sample-seeded-by-date and city:residents-fill-to-target (the sample, players before residents), city:two-graphics-modes and city:motion-never-turned-off (graphics modes), city:tap-to-walk (tap to walk), city:residents-carry-no-tag and city:players-carry-name-tags (residents and players).
- [Place](../../rules/place.md): place:rides-between-city-places (the ride's fare).
