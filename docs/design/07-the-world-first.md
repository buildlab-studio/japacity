# The world first

> The world is the game. Nothing below changes a rule of the life, the money, the server or the commands.
> Other pages hold parts of it: the look is `09-the-lively-layer.md`'s, the month is lived by hand (`08-the-lived-month.md`), and the map is the painted map that folds (decision 0026). The rules that carry this page are on `../rules/world.md`.

## 1. The decision in one line

The world is the game and the pages are support. The player is always standing in a place, and plays by touching it. Everything else is a see-through sheet over the live scene.

## 2. What a player sees

1. **A life opens in a place.** From the first second, the 3D place fills the screen, with a thin band at the top and two thumb buttons at the bottom corners (world:world-fills-the-screen). No tab bar.
2. **Acting is tapping the world.** The things a player can do are things, people and spots in the place: the kiosk sells the ticket, the agent's desk takes the application, the bed ends the month. A tap fans the thing's acts out of it, and the same command a page would send is sent. What a place offers is what the content stages there (`../rules/city.md`, the places table).
3. **Sheets, never pages.** Money, people, news and the guides each slide up over the dimmed, still-moving scene, one gesture to dismiss. Nothing covers the world fully: a picture of any screen shows the place behind it.
4. **One action, one sheet.** Paying the bills, buying a ticket, applying for the visa: each opens its own small sheet with only its own controls, as a screen of a phone app would be. There is no month plan with every activity on one page (world:one-action-one-sheet).
5. **The month is lived in the scene.** The month turns when the player sleeps, and its results land as one sheet over the place (world:sleep-ends-the-month, world:month-end-results-sheet). Set pieces (the interview room, the party, December) play in their places the same way.
6. **One country at a time.** The map shows one country: Lagos at home, the city the character lives in abroad. The other countries are listed locked with the reason, so the player learns the world is bigger before they can go, and the map never grows beyond a dozen places (world:one-country-at-a-time).
7. **A home point.** The game opens where the player last stopped, or at home; never a menu, never the map. Home is per country: the family house in Nigeria, the room abroad once the character lands (world:opens-where-last-stopped).
8. **Not free roam.** A whole free-roam world on a phone would frustrate. A place is one screen's worth of ground: a tap walks the character to a thing in a straight line, and travel between places is the map and the ride, never walking (world:place-is-one-screen, world:nothing-roams).
9. **Places have types, and the type says what is in it.** A shop has its stock, a cashier and people buying and idling. A kiosk has its counter and a queue. An office has a desk and a wait. A street has its doors, its traders and its traffic. The type gives a place its crowd and its tappable things, so a new place is mostly dressing. The actions the simulation offers there are the tappable things.
10. **A raised view, moved by the pinch.** The camera looks down from in front and above, never from the side: on a phone a side view hides things behind things. The pinch moves it between the whole place and close on the character (world:camera-always-raised).
11. **Travel is a thing you tap.** A stop on the map opens the ride sheet with each way's fare and time; the ride plays and the place opens (world:ride-sheet-shows-fares). A building the character can enter opens on a tap, as a cut to its room (world:entering-is-a-cut): no camera or rendering trick inside one scene, so it stays cheap on a phone.
12. **Who is who is said once.** The how-to-play guide and the about page say the city's convention in one line, "Players have a name over their head. Everyone else lives in the city." No other screen labels residents as computers.
13. **People are met, never picked.** No partner, friend or sibling is chosen from a list. A person is met in a place the player already spends time in (the meetup, the church, a friend's room), and their calls and messages come through the phone (world:nobody-picked-from-list). The pair rules work underneath; the world is where they happen.
14. **The phone carries what a phone carries.** Texts and the family group, bill notices, the visa appointment and its reminder, the plan's steps, the bank. **Papers are a thing.** The passport and the file live in a box under the bed at home; the Papers app shows a scan of what is in it. On the day of an appointment the character takes the file out from under the bed before the ride, and the file goes with them to the desk.
15. **No two surfaces at one height.** Stripes on the ground come from two flat faces sharing a height, the floor on the ground, a road strip on the floor, and from shadows at a grazing angle on a dark plane. Every place keeps one ground; anything laid over it sits a few millimetres up or draws with an offset; the shadow camera covers only the place, with a bias and a normal bias set; and the place check fails a file with two horizontal faces within a centimetre of each other.

## 3. The world, the map, the phone

Three places hold everything, and nothing is a page of its own.

| Holds | What | How it opens |
|---|---|---|
| **The world** | The place on screen and the things in it. Every action that happens somewhere (the kiosk, the bills, the family meeting, the visa desk) is a tappable thing in its place, with its own small sheet | Always on screen. A sheet slides up over it, see-through at the top so the place stays in view |
| **The map** | The painted map of the country: its stops, Home, and the other countries (decision 0026) | The Map thumb button |
| **The phone** | The support pages, each an app with its own small screen: the bank, the chats, the plan, the papers, the jobs, the draw, the news, settings | The Phone thumb button. The phone rises over the world; one app at a time, a way back to the phone, and a way back to the world |

Our own grouping, our own names, our own screens. A phone as the menu is a convention of life games; nothing else is taken from anywhere.

## 4. Fewer places

A player never sees a place that is not built. Each place is unmistakably itself, with several things to do; a place entry with no model of its own stays in the content switched off, its actions offered at a built place. The places of every country are in the places table of `../rules/city.md`.

The passport office and the police station have no room of their own; their desks stand in the visa centre's hall (`../rules/city.md`, document:police-certificate-for-routes). The National Theatre in Iganmu is not a place to visit: it has no landmark model (city:landmarks-built-to-outline).

The room abroad is one interior dressed per country, as the family house is dressed for the party. Pages 10 and 11 give each country abroad its own places on the same mold.

## 5. What stays as it is

The simulation, the rules of the life and the money, the server, the commands, the content's actions and offers, the asset pipeline, the people, the motion, the sound layer, the set pieces, the boards, the lottery, the guides' words. There is no page view behind the world (world:no-classic-view-kept).

The test of the whole: pictures of the first ten minutes of a new life on a phone; if any could be mistaken for a form, it has failed.

## 6. What the 3D layer loses

Measured 8 Oct 2026. The shipped assets are small (3.4 MB for ten places and all the people; a place is 64 to 128 KB). What costs on a phone is not bytes: it is draw calls, overdraw, and script run every frame for people and moving sheets. The 3D code is about 5,800 lines, and a good part of it serves roaming, which this design does not have.

| Part | As measured | In the game |
|---|---|---|
| Free roaming: route-finding round obstacles, strolling, the walk map (about 480 lines plus tests) | The player taps the ground anywhere and walks round things | **Cut.** A tap on a thing walks the character to it in a straight line, or the camera just turns to it. Nothing else walks |
| Place size: grounds of 40 to 70 metres, 13 to 34 model copies | Whole streets | **Shrink.** A street is one frontage of about 24 metres: the kiosk, the betting shop, the stop. An interior is a room of about 12 by 10 metres. Everything the journey needs fits a screen |
| Crowds: 8 low, 16 high, each on an idle loop | 14 to 17 people on most places | **Halve.** 4 to 6 outdoors in low, 8 to 10 in high; 2 to 4 in a room. The party keeps its ten |
| Moving sheets: bunting, hanging cloth, fronds, leaves, smoke, water, flags (469 lines, 5 to 6 per place) | Every place moves in five places | **One per place, none in low mode.** The place check already knows their cost |
| Dancers (the party set) | Three dancers at the send-off | Keep. It is one scene and the game's best moment |
| Two graphics modes with the frame watcher | Built and tested | Keep. It is small and it is what lets the game run on cheap phones |
| Shadows, haze, fog | Only in high mode | Keep as is |
| Other players shown in places | Built | On for everyone, filling a scene before residents but never its parts (city:players-fill-the-crowd, city:residents-fill-to-target) |
| Adverts in places | Built behind a switch | Off, as the rules say |
| Lines overheard | Cheap, no 3D cost | Keep. They are the city's voice |
| Sign anchors with text on buildings | Cheap | Keep |
| The hold-to-plan camera, the street camera at eye level | Two cameras | **Cut.** One raised view, moved by the pinch, snapping to whole or close |
| Places: 78 in content, 10 built | | **Only built places** (section 4). The rest are not on the map |

**What is built.** Scoped scenes: rooms indoors (the parlour, the visa desk, the agent's office, the test room, the clinic, the bank counter, the hub, the room abroad, the arrivals hall) and frontages outdoors for the beats that are street beats (the kiosk and the betting shop, the market stall, the hub's street, the stop). Travel is the map and the ride, never a walk. A place costs a third of a walkable street, and no code makes streets walkable.
