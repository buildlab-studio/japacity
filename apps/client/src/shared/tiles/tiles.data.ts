// The picture on every choice (docs/design/09-the-games-look.md, the pictures): each id the interface shows a picture for, mapped to
// the model whose tile it shows (tools/assets/shoot.ts, the tile view, published under public/assets/tiles) or to an
// emoji standing in where no model exists. Each is decided by what the thing is: a meal shows the cooking corner, since
// no dish is modelled, and an act at a thing in the world shows that thing when the thing is what the act is about. The
// stand-ins are listed by `pnpm exec tsx apps/client/src/shared/tiles/missing.ts`.

/**
 * The acts that are no activity of the simulation (world:fan-of-sticker-buttons): a pose, the bed's Sleep, a bill, the papers, the bag, the
 * way out and in, a word with someone, a look, a ride, the way home, a stop and a shut thing. Each is a small glyph drawn as
 * the layer's sticker (Glyph.tsx), keyed `act.<glyph>`; it is drawn, so it stands in for nothing.
 */
export const ACT_GLYPHS = ["sit", "lie", "sleep", "pay", "papers", "pack", "out", "in", "talk", "look", "ride", "home", "stop", "shut"] as const;
export type ActGlyph = (typeof ACT_GLYPHS)[number];

/** A model's tile, by the model's name, an emoji standing in where no model exists, or an act's drawn glyph. */
export type TileRow = string | { emoji: string; standIn: true } | { glyph: ActGlyph };

/** What a tile draws: a model's published picture, a stand-in or an act's glyph. */
export type TilePicture = { model: string } | { emoji: string; standIn: true } | { glyph: ActGlyph };

const stand = (emoji: string): TileRow => ({ emoji, standIn: true });

/** The home's place files, each with the prefix of its things that are the home's (Makoko's file holds the street's things too). */
export const HOME_FILES: Readonly<Record<string, string>> = {
  "home-family-house": "",
  "home-room-house": "",
  "home-hostel-house": "",
  "the-room": "",
  makoko: "room",
};

export const TILE_TABLE: Readonly<Record<string, TileRow>> = {
  // The room and the family.
  "activity.cook-at-home": "prop_cooking-corner",
  "activity.cook-jollof": "prop_cooking-corner",
  "activity.cook-own": "prop_cooking-corner",
  "activity.cook-own-pot": "prop_cooking-corner",
  "activity.cook-own-uk": "prop_cooking-corner",
  "activity.nap": "prop_bed",
  "activity.bucket-bath": "prop_basins",
  "activity.fetch-water": "prop_water-drum",
  "activity.fill-drum": "prop_water-drum",
  "activity.watch-tv": "prop_tv-stand",
  "activity.family-time": "prop_sofa",
  "activity.family-meeting": "prop_parlour-set",
  "activity.ask-family-loan": "prop_sofa",
  "activity.help-shop": "prop_market-stall",
  "activity.night-support": stand("🎧"),
  // The passbook's roads: the side jobs at home, the street's circle, the family's ask and the scholarship.
  "activity.ride-driving": stand("🚗"),
  "activity.weekend-tutoring": stand("📚"),
  // Study and work at a desk.
  "activity.study-english": "prop_test-desk",
  "activity.sit-english-test": "prop_test-desk",
  "activity.nmc-tests": "prop_test-desk",
  "activity.learn-tech": "prop_long-desk",
  "activity.build-portfolio": "prop_long-desk",
  "activity.tech-posts": "prop_long-desk",
  "activity.interview-prep": "prop_long-desk",
  "activity.open-source": "prop_long-desk",
  "activity.masters-at-home": stand("🎓"),
  "activity.nurse-certification": stand("📜"),
  "activity.be-noticed": stand("✨"),
  "activity.conference-talk": "prop_meetup-corner",
  "activity.meetup": "prop_meetup-corner",
  "activity.community-uk": "prop_meetup-corner",
  "activity.community-canada": "prop_meetup-corner",
  "activity.community-uae": "prop_meetup-corner",
  "activity.side-gig": "prop_repair-table",
  "activity.apprentice-repair": "prop_repair-table",
  "activity.open-shop": "prop_market-stall",
  // The street's enjoyment and spending.
  "activity.buy-suya": "prop_suya-grill",
  "activity.mallam-tea": "prop_street-bench",
  "activity.pure-water": stand("💧"),
  "activity.barber": "shopfront_barber-kiosk",
  "activity.viewing-centre": "shopfront_viewing-centre",
  "activity.beer-joint": "prop_joint-set",
  "activity.night-out": stand("🪩"),
  "activity.buy-clothes": "prop_bales",
  "activity.buy-phone": "shopfront_container-phones",
  "activity.play-lotto": "shopfront_lotto-kiosk",
  "activity.bet-slip": "building_bode-thomas-betting",
  "activity.morning-run": stand("👟"),
  "activity.sleep-rough": "prop_cooking-fire",
  "activity.safe-ride": "vehicle_taxi",
  // Asking and seeing people.
  "activity.ask-around": "vehicle_danfo",
  "activity.see-agent-stop": "prop_bus-shelter",
  "activity.see-agent-office": "prop_office-desk",
  "activity.ask-someone-who-went": stand("💬"),
  "activity.see-adviser": stand("💼"),
  "activity.look-into-route": stand("🧭"),
  "activity.see-someone": stand("🤝"),
  "activity.call-someone": stand("📞"),
  "activity.call-home": stand("📞"),
  "activity.send-money": stand("💸"),
  // The papers: made at a counter or a clinic where the world has one, else a paper standing in.
  "activity.get-passport": stand("🛂"),
  "activity.get-transcript": stand("📜"),
  "activity.degree-english": stand("📜"),
  "activity.tb-test": "prop_xray-stand",
  "activity.gulf-medical": "prop_xray-stand",
  "activity.get-police-certificate": stand("🪪"),
  "activity.get-eca": stand("📑"),
  "activity.gift-deed": stand("📜"),
  "activity.request-verification": stand("📑"),
  "activity.renew-licence": stand("🪪"),
  "activity.apply-for-visa": "prop_office-desk",
  "activity.apply-to-school": stand("🎓"),
  "activity.apply-uk-care": stand("📨"),
  "activity.apply-uk-talent": stand("📨"),
  "activity.apply-uk-skilled": stand("📨"),
  "activity.apply-graduate": stand("📨"),
  "activity.apply-uk-partner": stand("📨"),
  "activity.apply-uk-dependant": stand("📨"),
  "activity.apply-canada-spouse": stand("📨"),
  "activity.apply-canada-accompany": stand("📨"),
  "activity.apply-gulf-contract": stand("📨"),
  "activity.apply-endorsement": stand("📨"),
  "activity.enter-pool": stand("📨"),
  "activity.find-sponsor": stand("🤝"),
  // Settling abroad.
  "activity.street-shopping-uk": "prop_gazebo-stall",
  "activity.street-shopping-uae": "prop_market-stall",
  "activity.buy-car-finance": stand("🚗"),
  "activity.rent-flat-uk": "building_rye-lane-terrace_a",
  "activity.rent-flat-canada": stand("🏠"),
  "activity.phone-contract-uk": stand("📱"),
  "activity.phone-contract-canada": stand("📱"),
  "activity.december-home-uk": "prop_flight-board",
  "activity.december-home-canada": "prop_flight-board",
  "activity.december-home-uae": "prop_flight-board",
  // London by hand (streets:london-life-by-hand, place:country-pass-covers-ways): each act shows the thing it is done at.
  "activity.bus-pass-uk": "prop_ticket-machine",
  "activity.weekly-shop-uk": "prop_trolley-bay",
  "activity.chicken-shop": "building_rye-lane-terrace_c",
  "activity.naija-shop-uk": "prop_produce-stand",
  "activity.pub-pint": "building_corner-pub",
  "activity.barber-uk": "building_rye-lane-terrace_c",
  "activity.buy-clothes-uk": "building_rye-lane-terrace_d",
  "activity.overtime": "prop_rota-board",
  // Calgary, Dubai and Castel Volturno by hand (streets:calgary-life-by-hand, streets:dubai-life-by-hand and streets:castel-volturno-by-hand, place:country-pass-covers-ways):
  // each act shows the thing it is done at; Naif's tailor and laundry stand on Deira's arcades.
  "activity.transit-pass-canada": "prop_ticket-machine",
  "activity.transit-pass-uae": "prop_nol-machine",
  "activity.weekly-shop-canada": "prop_trolley-bay",
  "activity.weekly-shop-uae": "prop_trolley-bay",
  "activity.weekly-shop-italy": "prop_trolley-bay",
  "activity.buy-clothes-canada": "prop_shop-aisle",
  "activity.cook-own-canada": "prop_cooking-corner",
  "activity.cook-own-uae": "prop_cooking-corner",
  "activity.cook-own-italy": "prop_cooking-corner",
  "activity.coffee-canada": "building_strip-mall",
  "activity.naija-shop-canada": "building_strip-mall",
  "activity.barber-canada": "building_strip-mall",
  "activity.learn-tech-canada": "prop_course-desk",
  "activity.cafeteria-uae": "prop_dining-table",
  "activity.naija-shop-uae": "building_deira-arcade_a",
  "activity.barber-uae": "building_deira-arcade_b",
  "activity.buy-clothes-uae": "building_deira-arcade_a",
  "activity.laundry-uae": "building_deira-arcade_b",
  "activity.coffee-italy": "prop_bar-counter",
  "activity.naija-shop-italy": "building_castel-row_a",
  "activity.barber-italy": "building_domitiana-block",
  "activity.buy-clothes-italy": "prop_gazebo-stall",
  "activity.street-shopping-italy": "building_domitiana-block",
  "activity.community-italy": "prop_pew",
  // The jobs.
  "activity.job-hunt": "prop_jobs-board",
  "activity.job-teacher": "building_makoko-school",
  "activity.job-customer-service": stand("🎧"),
  "activity.job-junior-developer": "prop_long-desk",
  "activity.job-mid-developer": "prop_long-desk",
  "activity.job-remote-developer": "prop_long-desk",
  "activity.job-uk-senior-developer": "prop_glass-office",
  "activity.job-canada-developer": "prop_glass-office",
  "activity.job-bank-officer": "prop_bank-counter",
  "activity.job-bank-senior": "prop_bank-counter",
  "activity.job-nurse": stand("🩺"),
  "activity.job-uk-nurse": "prop_nurses-station",
  "activity.job-uk-care": "prop_reception-desk",
  "activity.job-uk-senior-care": stand("🤲"),
  "activity.job-canada-care-aide": "prop_reception-desk",
  "activity.job-uk-skilled": "prop_desk-pod",
  "activity.job-canada-professional": "prop_desk-pod",
  "activity.job-uk-graduate": "prop_desk-pod",
  "activity.job-uk-warehouse": "prop_clock-in",
  "activity.job-canada-warehouse": "prop_clock-in",
  "activity.job-uk-retail-part": "prop_tills",
  "activity.job-uk-kitchen-cash": "prop_side-door",
  "activity.job-uk-courier-cash": "prop_courier-bike",
  "activity.job-gulf-guard": "prop_guard-post",
  "activity.job-gulf-cleaner": "prop_cleaner-trolley",
  "activity.job-italy-farm-cash": "prop_tarp-table",
  "activity.job-phone-sales": "shopfront_container-phones",
  "activity.job-fish-racks": "prop_fish-racks",
  // The offers a thing in the world carries.
  "offer.agent-office": "prop_office-desk",
  "offer.held-funds-agent": "prop_office-desk",
  "offer.gulf-agent": "prop_office-desk",
  "offer.agent-stop": "prop_bus-shelter",
  "offer.agent-promise": "prop_bus-shelter",
  "offer.agent-papers": "prop_bus-shelter",
  "offer.held-funds": "prop_bank-counter",
  "offer.salary-loan": "prop_bank-counter",
  "offer.parcel-shipped": "shopfront_provisions",
  "offer.laptop-fault": "prop_repair-table",
  "offer.join-ajo": stand("🤝"),
  "offer.family-loan": "prop_sofa",
  "offer.scholarship-round": stand("🎓"),
  "offer.send-off-party": "prop_party-set",
  "offer.family-send-off": "prop_party-set",
  "offer.family-pledge": "prop_parlour-set",
  "offer.family-pledge-small": "prop_parlour-set",
  "offer.roof": "building_family-house",
  "offer.mum-shop": "prop_market-stall",
  "offer.fuel-scarcity": "vehicle_danfo",
  "offer.bridge-night": "prop_cooking-fire",
  "offer.nepa-bill": stand("💡"),
  "offer.brother-fees": stand("📚"),
  "offer.street-find-uk": stand("👛"),
  "offer.street-find-uae": stand("👛"),
  "offer.street-find-canada": "prop_street-bench",
  "offer.street-find-italy": "prop_street-bench",
  "offer.bridge-theft": stand("🎒"),
  "offer.bridge-mosquitoes": stand("🦟"),
  // The places with a built model: the building that names it, or the thing inside an interior. The bridge's span reads
// as a thin line in a square, so the bridge shows the drum fire its sleepers keep under it.
  "place.ojuelegba": "building_flyover-span",
  "place.bode-thomas": "building_bode-thomas-betting",
  "place.computer-village": "building_phone-plaza",
  "place.tejuosho-market": "building_market-block",
  "place.national-stadium": "landmark_national-stadium",
  "place.third-mainland-bridge": "prop_cooking-fire",
  "place.makoko": "building_makoko-house_b",
  "place.airport-lagos": "building_terminal-front",
  "place.family-house": "building_family-house",
  "place.compound-room": "prop_bed",
  "place.hostel-room": "prop_bunk-bed",
  "place.their-room": "prop_plastic-chair",
  "place.the-room": "prop_window-frame",
  "place.peckham": "building_rye-lane-terrace_a",
  "place.rye-lane": "building_corner-pub",
  "place.peckham-rye-station": "prop_ticket-machine",
  "place.big-shop-uk": "prop_trolley-bay",
  "place.care-home-uk": "prop_reception-desk",
  "place.ward-uk": "prop_nurses-station",
  "place.office-uk": "prop_desk-pod",
  "place.warehouse-uk": "prop_racking",
  "place.church-uk": "prop_pew",
  "place.test-centre-uk": "prop_test-desk",
  "place.deira": "building_deira-arcade_a",
  // Calgary's, Dubai's and Castel Volturno's places (docs/design/11-calgary-dubai-and-castel-volturno.md section 3), each by a model it stands.
  "place.calgary-north-east": "building_strip-mall",
  "place.ctrain-station-canada": "prop_platform-shelter",
  "place.big-shop-canada": "prop_trolley-bay",
  "place.warehouse-canada": "prop_racking",
  "place.care-home-canada": "prop_reception-desk",
  "place.office-canada": "prop_desk-pod",
  "place.library-canada": "prop_bookshelf",
  "place.church-canada": "prop_pew",
  "place.metro-station-uae": "building_metro-station",
  "place.naif": "prop_market-stall",
  "place.big-shop-uae": "prop_trolley-bay",
  "place.site-uae": "prop_guard-post",
  "place.castel-volturno": "prop_roundabout",
  "place.via-domitiana": "building_domitiana-block",
  "place.farm-italy": "prop_tarp-table",
  "place.big-shop-italy": "prop_trolley-bay",
  "place.church-italy": "prop_pew",
  "place.yaba": "prop_long-desk",
  "place.yaba-hub": "prop_papers-box",
  "place.agent-office": "prop_office-desk",
  "place.olokun-office": "prop_bank-counter",
  // The passport office's counter; the painted map and the ride sheet stand the flag mast beside it (features/map/paper).
  "place.passport-office": "prop_bank-counter",
  "place.visa-centre": "prop_waiting-chairs",
  "place.english-test-centre": "prop_test-desk",
  "place.tb-clinic": "prop_xray-stand",
  // The papers in the phone's Papers app: the counter or clinic that issues one where the world has it, else a paper
  // standing in.
  "document.passport": stand("📘"),
  "document.transcript": stand("📄"),
  "document.degree-english": stand("📄"),
  "document.english-test": "prop_test-desk",
  "document.tb-certificate": "prop_xray-stand",
  "document.police-certificate": stand("🪪"),
  "document.cas": stand("🎓"),
  "document.home-licence": stand("🪪"),
  "document.uk-licence": stand("🪪"),
  "document.nmc-pin": stand("📌"),
  "document.nursing-licence": stand("🩺"),
  "document.nmcn-verification": stand("📑"),
  "document.eca": stand("📑"),
  "document.gift-deed": stand("📜"),
  "document.endorsement": stand("📨"),
  "document.medical": "prop_xray-stand",
  "document.nurse-certificate": stand("📜"),
  // The ways out in Japa: the street the way leads to where the world has one built.
  "route.uk-masters": "building_rye-lane-terrace_a",
  "route.uk-care": "building_rye-lane-terrace_a",
  "route.uk-skilled": "building_rye-lane-terrace_a",
  "route.uk-talent": "building_rye-lane-terrace_a",
  "route.uk-partner": "building_rye-lane-terrace_a",
  "route.uk-dependant": "building_rye-lane-terrace_a",
  "route.canada-points": stand("🍁"),
  "route.canada-spouse": stand("🍁"),
  "route.canada-accompany": stand("🍁"),
  "route.gulf-contract": "building_deira-arcade_a",
  "route.road": stand("🧭"),
  // The phone's own pictures: the paper for the news, the box under the bed for Papers, the receipt for a bill.
  "phone.news": stand("🗞️"),
  "phone.bill": stand("🧾"),
  "phone.birthday": stand("🎂"),
  "phone.account": stand("👤"),
  // The home's things, by their ids in the place files: the model each is built from.
  "thing.bed": "prop_bed",
  "thing.mattress": "prop_mattress",
  "thing.bunk": "prop_bunk-bed",
  "thing.out": "prop_slippers",
  "thing.family": "prop_centre-table",
  "thing.cooking": "prop_cooking-corner",
  "thing.drum": "prop_water-drum",
  "thing.papers-box": "prop_papers-box",
  "thing.bag": "prop_travel-bag",
  "thing.door": "prop_room-door",
  "thing.sofa": "prop_sofa",
  "thing.tv": "prop_tv-stand",
  "thing.table": "prop_dining-table",
  "thing.mama": "prop_armchair",
  "thing.papa": "prop_armchair",
  "thing.after-service": "prop_sofa",
  "thing.friend-guest": "prop_dining-table",
  "thing.window": "prop_window-frame",
  "thing.phone": "prop_side-table",
  "thing.laptop": "prop_dining-table",
  "thing.post": "prop_post",
  "thing.room": "building_makoko-house_a",
  "thing.room-chores": "prop_cooking-corner",
  "thing.room-papers": "prop_papers-box",
  // The market's things, keyed `market.<slug>` for the thing `thing.<slug>` of content so they never
  // meet the home's place things above: each the very model that lands in the room.
  "market.fan": "prop_fan",
  "market.radio": "prop_radio",
  "market.big-pot": "prop_big-pot",
  "market.data": "prop_router",
  "market.tv": "prop_tv",
  "market.decoder": "prop_decoder",
  "market.gas-cooker": "prop_gas-cooker",
  "market.fridge": "prop_fridge",
  "market.mattress": "prop_foam-mattress",
  "market.wardrobe": "prop_wardrobe",
  "market.mirror": "prop_mirror",
  "market.speaker": "prop_speaker",
  "market.generator": "prop_generator",
  "market.inverter": "prop_inverter",
  "market.solar": "prop_solar",
  "market.ac": "prop_ac",
  "market.laptop": "prop_laptop-desk",
  "market.phone": "prop_phone",
  "market.car": "vehicle_car",
  // The acts with no activity of their own (the fan for every thing): each its drawn glyph.
  ...(Object.fromEntries(ACT_GLYPHS.map((glyph) => [`act.${glyph}`, { glyph }])) as Record<`act.${ActGlyph}`, TileRow>),
};

/** The picture key of a thing of the market: `thing.fan` shows `market.fan`. */
export function marketTile(thing: string): string {
  return `market.${thing.slice(thing.indexOf(".") + 1)}`;
}

/** The phone's own pictures, which name no entry of content: the news, a bill, a birthday, the account. */
export const PHONE_PICTURES: readonly string[] = ["phone.news", "phone.bill", "phone.birthday", "phone.account"];

/** What a stray id shows: a stand-in, never an empty space. */
const UNKNOWN: TilePicture = { emoji: "✨", standIn: true };

/** The picture for an id. */
export function tileOf(id: string): TilePicture {
  const row = TILE_TABLE[id];
  if (row === undefined) return UNKNOWN;
  return typeof row === "string" ? { model: row } : row;
}

/** The key of an act's glyph. */
export function glyphTile(glyph: ActGlyph): string {
  return `act.${glyph}`;
}

/** Every id still on a stand-in, sorted, with its emoji: the models to commission. */
export function standIns(): { id: string; emoji: string }[] {
  return Object.entries(TILE_TABLE)
    .flatMap(([id, row]) => (typeof row === "string" || !("standIn" in row) ? [] : [{ id, emoji: row.emoji }]))
    .sort((a, b) => a.id.localeCompare(b.id));
}
