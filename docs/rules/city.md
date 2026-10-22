# The city

> Rests on `../design/06-assets-and-visuals.md`, `../design/01-concept.md` sections 9, 10, 15 and 17, `../research/08-real-places-and-map-data.md`, `place.md`, `route.md`, `road.md` and `text.md`. Positions were checked against OpenStreetMap on 8 Oct 2026.
> Kind: `place`, with one entry per 3D place, world scope, as `../design/03-structure-and-conventions.md` section 7 lists it. The assets the places are built from follow `assets.md`. The pipeline is `../decisions/0009-models-are-code.md`.

The city is where the life is seen. It is a set of 3D places: streets, markets, bus stops, the airport, a room. The player walks between them for free. The city reads the view and shows it; it never changes the simulation. Activities, offers and set pieces are staged in the place where they would happen, so a month in the game looks like a month in Lagos, or in Peckham, or in Deira.

## Rules: what the city is allowed to do

**city:places-change-no-state** The city has no command, effect, state or stream of its own in the simulation. Entering, leaving, walking round a place and tapping are client state only: they cost no turn and the authority never hears of them. An act picked on a thing, a sleep and a wake send the simulation's own command for that act, the one its sheet sends (world:things-are-tappable-models, world:fan-of-sticker-buttons, world:sleep-ends-the-month), and nothing else.

**city:place-shows-only-the-view** The city shows only what the view holds (engine:view-holds-no-hidden-field). A place may show a scene for an open set piece, an offer that is open, an activity in the month's report, a news story already delivered, or a route the character has heard of. It never shows a hidden field: not whether an offer is a fraud, not a sign the offer did not show, not a score, not a route still unknown.

**city:overheard-talk-from-view** Talk overheard in a place is drawn only from the view: delivered news stories and routes already heard. It is a line from content, chosen on the client from the place's id and the day (city:enterable-places-follow-view), and it never makes a route heard. Hearing stays the simulation's (route:hearing-a-route, route:friend-tells-by-month).

## Rules: places and their names

**city:place-entry-fields** A place is an entry `place.<slug>` with the fields in the Contract: `where`, `country`, `city`, `area`, `nameKind`, `realName`, `position`, `data`, `sponsor`, `scope`, `hub`, `stages`, `crowd`, `traditionalBp` and `assets`. The content check refuses an entry whose fields break city:four-kinds-of-name, city:namesakes-never-shown, city:made-up-names-checked, city:positions-rough-on-purpose and city:positions-not-for-geometry.

**city:four-kinds-of-name** A name is one of four kinds, set in `nameKind`:
- `public`: areas, roads, markets, bridges, bus stops, stations, parks, airports. The real name is used, spelt as on the official sign, and `realName` holds it.
- `institution`: visa centres, test centres, embassies, passport offices, clinics, universities, hospitals, churches and mosques. A plain description is used ("the visa centre", "the English test centre"), `realName` is null, and the entry carries an `area` but no `position` from the map, so no real office is pinned; a made-up spot of its own, `source: "own"`, is allowed (city:positions-rough-on-purpose).
- `business`: shops, banks, salons, hubs, care homes, transfer shops. A made-up name is used and `realName` is null, unless `sponsor` is set (city:two-graphics-modes).
- `stylised`: a place the record does not let us name (the road, `road.md`). It has no real name, no area, no position from the map (a made-up spot of its own is allowed, city:positions-rough-on-purpose) and no sponsor.

**city:namesakes-never-shown** A public place named after a person (a road, a square, the airport) keeps its public name, because that is what is on every sign and map. The person is never shown, voiced, quoted or described anywhere in the game.

**city:made-up-names-checked** A made-up business name is checked before it is used: searched online with the city's name and in that country's public company register, and replaced if a business with that name or one close to it trades in that city. The check, its date and the searches are recorded in the register row of the place's sign (`assets.md`, assets:register-matches-every-file). Every made-up name in the tables below is a working name until it passes.

**city:positions-rough-on-purpose** A position is rough on purpose: latitude and longitude as whole thousandths of a degree (`latE3`, `lonE3`), about 110 m. It comes from a one-off hand lookup in OpenStreetMap, fewer than 100 features in all, and records its source, licence (`ODbL-1.0`) and the date checked. Nothing is fetched from Google Maps, whose terms forbid keeping it (`../research/08`). A place the lookup did not find records `source: "own"` and the nearest feature that was found. A place with no address of its own (an office or a clinic known by its area, a home on a made-up street) carries a made-up spot in its area, placed by hand against the public places round it, `source: "own"` with no licence, so the map and the fares (place:rides-between-city-places) read one position for every place; their room alone has none, standing near whoever lives there (world:nobody-picked-from-list); a rented home is on the map only while lived in (home:compound-room-is-a-home).

**city:positions-not-for-geometry** Positions are for checking and for the layout of the map screen, not for building geometry. A place's buildings are made from the kit (`assets.md`); only a landmark's outline may be taken from open map data, and then that outline is credited like any other map data (city:credits-screen-attributions).

## Rules: what happens where

**city:places-stage-their-acts** Each place lists in `stages` the activities, offers, set pieces and chapters staged there. An id appears in the `stages` of at most one place for each `where` and country. An abroad place with `country` null (the room) serves every country, and a place of the character's own country that stages the same id is shown instead. An id staged nowhere is shown at the default place for the character's `where`: `place.family-house` at home, `place.the-room` abroad, and the stylised `place.road-night` on the road. The content check refuses a staged id that does not exist. One id is the exception (design page 10 section 4): `activity.overtime`, which is the rota board's act at every workplace of the character's country (the care home, the ward, the warehouse, the big shop's notice in London; world:ride-abroad-and-workplace), so a place may stage it although another place of the same country already does; the content check allows that id alone at several places.

**city:set-piece-shown-where-staged** When the view has a set piece open, the city shows it in the place that stages it, with the question on screen, once the player is there; staged elsewhere, the nudge says it waits at that place and a tap opens the map with the stop picked, since the city never moves the player without a ride (world:one-action-one-sheet). When a month's report is read, each line about an activity may be shown in the place that stages the activity. The player can always leave the scene for the plain panel; the scene is never required to answer.

**city:enterable-places-follow-view** The places a player can enter follow the view's `place`: at home every place with `where: "home"`; abroad the places of the character's `country`; on the road only stylised places. A place of another country is never shown while the character is not there.

**city:ojuelegba-is-the-hub** The hub is the place every life opens in, and the only place in the first download. At home it is `place.ojuelegba`, the junction where Surulere, Yaba and Mushin meet and the danfos load, because it is public, busy, close to all three starting homes in `scenario.md`, and shows the city's motion in one view. Abroad, the hub is the country's area marked `hub: true` below, downloaded on arrival.

## Rules: presence

**city:crowd-sample-capped** A place shows a sample of the people in it, never a list and never a count beyond a band (`quiet`, `busy`, `packed`). In the low graphics mode the sample is at most `tuning.city.crowdLow` people, in the high mode at most `tuning.city.crowdHigh`, each capped by the place's own `crowd` figures and by the people world:place-is-one-screen allows a place of its scope (6 low and 10 high outdoors, 4 and 6 indoors), except in a place dressed for the send-off party, which keeps its own crowd. The tuning's 8 and 16 are over every scope's cap, so the scope's cap is what binds.

**city:players-fill-the-crowd** Other players chosen by the authority fill a sample before computer people do: they take every slot no part holds (city:residents-fill-to-target), and computer people built from the place's dress mix (city:dress-mix-by-place) fill only the slots no player takes. Every player in a sample carries their account's username (account:username-and-unconfirmed-email) and the look picked at the door (account:person-kept-with-character), whether or not the two joined through each other; when the name shows is city:players-carry-name-tags. A character in a place is a game profile, and seeing it is not contact (region:same-contact-everywhere). No other player is ever shown in a home: the family house, the room in the compound, the hostel room, the room abroad and their room (content's `PRIVATE_PLACES`, which names each home of `home.md` as private or not). The authority's sample for a home is always empty, and the client draws no player there whatever sample it holds, so a home shows its own people alone. Makoko is a public neighbourhood scene with the rented room as one thing on its walk, so players show there as at any public place.

**city:dress-mix-by-place** The dress mix of a place is `traditionalBp`, the share of people in traditional cloth, from the design table: market and roadside lean traditional, office, hub and campus lean modern. On Fridays men in the sample take jalamia and cap at `tuning.city.fridayBp`; on Saturdays a place with `occasion: true` takes aso ebi, gele and agbada at `tuning.city.saturdayBp`. The day is the world's real date, which the client already has.

**city:sample-seeded-by-date** The sample is chosen on the client from a hash of the place's id, the real date and the person's slot, never from a stream of the simulation and never from `Math.random`. The same place on the same day shows the same people, so a screenshot taken twice is the same.

## Rules: loading and graphics

**city:places-load-on-entry** A place loads when the player enters it and is cached after. Its files are named by content hash and kept in the browser's cache, so a second visit downloads nothing. Only the hub is in the first download (5 MB with the code and one character, `../design/06` section 6). In the low mode no other place is fetched before it is entered. While a place loads, the screen shows its name and the progress, and the panels stay usable. The progress is a filling bar (role progressbar), never a percentage: the shared loader (engine:browser-authority-for-dev-only) under the place's name, filled to the share of its models in. In the world the note stands under the band, never behind it.

**city:two-graphics-modes** The game has two graphics modes. A desktop (a fine pointer and a window at least `tuning.city.desktopMinWidth` CSS pixels wide) starts in `high`. A phone, or a fine pointer in a narrower window, starts in `high` when its screen is sharp (pixel ratio 2 or more) and it has at least `PHONE_HIGH_MEMORY_GB` (4) of memory, or a memory the browser keeps to itself (Safari); a coarse screen or less memory starts in `low`. After `tuning.city.raiseAfterMs` in a place, if 95 in 100 frames took at most `tuning.city.raiseFrameMs`, `low` rises to `high`. In `high`, if 95 in 100 frames over `tuning.city.dropAfterMs` took more than `tuning.city.dropFrameMs`, it drops to `low` and stays there for the session. The player may fix either mode in settings, kept per device. A phone that could run `high` starts there, since a rise from `low` reads as the game starting on poor graphics and then improving.

| | `low` | `high` |
|---|---|---|
| Pixel ratio | 1 | The device's, at most `tuning.city.maxPixelRatio` |
| Shadows | None | Characters and vehicles only, from the one sun (`../design/06` section 5) |
| People in a sample | `crowdLow` | `crowdHigh` |
| Fog distance | Near | Far |
| Atmosphere (haze, rim light, rain) | Off | On |
| Antialiasing | Off | On |

## Rules: sponsors, the road, credits

**city:landmarks-built-to-outline** A landmark is built only to the outline and the reviewer's sheet in `assets.md`, never to a copy of its drawings or a photo. Landmarks are built, kept low-poly and stylised; a landmark the maintainer has not cleared is shown as an ordinary kit building in the same role, and any landmark is swapped the same way on request.

**city:credits-screen-attributions** The credits screen, reachable from the menu, carries: "Map data from OpenStreetMap, available under the Open Database Licence" with "OpenStreetMap" linking to `openstreetmap.org/copyright`; the Overture Maps credit if any Overture data is used; the attribution text of every register row that has one; and a plain statement of where generated media is used (`../design/06` section 9). The OpenStreetMap attribution guidelines allow a credits page for games. The screen is reached from the phone's Settings and the city's menu. In Settings the credits and the guides are rows under About the game; the Credits row opens the same sheet, handed in by the shell so every player reaches it, online or not, and the account's own sheet holds no Credits row. Its sections, in order: map data; sound and art from others (the register's attributions); fonts; generated media, as one plain statement that does not repeat a register row; and the licences of guide:credits-state-licences with a link to `LICENSES.md` in the repository. A few lines each. Settings ends with a version line, "Version" and the build the page carries (the short commit of its `japacity-build` tag, server:production-and-staging), "local" when the page has none. Five taps on it within five seconds open the dedication page of account:dedication-page-and-its-doors; a sixth tap changes nothing, and nothing of it is counted or sent. The dedication line is "Dedicated to my best friend, Osoko Emmanuel (July 1998 to June 2026). From Al-Ameen." It is kept in content apart from the words tables, since it names a real person (the computer names of person:computer-names-generated stay the only names in them), and nothing else about him is anywhere in the game but the nickname under the dedication page's light (account:dedication-page-and-its-doors) and the page's foot, which carries the short form of the line, `DEDICATION_SHORT`; both are kept beside the line in content. The root README carries the same line as a hidden comment.

**city:sponsor-shows-name-only** A place with `sponsor` set shows the sponsor's real name and nothing else of theirs that the agreement does not list. The maintainer decides who may sponsor a place, at what price, and on what terms. Default: `sponsor` is null on every place. A sponsor is never set on an institution, on a stylised place, or on a place that stages an offer that can be a fraud. A real name may also stand on a place where the game only has the player visit, eat, shop or meet (a well-known food spot, mall, market or the like), as plain words only: no logo, no colours or shop design copied, never in the game's title, cards or marketing, and never a real person. Such a place never stages an offer that can be a fraud, a mishap or bad news. Public places (city:four-kinds-of-name) are not bound by this: they keep their own names whatever they stage. Each real name is one content entry (`place.<slug>.realName`) so removing it on request is one change.

**city:road-places-are-stylised** The road's places are stylised: no real name, no area, no position, no sponsor, no advert (road:road-earns-nothing). Every road offer and set piece is staged only at a stylised place, never at a real named one, so no real park or area is tied to the trade. The road's four steps after the truth (`desert`, `compound`, `coast`, `sea`) are shown on cards, not as 3D places.

**city:invented-names-for-risky-businesses** Invented names always for any business that lends, charges, employs, sponsors, refuses, or can cheat or fail in the game: banks, lenders, agents, employers, sponsors, schools and airlines. A content check fails a real name on any such entry. The about page and the terms carry one notice: names of places are used for realism, nothing is endorsed, and institutions and events are invented or simplified (`guide.page.about.names`).

**city:place-words-are-text-keys** Every word a place shows, its name included, is a text key in `packages/content/src/place/place.text.ts` (`<id>.name`, `<id>.blurb`, `<id>.sign.<n>`, `<id>.overheard.<n>`, and `<id>.overheard.<n>.by`, the speaker's name where one person plainly says the line, world:street-talk-budget). A public name's text equals its `realName`; the content check fails when they differ. Signs are drawn from these keys in code (assets:sign-text-drawn-in-code).

## Rules: ambient motion

A place moves on its own, and the motion is on by default everywhere. An experiment on one waterside corner (flag, washing, bunting, fronds, rolling water, smoke, blown leaves, a bobbing canoe, eight people idling) added one draw call and no script cost worth counting; finer meshes, not motion, slowed the frame.

**city:one-clock-one-wind** Every moving thing in a place reads one clock and one wind that the place owns: a time value and a wind value (a direction and a slow gust strength) updated once a frame and passed to every moving material as shared uniforms. Nothing keeps a clock or a wind of its own, so a gust moves the flag, the washing and the smoke together.

**city:motion-in-vertex-shader** Sheets (flags, washing, bunting, palm fronds, awning edges) are bent in the vertex shader from the pinned edge the model names (assets:one-shared-motion-material); water is a flat grid raised and lowered in the vertex shader, its crests whitened there; smoke and blown leaves are instanced, and each puff or leaf shrinks to nothing instead of fading. No moving surface uses a transparent material, and moving surfaces are flat shaded like the rest.

**city:no-script-loop-per-sheet** No sheet, water grid or particle has a script loop of its own: each frame the script updates the clock and the wind and nothing else for them. Plain script motion is kept to whole-object turns (a palm leaning, a canoe bobbing, a person idling). The place check renders each place still and moving and fails it when motion adds more than `motion.extraDrawCalls` draw calls or more than `motion.scriptUs` microseconds of script a frame on the cheap phone profile (city:party-room-sets-the-bar).

**city:motion-never-turned-off** Motion is never turned off by the graphics mode. The dial is mesh fineness: each place ships two mesh levels for its sheets and its water grid, `coarse` and `fine`, and the mode that the measured frame rate picks (city:two-graphics-modes) picks the level: `low` draws `coarse`, `high` draws `fine`. The experiment found that finer meshes cost about a fifth of the frame and the motion itself almost nothing, so the step back on a weak phone is the mesh.

**city:hidden-scene-idles** A scene nobody looks at idles: while the panels or the map stand in front of the city, it draws one frame a second, so the panels keep the processor. In front, it draws every frame.

## Rules: tap to walk

The world is the game and the sheets are support (`../design/07-the-world-first.md`): the player always stands in a place and plays by touching it. A place is one screen's worth of ground, never a free-roam world, so the player moves only as far as a tap on a thing needs.

**city:tap-to-walk** Tap to walk, as world:nothing-roams says: nothing roams. A tap on a thing walks the player's character to it in a straight line, stopping `tuning.city.stopShortMm` short of a person or object, and the act follows; the walk takes about one second whatever the distance, and a second tap ends it at once. A tap on the ground walks there only inside the place's walkable polygon, with no route round the things in the way. A routed walk is in the code with its tests behind `tuning.city.roam`, off, and that switch is what would bring it in: a route found on the place's blocked-ground map, built once on entering the place from every model's footprint and the place's walkable ground (assets:models-record-their-footprint), at `tuning.city.walkMmPerS`, searched on a 25 cm grid (under a millisecond a tap on the cheap phone profile in the middle case, worst about nine), so nobody walks through a bus. There is no joystick, no stick and no arrow keys.

## Rules: residents and players

**city:residents-fill-to-target** City residents fill a place: each place entry has a target headcount `crowd.target`, and the sample shows `min(crowd.target, the mode's cap from city:crowd-sample-capped)` people in all, whoever is there, so the crowd never grows with the number of players. Some of a place's spots are its parts, kept for the people its scene needs: each spot the place file names for a role (`prefer`: the trader at her stall, the hawker, the rider), each spot an act keeps for a man or a woman (the parents at home, the conductor at the danfo's door), and each seat an act marks `staff` (the clerk at the counter, the officer behind the desk, the invigilator, the nurse, the manager in the glass office, the colleague at the tea point who says a line, the family at home): someone the player acts with or who speaks for the place. A seat an act only poses is a visitor's or a filler's (a candidate's desk, a waiting chair, a pew, a plain desk in the office) and no part: a player takes it like any other slot and sits there as a resident would. Every part is drawn in either mode: the crowd's spots are the parts first, then the place's other spots in order, up to the mode's count and never past it. The build check refuses an act at a spot the place lacks, and a `staff` mark that is not `true`, on a crossing, or past the high mode's people. The residents who stand at the parts with no other player online, as city:sample-seeded-by-date chooses them, keep those spots whoever comes, and a player never takes a part. Other players take every other slot (city:players-fill-the-crowd), and residents fill only what is left. Someone standing at a thing of their own (world:place-is-one-screen) takes a filler resident's place first, then a player's seen there only today, then a player's there now, the last placed first each time, and a part's only when no one else is left to give way, so the scope's cap of world:place-is-one-screen always holds. Residents are the computer people of city:players-fill-the-crowd and city:dress-mix-by-place, chosen as city:sample-seeded-by-date chooses them. The targets live in the private settings (server:private-settings-and-dials); the public content holds working values.

**city:residents-carry-no-tag** A resident carries no tag and no mark over the head. A tap on a resident opens a small card with a name and a role from content and the line "Lives in the city", for example "Iya Bisi, trader. Lives in the city." A resident's name comes from the generated list of person:computer-names-generated.

**city:players-carry-name-tags** Another real player carries a name tag with their username over the head for as long as they stand in the place; a resident carries none, so a name over a head always marks a player. Players take every slot no part holds (city:players-fill-the-crowd), so in a busy place every head but the parts' may carry a name. The player's own character carries its indicator above the head always.

**city:players-shown-present-not-tracked** Other players are shown present, never tracked. A player who entered a place today (the Lagos day, as clock:december-by-lagos-time counts it) may be shown in that place standing, sitting or dancing at one of its spots, chosen on the client as city:sample-seeded-by-date chooses a slot. No position, path or movement of another player is ever sent: the authority's sample (`GET /api/place/:place`) gives the look and the username (city:players-fill-the-crowd), and whether the player is there now or was there today. Those seen today take the slots after those there now, and give way first when someone stands at a thing of their own (city:residents-fill-to-target). The place's object keeps today's list, at most `presence.todayMax` entries, in its own storage, cleared when the Lagos day turns, and never in the game's database. As world:nothing-roams says, nothing roams, so the people shown in a place stand, sit or dance at their spots and do not stroll. A stroll is in the code with its tests behind `tuning.city.roam`, off, and that switch is what would bring it in: residents and present players strolling between the place's spots now and then on city:tap-to-walk's route map, at walking pace, idling at each spot for a while, with no two on the same spot, as client state only, never synced, never costing a draw call.

## Rules: the bar every staged place meets

**city:party-room-sets-the-bar** The party room is the bar for every staged place. It is the family house (`place.family-house`) dressed for `offer.send-off-party`, the bag's second act, in the wide house's yard: the car, the carport and the line hidden, the crates moved, about ten people (`crowd.target` 10, the three dancers among them) idling on loops with random phase, tap to walk, the ambient motion of city:one-clock-one-wind, city:motion-in-vertex-shader, city:no-script-loop-per-sheet, city:motion-never-turned-off and city:hidden-scene-idles, and two dance loops played on three different bodies, one in an agbada and one in a wrapper. It is measured on the cheap phone profile: a browser at 360 by 640 CSS pixels, device scale 2, with the processor slowed 6 times.

**city:places-meet-party-room-bar** A place is accepted only when it meets the party room's bar: its crowd idles on loops with random phase, tap to walk works on its walkable ground, every sheet, water grid and particle follows city:one-clock-one-wind, city:motion-in-vertex-shader and city:no-script-loop-per-sheet, it ships both mesh levels (city:motion-never-turned-off, assets:sheets-ship-two-mesh-levels), and on the cheap phone profile it stays inside its draw-call and triangle budgets (assets:assets-and-places-within-budget) with its high-mode sample. Contributors are free in how a place is staged and what its crowd does above that bar. Frame times on the profile are recorded but gate nothing: the profile's renderer only compares one place with another, and no real cheap phone has been measured.

## Rules: boards

**city:boards-switch-when-and-who** Boards the player can switch between. Two pickers: when (`this-week`, `all-time`) and who (`everyone`, `friends`). All time ranks by the japacity figure as city:board-line-and-ranking gives it. This week ranks by how much the figure rose since the week began (Monday 00:00 Lagos time, clock:december-by-lagos-time), so a new player can top it; the figure at the start of each week is saved per character on the server when the week turns. Each of the four boards has its own switch in the switch row (`boards.this-week.everyone` and the rest, server:four-off-switches), changed with no deploy; all four start on. The joined-the-same-week board is in the code, switched off (`boards.joined-week`). A switched-off board is refused by the server with `switched-off`, and its screen is not loaded by the client until it is on. Computer characters are on no board (person:computers-never-win-scarce). The boards wear the lively dress on Chats' people page: the two pickers as segmented pills, each line a card with a round face sticker, the username, a You pill and the figure as a chip, this week's rise as a green chip, your own line ringed; the notes (paused, secure, failed) as cards.

**city:board-line-and-ranking** A board line holds the rank, the name and the figure (the japacity figure for its best route on all time; its rise since the week began on this week), ranked by that and then by the earlier account. Every board shows the top `board.size` and the player's own line. On every board, `everyone`, `friends` (accounts joined to the player's by an invite or a pair record, `pair.md`) and the joined-week board, the name is the account's username (the handle the player picked, account:username-and-unconfirmed-email; other players see it), the player's own line the same. Nothing else about a player travels on a board: no first name, no display name, no look (in the spirit of share:card-shows-only-own-character). The username, not the character's first name, since the four starting lives give four first names and a board of fifty would repeat them; the username is pseudonymous and public by design, and one name a player chose serves every board. The server reads every line's username in one read of the accounts; a line whose account is missing (a deletion under way) reads "A player". A line is `{ rank, username, figure, me }`. A guest account is on no board (account:social-needs-secured-account): a guest is read from the account's own state, never from a stand-in, so its rows are written unlisted, it reads no board (refused `guest-only` at the gate on `/api/boards/*` and by the route), and securing lists its rows at once. Since no look travels, another player's face on a board is drawn from the shown name (the same name always gets the same face, from the door's looks); your own line wears the look kept on the device.

## Entries: Lagos

Positions are `latE3, lonE3`. All checked against OpenStreetMap through its search service on 8 Oct 2026, source `osm`, licence `ODbL-1.0`, unless the note says otherwise. Ids not staged anywhere go to the default place (city:places-stage-their-acts).

### Public places

| Id | Name shown | Area | Position | Scope | What it is for | Stages |
|---|---|---|---|---|---|---|
| `place.ojuelegba` | Ojuelegba | Surulere | 6511, 3362 | exterior, **hub** | The bus stop under the bridge, danfos loading, hawkers, a crowd | `offer.fuel-scarcity`, `chapter.find-your-feet`, `activity.ask-around`, `activity.see-agent-stop`, `offer.agent-stop`, `offer.agent-promise`, `offer.agent-papers` |
| `place.national-stadium` | National Stadium | Surulere | 6497, 3365 | exterior, landmark | The old stadium and its car park. In 2026 the main bowl is decayed and unused, which the model shows. The gate and a stretch of the track, for a morning run (streets:stadium-morning-run) | `activity.morning-run` |
| `place.bode-thomas` | Bode Thomas Street | Surulere | 6490, 3355 | exterior | A shopping street: a lotto kiosk, a betting shop, a pharmacy | `activity.play-lotto`, `activity.bet-slip` |
| `place.adeniran-ogunsanya` | Adeniran Ogunsanya Street | Surulere | 6494, 3357 | exterior | Shops, a private school | `activity.job-teacher` |
| `place.costain` | Costain | Surulere | 6482, 3369 | exterior | A bus stop on the way to the Island | |
| `place.tejuosho-market` | Tejuosho Market | Yaba | 6504, 3370 | exterior | A market. Position from Tejuosho Avenue: the market itself was not found as a feature | `offer.mum-shop` |
| `place.yaba` | Yaba | Yaba | 6507, 3375 | interior (the hub's room, world:entering-is-a-cut) | Offices of young tech firms, a hub on an upper floor | `activity.meetup`, `activity.learn-tech`, `activity.build-portfolio`, `activity.job-junior-dev`, `activity.job-mid-dev`, `activity.job-hunt`, `activity.look-into-route`, `activity.apply-to-school`, `activity.see-adviser`, `activity.ask-someone-who-went`, `activity.job-bank-officer`, `activity.job-bank-senior` |
| `place.herbert-macaulay-way` | Herbert Macaulay Way | Yaba | 6505, 3378 | exterior | The main road through Yaba | |
| `place.akoka` | Akoka | Akoka | 6529, 3391 | exterior | The streets by the university gate | |
| `place.oyingbo` | Oyingbo | Ebute Metta | 6483, 3382 | exterior | A market and the rail stop | |
| `place.jibowu` | Jibowu | Yaba | 6517, 3367 | exterior | Interstate coach terminals: the way out of Lagos by road, legally | |
| `place.mushin` | Mushin | Mushin | 6525, 3352 | exterior | Dense streets, generators, workshops | |
| `place.ladipo-market` | Ladipo Market | Mushin | 6544, 3341 | exterior | Car parts | |
| `place.oshodi` | Oshodi | Oshodi | 6556, 3351 | exterior | The transport interchange, buses, hawkers. Position from the interchange | |
| `place.maryland` | Maryland | Ikeja | 6577, 3366 | exterior | A junction and bus stop | |
| `place.ojota` | Ojota | Kosofe | 6587, 3379 | exterior | A junction on the expressway | |
| `place.computer-village` | Computer Village | Ikeja | 6594, 3340 | exterior | Phone and laptop sellers and repairers, already named in `offer.laptop-fault`. A phone, the sales job and the repair apprenticeship (streets:buy-phone-at-computer-village, streets:phone-sales-job and streets:apprentice-learns-repair) | `offer.laptop-fault`, `activity.side-gig`, `activity.buy-phone`, `activity.job-phone-sales`, `activity.apprentice-repair` |
| `place.allen-avenue` | Allen Avenue | Ikeja | 6601, 3352 | exterior | Shops by day, night life after dark | `activity.ride-driving` |
| `place.ogba` | Ogba | Ogba | 6633, 3341 | exterior | A residential area with a market street and a salon | |
| `place.berger` | Berger | Ojodu | 6642, 3369 | exterior | A bus stop at the edge of the city | |
| `place.agege` | Agege | Agege | 6625, 3311 | exterior | The rail line and the bread sellers | |
| `place.mile-12-market` | Mile 12 Market | Kosofe | 6609, 3394 | exterior | The food market | |
| `place.ikorodu-road` | Ikorodu Road | Kosofe | 6605, 3401 | exterior | The road into the city from the north-east | |
| `place.lagos-ibadan-expressway` | Lagos-Ibadan Expressway | Ikeja | 6610, 3370 | exterior | The road out to the north | |
| `place.gbagada` | Gbagada | Kosofe | 6558, 3384 | exterior | Estates and offices | |
| `place.third-mainland-bridge` | Third Mainland Bridge | Lagos Lagoon | 6502, 3402 | exterior, landmark | The long bridge over the lagoon, about 11.8 km, opened 1990. The commute to the Island. One span and the space under it where people sleep (streets:sleeping-under-the-bridge) | `activity.sleep-rough`, `offer.bridge-theft`, `offer.bridge-mosquitoes`, `offer.bridge-night` |
| `place.makoko` | Makoko | Makoko, on the lagoon | 6495, 3390 | exterior | The settlement on stilts beside the bridge: houses on legs, canoes for streets, fish smoked on the racks. A room the character may live in (`home.md`) | the home's own entries while lived in (home:home-is-the-home-point) |
| `place.carter-bridge` | Carter Bridge | Iddo | 6467, 3385 | exterior | The bridge from Iddo to the Island | |
| `place.eko-bridge` | Eko Bridge | Iddo | 6474, 3376 | exterior | The other bridge to the Island | |
| `place.idumota` | Idumota | Lagos Island | 6463, 3387 | exterior | Traders and traffic at the foot of Carter Bridge | |
| `place.balogun-market` | Balogun Market | Lagos Island | 6463, 3387 | exterior | Cloth, aso ebi. Source `own`: not found as a feature; position from Idumota | `offer.aso-ebi` |
| `place.broad-street` | Broad Street | Lagos Island | 6456, 3384 | exterior | Old commercial street with bank branches | |
| `place.marina` | Marina | Lagos Island | 6446, 3395 | exterior | The waterfront road and the rail station | |
| `place.cms` | CMS | Lagos Island | 6449, 3390 | exterior | The bus stop and ferry terminal. Position from the ferry terminal | |
| `place.tafawa-balewa-square` | Tafawa Balewa Square | Lagos Island | 6447, 3402 | exterior | The parade ground and its gate | |
| `place.freedom-park` | Freedom Park | Lagos Island | 6449, 3397 | exterior | A park and events ground | |
| `place.obalende` | Obalende | Lagos Island | 6449, 3406 | exterior | The bus park | |
| `place.ikoyi` | Ikoyi | Ikoyi | 6452, 3428 | exterior | Quiet streets, high walls, gates | |
| `place.victoria-island` | Victoria Island | Victoria Island | 6430, 3426 | exterior | Offices, towers, a call centre | `activity.job-customer-service` |
| `place.lekki-phase-1` | Lekki Phase 1 | Lekki | 6448, 3459 | exterior | Estates, the homes of tutoring clients. Position from the ferry jetty | `activity.weekend-tutoring` |
| `place.lekki-epe-expressway` | Lekki-Epe Expressway | Lekki | 6452, 3555 | exterior | The long road east | |
| `place.ajah` | Ajah | Ajah | 6469, 3562 | exterior | A busy junction at the end of the peninsula | |
| `place.tarkwa-bay` | Tarkwa Bay | Lagos Harbour | 6400, 3396 | exterior | A beach reached by boat | |
| `place.national-theatre` | National Theatre | Iganmu | 6475, 3369 | exterior, landmark | The theatre by the expressway. Position from the rail stop named after it | |
| `place.mile-2` | Mile 2 | Amuwo Odofin | 6459, 3313 | exterior | A junction on the road west | |
| `place.festac-town` | Festac Town | Amuwo Odofin | 6468, 3284 | exterior | A planned estate of the 1970s | |
| `place.alaba-market` | Alaba International Market | Ojo | 6461, 3191 | exterior | Electronics traders and their apprentices | |
| `place.ikorodu` | Ikorodu | Ikorodu | 6619, 3504 | exterior | A town at the city's edge | |
| `place.airport-lagos` | Murtala Muhammed International Airport | Ikeja | 6574, 3321 | exterior and two interiors (departures, arrivals) | Leaving and coming back. OpenStreetMap spells it "Mohammed"; the sign uses the official spelling | `chapter.send-off`, `setpiece.december`, `activity.december-home` |

### Institutions, by plain description

| Id | Shown as | Area | Scope | Stages |
|---|---|---|---|---|
| `place.passport-office` | the passport office | Ikoyi | interior (the visa centre's hall, with a passport desk) | `activity.get-passport` |
| `place.visa-centre` | the visa centre | Victoria Island | interior | `activity.apply-for-visa`, `activity.apply-uk-care`, `activity.apply-uk-talent`, `setpiece.credibility-interview`, `activity.get-police-certificate` |
| `place.english-test-centre` | the English test centre | Ikeja | interior | `activity.sit-english-test`, `activity.study-english` |
| `place.tb-clinic` | the clinic: the TB test and the Gulf medical on one side, the ward where a nurse works on the other | Ikeja | interior | `activity.tb-test`, `activity.gulf-medical`, `activity.job-nurse` |
| `place.medical-centre` | the medical centre | Ikeja | interior | |
| `place.university` | the university | Akoka | exterior | none (the transcript is asked for by phone, world:phone-holds-what-phones-hold) |
| `place.general-hospital` | the general hospital | Surulere | interior | `offer.illness`, `offer.illness-worse` |
| `place.church` | the church | the home's area | interior | `offer.harvest` |
| `place.mosque` | the mosque | the home's area | exterior | |

### Businesses, by made-up name

Working names until city:made-up-names-checked is passed.

| Id or shopfront | Working name | In | Scope | Stages |
|---|---|---|---|---|
| `place.yaba-hub` | Third Floor Hub | `place.yaba` | interior | (inside `place.yaba`) |
| shopfront | Lagoonside Bank, Broad Street branch | `place.broad-street` | exterior sign | |
| `place.olokun-office` | Olokun Microfinance (already in `offer.held-funds`) | Victoria Island | interior | `offer.held-funds`, `offer.salary-loan`; the school's deposit is paid at its counter (route:deposit-secures-school) |
| shopfront | Five-Five Lotto | `place.bode-thomas` | exterior sign | |
| shopfront | Correct Score betting shop | `place.bode-thomas` | exterior sign | |
| shopfront | Bright Path School | `place.adeniran-ogunsanya` | exterior sign | |
| shopfront | Gold Crown Salon | `place.ogba` | exterior sign | |
| shopfront | Clearline Contact Centre | `place.victoria-island` | exterior sign | |
| `place.agent-office` | an office with a name on the door (the name is the offer's) | Ikeja | interior | `offer.held-funds-agent`, `offer.gulf-agent`, `activity.see-agent-office`, `offer.agent-office` |

### Homes and stylised places

| Id | Shown as | Scope | Stages |
|---|---|---|---|
| `place.family-house` | the family house, in the area the starting life names (`scenario.md`: Surulere, Ogba, Yaba) on a made-up street | exterior: one wide house of about 13 by 13 metres with its yard and carport, seen whole (world:room-seen-down-its-length) | default at home; `activity.rest`, `activity.family-time`, `activity.family-meeting`, `activity.night-support`, `offer.nepa-bill`, `offer.brother-fees`, `offer.roof`, `offer.family-pledge`, `offer.family-pledge-small`. `offer.send-off-party` is the bag's second act, dressed in its yard (city:party-room-sets-the-bar) |
| `place.compound-room` | your room in Ojuelegba: one rented room in a shared compound (stylised, `realName` null, no area, a made-up spot in Ojuelegba; Ojuelegba named in its words as neutral scenery under city:sponsor-shows-name-only; home:compound-room-is-a-home). On the map only as home, while lived in | interior: your room, a bathroom, a kitchenette and the compound yard, one wide house (home:compound-room-is-a-home) | nothing of its own: its things carry the home's own acts, staged at the family house (home:home-is-the-home-point) |
| `place.hostel-room` | your hostel room in Yaba: one small room of your own off a shared corridor (stylised, `realName` null, no area, a made-up spot in Yaba; home:move-home-once-a-month). On the map only as home, while lived in | interior: your room and the corridor, one wide house | nothing of its own: its things carry the home's own acts (home:home-is-the-home-point); the corridor's lines are its people's |
| `place.their-room` | one shared room dressed per person: a friend's room, or a partner's home once courting (stylised, `realName` null, no area; world:nobody-picked-from-list) | interior | `activity.see-someone` |
| `place.motor-park` | the motor park (stylised, `realName` null, no area) | exterior | `offer.road-park`, `offer.road-radio`, `offer.road-cousin` |
| `place.road-night` | a yard at night (stylised) | exterior | default on the road; `setpiece.road-night`, `setpiece.road-truth`, `offer.road-ransom-call`, `offer.road-exit` (the way out the cards promise, road:exit-is-assisted-return) |

## Entries: abroad

One area in each destination, where people from Lagos settle, plus the arrival point and the default room. Positions checked the same way and on the same date.

| Id | Name shown | Country | City | Position | Scope | Why here | Stages |
|---|---|---|---|---|---|---|---|
| `place.heathrow` | London Heathrow Airport | `country.uk` | London | 51468, -459 | interior (arrivals) | Where most flights from Lagos land | `return.md` departures home |
| `place.peckham` | Peckham | `country.uk` | London | 51473, -70 | exterior, **hub** | Called "Little Lagos": Nigerian settlement from the 1970s, and Nigeria is the top country of birth other than the UK in Southwark (2021 census) | `activity.job-hunt` (the jobs notice and the agency's stand), `offer.street-find-uk` (streets:street-finds-abroad) |
| `place.rye-lane` | Rye Lane | `country.uk` | London | 51468, -69 | exterior | The shopping street at the heart of it: food shops, salons, a transfer shop, churches above shops | `activity.send-money` (the transfer shop), `activity.street-shopping-uk` (the stalls), `activity.chicken-shop` and `activity.job-uk-kitchen-cash` (the chicken shop and its kitchen), `activity.naija-shop-uk`, `activity.barber-uk`, `activity.buy-clothes-uk`, `activity.pub-pint` (streets:london-life-by-hand) |
| `place.peckham-rye-station` | Peckham Rye | `country.uk` | London | 51470, -69 | exterior | The station: the train's stop and the pass | `activity.bus-pass-uk` (the ticket machine), `activity.job-uk-courier-cash` (the courier's bike); the train's platform |
| `place.big-shop-uk` | The big shop (a made-up name, city:invented-names-for-risky-businesses) | `country.uk` | London | 51474, -68 (made-up spot on Peckham High Street) | interior | The weekly shop and the part-time job (design page 10) | `activity.weekly-shop-uk`, `activity.job-uk-retail-part` |
| `place.care-home-uk` | The care home (made-up name) | `country.uk` | London | 51467, -54 (made-up spot in Nunhead) | interior | Where the care route's job is done | `activity.job-uk-care`, `activity.job-uk-senior-care`, `activity.overtime` |
| `place.ward-uk` | The ward on Denmark Hill (made-up name) | `country.uk` | London | 51468, -94 (Camberwell) | interior | The nurse's ward | `activity.job-uk-nurse` |
| `place.office-uk` | The office at London Bridge (made-up name) | `country.uk` | London | 51505, -86 | interior | The skilled, graduate and senior developer jobs | `activity.job-uk-skilled`, `activity.job-uk-graduate`, `activity.job-uk-senior-dev` |
| `place.warehouse-uk` | The warehouse on the Old Kent Road (made-up name) | `country.uk` | London | 51487, -62 | interior | The warehouse job | `activity.job-uk-warehouse` |
| `place.church-uk` | The church on the Old Kent Road (made-up name) | `country.uk` | London | 51486, -66 | interior | The community's place (world:nobody-picked-from-list) | `activity.community-uk` |
| `place.test-centre-uk` | The test centre | `country.uk` | London | 51494, -100 (made-up spot at Elephant and Castle) | interior, the scene `english-test-centre` | The UK's tests, on the paper (city:places-stage-their-acts: the country's own place stages what the country-less one stages) | `activity.nmc-tests`, `activity.driving-test` |
| `place.calgary-airport` | Calgary International Airport | `country.canada` | Calgary | 51122, -114014 | interior | The arrival | |
| `place.calgary-north-east` | The strip mall, north-east Calgary | `country.canada` | Calgary | 51090, -113960 (made-up spot in the north-east) | exterior, **hub** | Of 9,840 Nigerians who arrived in Alberta between 2016 and 2021, 6,170 settled in Calgary (2021 census, reported by CBC). The north-east is where newcomers settle; that part is a working choice, not sourced for Nigerians. The hub is a strip mall at a made-up spot in the north-east (design page 11), so the paper reads right | `activity.job-hunt` (the notice), `activity.coffee-ca`, `activity.naija-shop-ca`, `activity.barber-ca`, `activity.send-money` (the transfer counter at the African store), `offer.street-find-ca` |
| `place.ctrain-station-canada` | The CTrain station | `country.canada` | Calgary | 51073, -113977 (made-up spot on the north-east line) | exterior | The train's stop and the pass (design page 11) | `activity.transit-pass-ca` (the machine); the platform |
| `place.big-shop-canada` | The superstore | `country.canada` | Calgary | 51095, -113980 (made-up spot) | interior, the scene `big-shop-uk` | The weekly shop and winter clothes | `activity.weekly-shop-ca`, `activity.buy-clothes-ca` |
| `place.warehouse-canada` | The warehouse by the airport | `country.canada` | Calgary | 51110, -113990 (made-up spot) | interior, the scene `warehouse-uk` | The warehouse job | `activity.job-ca-warehouse`, `activity.overtime` |
| `place.care-home-canada` | The care home | `country.canada` | Calgary | 51080, -113995 (made-up spot) | interior, the scene `care-home-uk` | The care aide's job | `activity.job-ca-care-aide`, `activity.overtime` |
| `place.office-canada` | The office downtown | `country.canada` | Calgary | 51046, -114063 | interior, the scene `office-uk` | The professional and developer jobs | `activity.job-ca-professional`, `activity.job-ca-dev` |
| `place.library-canada` | The library | `country.canada` | Calgary | 51092, -113972 (made-up spot) | interior | The evening course (design page 11) | `activity.learn-tech-ca` |
| `place.church-canada` | The church hall | `country.canada` | Calgary | 51085, -113965 (made-up spot) | interior, the scene `church-uk` | The community's place (world:nobody-picked-from-list); "our church has a group for new people" | `activity.community-ca` |
| `place.registry-canada` | The registry | `country.canada` | Calgary | 51092, -113968 (made-up spot) | interior, the scene `english-test-centre` | Alberta's licence. Not entered, since `activity.driving-test` is the UK's alone (car:licence-and-driving-test) | (not entered) |
| `place.dubai-airport` | Dubai International Airport | `country.uae` | Dubai | 25252, 55367 | interior | The arrival | |
| `place.deira` | Deira | `country.uae` | Dubai | 25273, 55305 | exterior, **hub** | The older commercial district where African traders and workers are most seen. Thin evidence: a guide for West Africans and one essay; a working choice. Its spots (design page 11): the typing centre, the exchange house, the cafeteria, the African foods shop, the barber and the corner by the creek; the souq is at Naif and the Gulf jobs at the site | `activity.job-hunt` (the typing centre), `activity.send-money` (the exchange house), `activity.cafeteria-uae`, `activity.naija-shop-uae`, `activity.barber-uae`, `activity.community-uae`, `offer.street-find-uae` (streets:street-shopping-abroad, streets:street-finds-abroad) |
| `place.naif` | Naif | `country.uae` | Dubai | 25272, 55310 | exterior, drawn on Deira's arcade models with its own boards (`place.naif.sign.3` to `.9`) | The souq streets of Deira | `activity.street-shopping-uae` (the souq's stall), `activity.laundry-uae`, `activity.buy-clothes-uae` (the tailor) |
| `place.metro-station-uae` | Union station | `country.uae` | Dubai | 25266, 55312 | exterior | The metro's stop and the zone pass (design page 11) | `activity.transit-pass-uae` (the Nol machine); the platform |
| `place.big-shop-uae` | The hypermarket | `country.uae` | Dubai | 25265, 55320 (made-up spot in Al Rigga) | interior, the scene `big-shop-uk` | The weekly shop | `activity.weekly-shop-uae` |
| `place.site-uae` | The site | `country.uae` | Dubai | 25186, 55263 (made-up spot among the towers across the creek) | exterior, `shuttle` | Where the contract's job is done, reached by the labour bus for nothing (place:employer-shuttle-rides-free) | `activity.job-gulf-guard`, `activity.job-gulf-cleaner`, `activity.overtime` |
| `place.castel-volturno` | Castel Volturno (its real name, city:place-words-are-text-keys; the roundabout is its thing) | `country.italy` | Castel Volturno | 41034, 13941 | exterior, **hub** | Nigeria is the largest foreign community there, 33.2% of foreign residents on 1 Jan 2024, and undocumented migrants go there believing work can be found without papers. It fits `status.eu-irregular` and cash work (road:sea-arrival-in-italy). Nothing from the crime reporting about the town is shown. Its spots (design page 11): the roundabout where the vans come at dawn, the bar, the African shop, the call shop | `activity.job-hunt` (the roundabout), `activity.coffee-italy`, `activity.naija-shop-italy`, `activity.send-money` (the call shop), `offer.street-find-italy` |
| `place.via-domitiana` | Via Domitiana (its real name, city:place-words-are-text-keys) | `country.italy` | Castel Volturno | 40929, 14025 | exterior | The coast road where day labourers wait for work. Its spots (design page 11): the bus stop, the pickup point, the Nigerian shop, the barber, the stall | `activity.overtime` (the pickup point: the second shift), `activity.street-shopping-italy`, `activity.barber-italy`, `activity.buy-clothes-italy` |
| `place.farm-italy` | The fields | `country.italy` | Castel Volturno | 41010, 13990 (made-up spot inland) | exterior, `shuttle` | Where the farm's cash job is done, reached by the gangmaster's van for nothing (place:employer-shuttle-rides-free) | `activity.job-italy-farm-cash` |
| `place.big-shop-italy` | The discount supermarket | `country.italy` | Castel Volturno | 41030, 13950 (made-up spot) | interior, the scene `big-shop-uk` | The weekly shop | `activity.weekly-shop-italy` |
| `place.church-italy` | The church | `country.italy` | Castel Volturno | 41028, 13945 (made-up spot) | interior, the scene `church-uk` | The community's place (world:nobody-picked-from-list) | `activity.community-italy` |
| `place.naples-airport` | Naples Airport | `country.italy` | Naples | 40884, 14285 | interior | The assisted return home | |
| `place.the-room` | the room (a shared room, `abroad-money.md`); named per country (`place.the-room.name.<country>`: the shared room in Peckham, the basement room in north-east Calgary, the bed space at the camp, the room in a shared flat on the Domitiana), its sticker at each country's home spot (design pages 10 and 11) | null | | | interior | The default place abroad | default abroad; `activity.rest`, `activity.call-home`, `activity.rent-flat`, `activity.phone-contract`, and the country's own meal (`activity.cook-own-uk`, `-ca`, `-uae`, `-it`); the hunt, the community and money home are staged at each country's own places |
| `place.the-room` in the UAE | the bed space at the camp | | | 25270, 55395 (made-up spot east of the city) | | The employer's camp; the labour bus at its gate is the ride to the site (place:employer-shuttle-rides-free) | |

The UK's 3D place is Peckham even though the three universities of `route.md` are invented and sit in the north-east, the Midlands and the north-west; a student's campus is a card, not a 3D place.

## Numbers

| Setting | Value | Source | In content as |
|---|---|---|---|
| People in a sample, low mode | 8 | Working value: 8 people at up to 3 draw calls each fit the 24 of an exterior's 80 that `assets.md` gives people in the low mode | `tuning.city.crowdLow` |
| People in a sample, high mode | 16 | Working value: at the asset experiments' measured average of under 2 draw calls a person, 16 fit the 32 that `assets.md` gives people in the high mode | `tuning.city.crowdHigh` |
| Friday jalamia share among men | 4000 bp | Working value from the design table | `tuning.city.fridayBp` |
| Saturday occasion dress share | 5000 bp | Working value from the design table | `tuning.city.saturdayBp` |
| Rise to high after | 10,000 ms | Working value | `tuning.city.raiseAfterMs` |
| Frame time that allows high | 20 ms (50 frames a second) | Working value | `tuning.city.raiseFrameMs` |
| Drop to low after | 5,000 ms | Working value | `tuning.city.dropAfterMs` |
| Frame time that forces low | 33 ms (30 frames a second) | Working value | `tuning.city.dropFrameMs` |
| Highest pixel ratio | 2 | Working value | `tuning.city.maxPixelRatio` |
| Desktop width | 1024 CSS px | Working value, the desktop layout's break point | `tuning.city.desktopMinWidth` |
| Position precision | 0.001 degree, about 110 m | Chosen for the game | the `position` field's unit |
| Features taken from OpenStreetMap | under 100, once | OSMF substantial guideline: under 100 features, one-off, is insubstantial | the place table itself |
| Traditional share by place | market and roadside 6000 bp, street 5000 bp, office, hub and campus 2000 bp, airport 2500 bp | `../design/06` section 4, as numbers: working values | each entry's `traditionalBp` |
| Draw calls motion may add to a place | 6 | The motion experiment of 8 Oct 2026 merged its motion into one draw call (122 still, 123 moving); in the places each motion entry is its own draw call and the place check of 8 Oct 2026 measured 3 to 6 (Computer Village, Deira, Tejuosho at 6; the hub at 5). Merging motion into fewer meshes is the way back down | `models/budgets.json` `motion.extraDrawCalls` |
| Script a frame motion may add, cheap phone profile | 500 microseconds | Working value; the experiment measured 210 with the processor slowed 6 times | `models/budgets.json` `motion.scriptUs` |
| Cost of the fine mesh level | about 63% more triangles and 20% more frame time in the experiment (10,520 against 17,080 triangles; 50.7 against 62.1 ms on a software renderer) | The motion experiment of 8 Oct 2026; comparative only | the reason for city:motion-never-turned-off |
| Frames a second behind the panels | 1 | Working value | `IDLE_MS` in `apps/client/src/features/city/scene/CityScene.tsx` |
| Walking pace | 1,400 mm a second | The 1.4 m/s design guides use for walking speed (Wikipedia, preferred walking speed) | `tuning.city.walkMmPerS` |
| Stop short of a person or object | 800 mm | Working value | `tuning.city.stopShortMm` |
| Target headcount | exterior 12, interior 8, the party room 10 | Working values; "about ten moving people in a room" is an estimate | each entry's `crowd.target`, private settings |
| Players kept in today's list | 20 a place | Working value, the size of the presence sample (`clock.md`) | `presence.todayMax` |
| Cheap phone profile | 360 by 640 CSS px, device scale 2, processor slowed 6 times | The asset phone shot (`assets.md`) and the experiment's slowdown | the place check's profile |
| Dance loops in the party room | 2, on 3 bodies | Working value | the party room |
| Board length | 50 lines and the player's own | Working value | `board.size` (server config) |

## Sources

All read on 8 Oct 2026.

- [OpenStreetMap Foundation: attribution guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- [OpenStreetMap Foundation: the substantial extraction guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline)
- [OpenStreetMap search service (Nominatim), used for every position above](https://nominatim.openstreetmap.org/)
- [Overture Maps: attribution and licences](https://docs.overturemaps.org/attribution/)
- [Wikipedia: Third Mainland Bridge, length and opening](https://en.wikipedia.org/wiki/Third_Mainland_Bridge)
- [ThisDay: "Can National Stadium Surulere reclaim its soul?", 5 Sep 2026](https://www.thisdaylive.com/2026/09/05/can-national-stadium-surulere-reclaim-its-soul/)
- [Southwark Council: communities statistics, 2021 census](https://www.southwark.gov.uk/about-council/southwark-communities-statistics)
- [Southwark Council: My Peckham, Peckham people](https://www.southwark.gov.uk/business/all-about-peckham/my-peckham-peckham-people)
- [The African Courier: London's Little Lagos](https://www.theafricancourier.de/londons-little-lagos-a-look-at-nigerian-life-in-the-british-capital)
- [CBC Calgary: African immigrants and Calgary, 2021 census figures](https://www.cbc.ca/news/canada/calgary/african-calgary-immigrants-community-alberta-1.6654125) (the page refused a direct fetch; the figures are from its search summary)
- [Wikipedia: Nigerians in the United Arab Emirates](https://en.wikipedia.org/wiki/Nigerians_in_the_United_Arab_Emirates)
- [Real Estate Club Dubai: moving to Dubai from Nigeria and West Africa, 2026](https://realestateclubdubai.com/blog/relocation/moving-to-dubai-from-nigeria-and-west-africa-property-visa-banking-and-complete-guide-2026)
- [Tuttitalia: foreign residents of Castel Volturno, 2024](https://www.tuttitalia.it/campania/52-castel-volturno/statistiche/cittadini-stranieri-2024/)
- [Tuttitalia: Nigerian residents of Italy by region](https://www.tuttitalia.it/statistiche/cittadini-stranieri/nigeria/)
- [Italian Ministry of Labour: the Nigerian community in Italy, 2025](https://lavoro.gov.it/documenti-e-norme/studi-e-statistiche/nigerian-community-italy-2025)
- [Al Jazeera: Italy's migrants, an emergency within an emergency, 11 Apr 2020](https://www.aljazeera.com/economy/2020/4/11/italys-migrants-living-through-an-emergency-within-an-emergency)
- [Corporate Affairs Commission: public search of registered names](https://search.cac.gov.ng/)
- [Wikipedia: preferred walking speed, 1.4 m/s in design guides](https://en.wikipedia.org/wiki/Preferred_walking_speed)

## Not verified

- Where in Calgary and in Dubai people from Lagos live, below the city. Both areas are working choices.
- The position of Balogun Market, which is not a feature in OpenStreetMap under that name.
- That the visa centre, the English test centre and the clinics sit in the areas given. Institutions carry an area only, so nothing real is pinned, but the areas are plausible, not checked.
- Frame cost on a real cheap phone. The motion experiment used a software renderer and a slowed desktop processor, so its frame times only compare its columns with each other.
- The ten-person figure for a room, and whether a free animation library fits a skeleton of 17 bones without fingers.

## Contract

What this page defines in `packages/sim/src/engine/types.ts` and the place schema. The simulation's commands, effects, events, requirements and view carry nothing of the city (city:places-change-no-state).

1. `PlaceEntry`, the shape of a `place.*` entry, in `packages/sim/src/engine/types.ts` with its schema in `packages/sim/src/place/place.schema.ts`, with entries in `packages/content/src/place/place.data.ts`:
   ```ts
   interface PlaceEntry {
     id: Id<"place">;
     where: Where;                                   // "home" | "abroad" | "road"
     country: Id<"country"> | null;                  // null at home and on the road
     city: string | null;                            // slug: "lagos", "london", "calgary", "dubai", "castel-volturno", "naples"
     area: string | null;                            // slug, null for stylised places
     nameKind: "public" | "institution" | "business" | "stylised";
     realName: string | null;                        // city:four-kinds-of-name
     position: { latE3: number; lonE3: number } | null;
     data: { source: "osm" | "overture" | "own"; licence: "ODbL-1.0" | "CDLA-Permissive-2.0" | null; checked: string } | null;
     sponsor: { key: string } | null;                // city:sponsor-shows-name-only
     scope: "exterior" | "interior";
     hub: boolean;
     occasion: boolean;                              // city:dress-mix-by-place
     stages: Array<Id<"activity"> | Id<"offer"> | Id<"setpiece"> | Id<"chapter">>;
     crowd: { low: number; high: number; target: number }; // city:residents-fill-to-target
     traditionalBp: number;
     assets: string;                                 // folder under public/assets/places/
     shuttle: boolean;                               // place:employer-shuttle-rides-free
   }
   ```
2. `content.place: Record<Id<"place">, PlaceEntry>` in the content object.
3. Tuning: `tuning.city: { crowdLow: number; crowdHigh: number; fridayBp: number; saturdayBp: number; raiseAfterMs: number; raiseFrameMs: number; dropAfterMs: number; dropFrameMs: number; maxPixelRatio: number; desktopMinWidth: number; walkMmPerS: number; stopShortMm: number }`, with `roam: boolean` (city:tap-to-walk, city:players-shown-present-not-tracked). The simulation never reads it; it lives in content so an overlay can change it (engine:numbers-read-from-content).
4. Content checks: city:four-kinds-of-name field rules by `nameKind`; city:places-stage-their-acts each staged id exists and is staged once per `where` and country; city:ojuelegba-is-the-hub exactly one `hub: true` at home and one per country; city:sponsor-shows-name-only no sponsor on an institution, a stylised place or a place staging an offer with a fraud chance; city:road-places-are-stylised every `road`-group offer and road set piece staged only at a stylised place; city:place-words-are-text-keys a public place's name text equals its `realName`.
5. Text keys in `place.text.ts`: `<id>.name`, `<id>.blurb`, `<id>.sign.<n>`, `<id>.overheard.<n>`.
6. Outside the simulation, the authority's presence sample (`GET /api/place/:place`) answers `PresenceReply` (`packages/api/src/game.ts`): `{ place: string; others: Array<{ name: string; look: string }>; today: Array<{ name: string; look: string }> }`, `others` the players there now and `today` some seen there today (city:players-shown-present-not-tracked). The name is the account's username and the look the one kept with the character (account:person-kept-with-character), read by `profileOfIn` in `apps/server/src/production.ts`; the character's own name never reaches another player.
7. The content check fails a `crowd.target` over the entry's `high` (city:residents-fill-to-target).
8. The walk's numbers (city:tap-to-walk) are in `tuning.city` (item 3). The idle rate of city:hidden-scene-idles is the scene's own constant (`IDLE_MS` in `CityScene.tsx`), and city:players-carry-name-tags has no number.
9. The contract's `Emote = "wave" | "clap" | "sit" | "dance"` (`packages/sim/src/engine/types.ts`) is used by no screen; the players' emotes are `../design/09-the-lively-layer.md` section 5.
10. Text keys: `city.resident.<n>.name` and `city.resident.<n>.role` for the residents' cards (city:residents-carry-no-tag), drawn from the generated list of person:computer-names-generated; `city.resident.lives` ("Lives in the city").
11. The players seen today come as the sample's own `today` list (item 6, city:players-shown-present-not-tracked); presence config carries `presence.todayMax`. No position field is ever added.
12. Client, outside the simulation: one motion module that owns the place's clock and wind and the shared materials of city:motion-in-vertex-shader (assets:one-shared-motion-material), with uniforms `{ time: number; windDir: [number, number]; gust: number }`; the mesh level `"coarse" | "fine"` chosen with the graphics mode.
13. Build check: `models/budgets.json` holds `motion: { extraDrawCalls: number; scriptUs: number }`; the place check renders each place still and moving on the cheap phone profile (city:no-script-loop-per-sheet, city:places-meet-party-room-bar).
14. `GET /api/boards/:when/:who` (`this-week|all-time`, `everyone|friends`) and `GET /api/boards/joined-week` (switched off), answering `BoardReply { ok, board, size, rows: BoardRow[], own: BoardRow | null }` with `BoardRow = { rank, username, figure, me }`, `username` on every board (city:board-line-and-ranking); the account store has `usernames(ids)`, one read for a board's lines.
