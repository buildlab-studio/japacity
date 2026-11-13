# The world first

**Context and scope.** Why the game is shown as a 3D place the player touches, with everything else opening over it. This is a design for the screen, not a rule of the life: nothing here changes the money, the server or the commands. The rules are on [`../rules/world.md`](../rules/world.md); this page gives the reasons. Related pages: the look is [page 09](09-the-games-look.md), the month lived by hand [page 08](08-the-lived-month.md), and the map is set by [decision 0026](../decisions/0026-the-painted-map-that-folds.md).

**Goals.**

- The world fills the screen from the first second, and a picture of any screen shows a place.
- Every act happens somewhere: at a thing, a person or a spot in a place.
- A place stays cheap enough to draw on a cheap phone.

**Non-goals.** Free roaming; a tab bar; pages that cover the world; a month plan with every activity on one page; a camera at eye level; places on the map that are not built; a page view kept behind the world (world:no-classic-view-kept).

## 1. Summary

The world is the game, and the sheets support it. The player always stands in a place and plays by touching it. Everything else is a see-through sheet that slides up over the live scene while the place keeps moving behind it.

## 2. What a player sees

Each point is a design choice and its reason; the rule named beside it holds the detail.

1. **A life opens in a place.** The 3D place fills the screen from the first second, with only a thin band at the top and two thumb buttons, Map and Phone, at the bottom corners. There is no tab bar, because a tab bar turns a life into a menu (world:world-fills-the-screen, world:top-band-is-a-pill).
2. **Acting is tapping the world.** What a player can do is shown as things, people and spots in the place: the kiosk sells the ticket, the agent's desk takes the application, the bed ends the month. A tap sends the same command a page would send (world:things-are-tappable-models). What a place offers is what content stages there ([`city.md`](../rules/city.md), the places tables).
3. **Sheets, never pages.** Money, people, news and the guides slide up over the dimmed scene, which keeps moving, so a picture of any screen still shows the place behind it (world:world-fills-the-screen).
4. **One action, one sheet.** Paying the bills, buying a ticket and applying for the visa each open their own small sheet with only their own controls, like one screen of a phone app. A month plan with every activity on one page would be a form (world:one-action-one-sheet).
5. **The month is lived in the scene.** The month turns when the player sleeps, and its results appear as one sheet over the place (world:sleep-ends-the-month, world:month-end-results-sheet). Set pieces, the scenes staged once at their moment (the interview room, the send-off party, December), play in their places the same way.
6. **One country at a time.** The map shows the country the character is in. The other countries are listed as locked, with the reason, so the player learns the world is bigger before they can go (world:one-country-at-a-time).
7. **A home point.** The game opens where the player last stopped, or at home; never on a menu or the map (world:opens-where-last-stopped).
8. **No free roaming.** A free-roam world on a phone frustrates players. A place is one screen's worth of ground, a tap walks the character to a thing, and travel between places is by the map and a ride (world:place-is-one-screen, world:nothing-roams).
9. **Places have types, and the type sets the contents.** A shop has its stock, a cashier and people buying and idling; a kiosk its counter and a queue; an office a desk and a wait; a street its doors, traders and traffic. The type gives a place its crowd and its tappable things, so a new place is mostly dressing.
10. **A raised view, moved by the pinch.** The camera looks down from in front and above, never from the side, because on a phone a side view hides things behind other things. The pinch moves between the whole place and a close view (world:camera-always-raised).
11. **Travel is a thing you tap.** A stop on the map opens the ride sheet, the ride plays, and the new place opens (world:ride-sheet-shows-fares). Entering a building is a cut to its room (world:entering-is-a-cut), not a camera or rendering trick inside one scene, so it stays cheap on a phone.
12. **Who is who is said once.** The terms page says once which figures are players and which are residents, and no screen labels residents as computers (city:players-carry-name-tags).
13. **People are met, never picked.** No partner, friend or sibling is chosen from a list. A person is met in a place the player already spends time in, and their calls and messages come through the phone (world:nobody-picked-from-list). The rules for pairs work underneath; the world is where they happen.
14. **The phone carries what a phone carries, and papers are a thing.** Texts, bill notices, the appointment and the bank are on the phone; the passport and the file are in a box at home, and go with the character to the desk (world:phone-holds-what-phones-hold).
15. **No two surfaces at one height.** Two flat faces at the same height flicker as stripes on a phone, so every place keeps one ground and anything laid over it sits a little above (world:faces-never-share-height).

## 3. The world, the map and the phone

Everything is held in three surfaces. Nothing is a page of its own.

| Surface | What it holds | How it opens |
|---|---|---|
| **The world** | The place on screen and the things in it. Every action that happens somewhere (the kiosk, the bills, the family meeting, the visa desk) is a tappable thing in its place, with its own small sheet | Always on screen; sheets slide up over it |
| **The map** | The painted map of the country: its stops, home, and the other countries (decision 0026, world:map-is-painted-lagos) | The Map thumb button |
| **The phone** | The support pages, each an app with its own small screen: the bank, the chats, the plan, the papers, the jobs, the draw, the news, settings | The Phone thumb button; the phone rises over the world one app at a time (world:phone-rises-over-scene) |

## 4. Only built places are shown

A player never sees a place that is not built: a name on the map with nothing behind it breaks the promise that every act happens somewhere. Each place shown is clearly itself, with several things to do. A place entry with no scene stays in content but off the map, and its acts are offered at a built place (world:map-is-painted-lagos). The places of every country are in [`city.md`](../rules/city.md).

Examples:

- The passport office in Ikoyi is a stop of its own, drawn on the visa centre's scene.
- No police station is built: the police certificate is asked for at the visa centre's notice (document:police-certificate-for-routes).
- The National Theatre in Iganmu has an entry and no scene, so it is not on the map (city:landmarks-built-to-outline).

The room abroad is one interior dressed per country, as the family house is dressed for the party. [Page 10](10-london.md) and [page 11](11-calgary-dubai-and-castel-volturno.md) give each country abroad its own places.

## 5. Presentation only

The world is how the game is shown, not a rule of it. The simulation, the rules of the life and the money, the server and the commands are the same whatever is on screen, and there is no page view behind the world (world:no-classic-view-kept).

The test of the design: take pictures of the first ten minutes of a new life on a phone. If any could be mistaken for a form, the design has failed.

## 6. What a place may cost

The shipped models are small, and a place's files are loaded when the player enters it. On a phone the cost is not bytes but draw calls, overdraw, and script run every frame for people and for moving sheets (cloth, flags, fronds, smoke and water that bend in the wind). So each part of a place has a limit, set in the rule beside it:

| Part | Why it is limited | Rule |
|---|---|---|
| Walking | A straight walk to a tapped thing, with no route-finding, costs no script every frame | world:nothing-roams |
| Place size | One frontage outdoors or one room indoors fills a portrait screen whole; a wide home is seen whole as one picture | world:place-is-one-screen |
| Crowds | People are the dearest thing to draw and animate | city:crowd-sample-capped, world:place-is-one-screen |
| Moving sheets | Each bends every frame | world:place-is-one-screen |
| Dancers | The send-off party is the one dancing scene, and the bar every other scene is held to | city:party-room-sets-the-bar |
| Two graphics modes | The device and the frames it draws choose low or high | city:two-graphics-modes |
| Shadows | Only in the high mode, and only from what moves | assets:lighting-set-by-place |
| Other players | They fill a scene before residents do, never its fixed parts | city:players-fill-the-crowd, city:residents-fill-to-target |
| Lines overheard | Words over people have no 3D cost | world:street-talk-budget |
| Signs | Text is drawn on buildings in code, not in textures | assets:sign-text-drawn-in-code |
| The camera | One raised view to tune and test | world:camera-always-raised |
| Places | Only built places are on the map | section 4 |

**What is built.** Scoped scenes: rooms indoors (the parlour, the visa desk, the agent's office, the test room, the clinic, the bank counter, the hub, the room abroad, the arrivals hall) and frontages outdoors where the action is on the street (the kiosk and the betting shop, the market stall, the hub's street, the stop). Travel is by the map and the ride, never on foot, and no code makes streets walkable.

## 7. Alternatives considered

- **Free roam.** A walkable city with route-finding around obstacles. Rejected: on a phone it frustrates, it costs script every frame, and every street would have to be built whole. One screen per place, with a ride between places, does the same job.
- **A tab bar and pages.** The usual phone game menu, and the reason a life sim reads as a form. Rejected: the world with sheets over it keeps the place in every picture.
- **One page for the month's plan.** Rejected: every activity on one screen is a spreadsheet. One action per sheet keeps each choice small.
- **An eye-level street camera beside the raised view.** Rejected: two cameras to tune and test, and a side view hides things behind things. One raised view covers both uses with the pinch.
- **Showing every place entry.** Rejected: a place with no model would be a name on the map with nothing behind it. Only built places are shown.
