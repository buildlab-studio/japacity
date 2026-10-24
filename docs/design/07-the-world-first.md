# The world first

**Context and scope.** How the game is shown and touched: the player always stands in a 3D place and plays by tapping it, and everything else opens over that place. This page is the screen's design, not a rule of the life: nothing below changes the money, the server or the commands. Other pages hold parts of it: the look is `09-the-games-look.md`'s, the month is lived by hand (`08-the-lived-month.md`), and the map is the painted map that folds (decision 0026). The rules that hold this page are on `../rules/world.md`.

**Goals.**

- The world fills the screen from the first second, and any picture of any screen shows a place.
- Every act happens somewhere: a thing, a person or a spot in a place.
- A place stays cheap enough to draw on a cheap phone.

**Non-goals.** Free roaming, a tab bar, pages that cover the world, a month plan with every activity on one page, a camera at eye level, places on the map that are not built, and a page view kept behind the world (world:no-classic-view-kept).

## 1. The decision in one line

The world is the game and the sheets are support. The player is always standing in a place, and plays by touching it. Everything else is a see-through sheet over the live scene: a panel that slides up from the foot of the screen with the place still moving behind it.

## 2. What a player sees

1. **A life opens in a place.** From the first second, the 3D place fills the screen, with a thin band at the top (the band: the character's name, age and place, the month, the part of the day and the money, in one pill) and two round thumb buttons at the bottom corners, Map at the left and Phone at the right (world:world-fills-the-screen). No tab bar.
2. **Acting is tapping the world.** The things a player can do are things, people and spots in the place: the kiosk sells the ticket, the agent's desk takes the application, the bed ends the month. A tap fans the thing's acts out of it, and the same command a page would send is sent. What a place offers is what the content stages there (`../rules/city.md`, the places table).
3. **Sheets, never pages.** Money, people, news and the guides each slide up over the dimmed, still-moving scene, one gesture to dismiss. Nothing covers the world fully: a picture of any screen shows the place behind it.
4. **One action, one sheet.** Paying the bills, buying a ticket, applying for the visa: each opens its own small sheet with only its own controls, as a screen of a phone app would be. There is no month plan with every activity on one page (world:one-action-one-sheet).
5. **The month is lived in the scene.** The month turns when the player sleeps, and its results land as one sheet over the place (world:sleep-ends-the-month, world:month-end-results-sheet). Set pieces, the scenes staged once at their moment (the interview room, the send-off party, December), play in their places the same way.
6. **One country at a time.** The map shows one country: Lagos at home, the city the character lives in abroad. The other countries are listed locked with the reason, so the player learns the world is bigger before they can go (world:one-country-at-a-time).
7. **A home point.** The game opens where the player last stopped, or at home; never a menu, never the map. Home is per country: the family house in Nigeria, the room abroad once the character lands (world:opens-where-last-stopped).
8. **Not free roam.** A whole free-roam world on a phone would frustrate. A place is one screen's worth of ground: a tap walks the character to a thing in a straight line, and travel between places is the map and the ride, never walking (world:place-is-one-screen, world:nothing-roams).
9. **Places have types, and the type says what is in it.** A shop has its stock, a cashier and people buying and idling. A kiosk has its counter and a queue. An office has a desk and a wait. A street has its doors, its traders and its traffic. The type gives a place its crowd and its tappable things, so a new place is mostly dressing. The actions the simulation offers there are the tappable things.
10. **A raised view, moved by the pinch.** The camera looks down from in front and above, never from the side: on a phone a side view hides things behind things. The pinch moves it between the whole place and close on the character (world:camera-always-raised).
11. **Travel is a thing you tap.** A stop on the map opens the ride sheet with each way's fare and time; the ride plays and the place opens (world:ride-sheet-shows-fares). A building the character can enter opens on a tap, as a cut to its room (world:entering-is-a-cut): no camera or rendering trick inside one scene, so it stays cheap on a phone.
12. **Who is who is said once.** The terms page says the city's convention in one line, "Players carry a name over their head. Everyone else lives in the city.", and a resident's card ends "Lives in the city." (city:players-carry-name-tags). No screen labels residents as computers.
13. **People are met, never picked.** No partner, friend or sibling is chosen from a list. A person is met in a place the player already spends time in (the meetup, the church, a friend's room), and their calls and messages come through the phone (world:nobody-picked-from-list). The pair rules work underneath; the world is where they happen.
14. **The phone carries what a phone carries.** Texts and the family group, bill notices, the visa appointment and its reminder, the plan's steps, the bank. **Papers are a thing.** The passport and the file live in a box under the bed at home; the Papers app shows a scan of what is in it. On the day of an appointment the character takes the file out from under the bed before the ride, and the file goes with them to the desk (world:phone-holds-what-phones-hold).
15. **No two surfaces at one height.** Two flat faces sharing a height draw as stripes on a phone, so every place keeps one ground and anything laid over it sits a little above (world:faces-never-share-height).

## 3. The world, the map, the phone

Three places hold everything, and nothing is a page of its own.

| Holds | What | How it opens |
|---|---|---|
| **The world** | The place on screen and the things in it. Every action that happens somewhere (the kiosk, the bills, the family meeting, the visa desk) is a tappable thing in its place, with its own small sheet | Always on screen. A sheet slides up over it, see-through at the top so the place stays in view |
| **The map** | The painted map of the country: its stops, Home, and the other countries (decision 0026) | The Map thumb button |
| **The phone** | The support pages, each an app with its own small screen: the bank, the chats, the plan, the papers, the jobs, the draw, the news, settings | The Phone thumb button. The phone rises over the world; one app at a time, a way back to the phone, and a way back to the world |

## 4. Only built places

A player never sees a place that is not built. Each place is unmistakably itself, with several things to do; a place entry with no scene stays in content, off the map, and its acts are offered at a built place (world:map-is-painted-lagos). The places of every country are in the places table of `../rules/city.md`.

The passport office in Ikoyi is a stop of its own drawn on the visa centre's scene. No police station is built: the police certificate is asked at the visa centre's notice (document:police-certificate-for-routes). The National Theatre in Iganmu has an entry and no scene, so it is not on the map (city:landmarks-built-to-outline).

The room abroad is one interior dressed per country, as the family house is dressed for the party. Pages `10-london.md` and `11-calgary-dubai-and-castel-volturno.md` give each country abroad its own places.

## 5. Under the world

The world is how the game is shown, not a rule of it. The simulation, the rules of the life and the money, the server and the commands are the same whatever is on screen: a tap in the world sends the command a page would send. There is no page view behind the world (world:no-classic-view-kept).

The test of the whole: pictures of the first ten minutes of a new life on a phone; if any could be mistaken for a form, it has failed.

## 6. What a place costs

The shipped models are small: a place's own files come to well under 150 KB, loaded when the player enters it. What costs on a phone is not bytes but draw calls, overdraw, and script run every frame for people and moving sheets (the cloth, flags, fronds, smoke and water that bend in the wind). So a place is held to these:

| Part | In the game | Rule |
|---|---|---|
| Walking | A tap on a thing walks the character to it in a straight line, or the camera turns to it. Nothing else walks; there is no route-finding | world:nothing-roams |
| Place size | Outdoors, a frontage of about 24 metres: one stretch of street seen from in front, the kiosk, the betting shop, the stop. Indoors, a room of about 16 by 9 metres seen down its length. A wide home is about 13 by 13 or 9 by 8 | world:place-is-one-screen |
| Crowds | At most 6 people outdoors and 4 in a room in the low mode, 10 and 6 in the high; the send-off party keeps its ten | city:crowd-sample-capped |
| Moving sheets | At most one per place, none in the low mode | world:place-is-one-screen |
| Dancers | Three at the send-off party, the game's one dancing scene | city:party-room-sets-the-bar |
| Two graphics modes | Low and high, chosen by the device and the frames it draws | city:two-graphics-modes |
| Shadows | Only in the high mode, only from people and vehicles | assets:lighting-set-by-place |
| Other players | Shown in places, filling a scene before residents but never its parts | city:players-fill-the-crowd, city:residents-fill-to-target |
| Lines overheard | Words over people, with no 3D cost | world:street-talk-budget |
| Signs | Text drawn on buildings in code | assets:sign-text-drawn-in-code |
| The camera | One raised view, moved by the pinch, snapping to whole or close | world:camera-always-raised |
| Places | Only built places are on the map | section 4 |

**What is built.** Scoped scenes: rooms indoors (the parlour, the visa desk, the agent's office, the test room, the clinic, the bank counter, the hub, the room abroad, the arrivals hall) and frontages outdoors for the beats that are street beats (the kiosk and the betting shop, the market stall, the hub's street, the stop). Travel is the map and the ride, never a walk, and no code makes streets walkable.

## 7. Alternatives considered

- **Free roam.** A walkable city with route-finding round obstacles. On a phone it frustrates, it costs script every frame, and it makes every street a whole street to build; one screen per place and the ride between them do the same job.
- **A tab bar and pages.** Every phone game's menu, and the reason a life sim reads as a form; the world with sheets over it keeps the place in every picture.
- **One page for the month's plan.** Every activity on one screen is a spreadsheet; one action, one sheet keeps each choice small.
- **An eye-level street camera beside the raised view.** Two cameras to tune and test, and a side view hides things behind things; one raised view does both jobs with the pinch.
- **Showing every place entry.** A place with no model would be a name on the map with nothing behind it; only built places are shown.
