// The picture on every choice (design page 13, the pictures): each id the interface shows a picture for, mapped to
// the model whose tile it shows (tools/assets/shoot.ts, the tile view, published under public/assets/tiles) or to an
// emoji standing in until a model exists. Each is decided by what the thing is: a meal shows the cooking corner until
// a dish is modelled, an act at a thing in the world shows that thing when the thing is what the act is about. The
// stand-ins are the list of models to commission (`pnpm exec tsx apps/client/src/shared/tiles/missing.ts`).

/** A model's tile, by the model's name, or an emoji standing in for a model not yet made. */
export type TileRow = string | { emoji: string; standIn: true };

/** What a tile draws: a model's published picture or a stand-in. */
export type TilePicture = { model: string } | { emoji: string; standIn: true };

const stand = (emoji: string): TileRow => ({ emoji, standIn: true });

/** The home's place files, each with the prefix of its things that are the home's (Makoko's file holds the street's things too). */
export const HOME_FILES: Readonly<Record<string, string>> = {
  "family-house-parlour": "",
  "compound-room": "",
  "the-room": "",
  makoko: "room",
};

export const TILE_TABLE: Readonly<Record<string, TileRow>> = {
  // The room and the family.
  "activity.cook-at-home": "prop_cooking-corner",
  "activity.cook-jollof": "prop_cooking-corner",
  "activity.nap": "prop_bed",
  "activity.bucket-bath": "prop_basins",
  "activity.fetch-water": "prop_water-drum",
  "activity.fill-drum": "prop_water-drum",
  "activity.watch-tv": "prop_tv-stand",
  "activity.family-time": "prop_sofa",
  "activity.family-meeting": "prop_parlour-set",
  "activity.help-shop": "prop_market-stall",
  "activity.night-support": stand("🎧"),
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
  "activity.community-ca": "prop_meetup-corner",
  "activity.community-uae": "prop_meetup-corner",
  "activity.side-gig": "prop_repair-table",
  "activity.apprentice-repair": "prop_repair-table",
  "activity.open-shop": "prop_market-stall",
  // The street's enjoyment and spending.
  "activity.buy-suya": "prop_suya-grill",
  "activity.mallam-tea": "prop_street-bench",
  "activity.pure-water": stand("💧"),
  "activity.barber": "shop_barber-kiosk",
  "activity.viewing-centre": "shop_viewing-centre",
  "activity.beer-joint": "prop_joint-set",
  "activity.night-out": stand("🪩"),
  "activity.buy-clothes": "prop_bales",
  "activity.buy-phone": "shop_container-phones",
  "activity.play-lotto": "shop_lotto-kiosk",
  "activity.bet-slip": "bld_bode-thomas-betting",
  "activity.morning-run": stand("👟"),
  "activity.sleep-rough": "prop_cooking-fire",
  "activity.safe-ride": "veh_taxi",
  // Asking and seeing people.
  "activity.ask-around": "veh_danfo",
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
  "activity.tb-test": "prop_xray-stand",
  "activity.gulf-medical": "prop_xray-stand",
  "activity.get-police-certificate": stand("🪪"),
  "activity.get-eca": stand("📑"),
  "activity.request-verification": stand("📑"),
  "activity.renew-licence": stand("🪪"),
  "activity.apply-for-visa": "prop_office-desk",
  "activity.apply-to-school": stand("🎓"),
  "activity.apply-uk-care": stand("📨"),
  "activity.apply-uk-talent": stand("📨"),
  "activity.apply-uk-skilled": stand("📨"),
  "activity.apply-uk-partner": stand("📨"),
  "activity.apply-uk-dependant": stand("📨"),
  "activity.apply-ca-spouse": stand("📨"),
  "activity.apply-ca-accompany": stand("📨"),
  "activity.apply-gulf-contract": stand("📨"),
  "activity.apply-endorsement": stand("📨"),
  "activity.enter-pool": stand("📨"),
  "activity.find-sponsor": stand("🤝"),
  // Settling abroad.
  "activity.street-shopping-uk": "prop_basins",
  "activity.street-shopping-uae": "prop_market-stall",
  "activity.buy-car-finance": stand("🚗"),
  "activity.rent-flat-uk": "bld_rye-lane-terrace_a",
  "activity.rent-flat-ca": stand("🏠"),
  "activity.phone-contract-uk": stand("📱"),
  "activity.phone-contract-ca": stand("📱"),
  "activity.december-home-uk": "prop_flight-board",
  "activity.december-home-ca": "prop_flight-board",
  "activity.december-home-uae": "prop_flight-board",
  // The jobs.
  "activity.job-hunt": "prop_jobs-board",
  "activity.job-teacher": "bld_makoko-school",
  "activity.job-customer-service": stand("🎧"),
  "activity.job-junior-dev": "prop_long-desk",
  "activity.job-mid-dev": "prop_long-desk",
  "activity.job-remote-dev": "prop_long-desk",
  "activity.job-uk-senior-dev": "prop_long-desk",
  "activity.job-ca-dev": "prop_long-desk",
  "activity.job-bank-officer": "prop_bank-counter",
  "activity.job-bank-senior": "prop_bank-counter",
  "activity.job-nurse": stand("🩺"),
  "activity.job-uk-nurse": stand("🩺"),
  "activity.job-uk-care": stand("🤲"),
  "activity.job-uk-senior-care": stand("🤲"),
  "activity.job-ca-care-aide": stand("🤲"),
  "activity.job-uk-skilled": stand("💼"),
  "activity.job-ca-professional": stand("💼"),
  "activity.job-uk-graduate": stand("🎓"),
  "activity.job-uk-warehouse": stand("📦"),
  "activity.job-ca-warehouse": stand("📦"),
  "activity.job-uk-retail-part": stand("🛒"),
  "activity.job-uk-kitchen-cash": stand("🍳"),
  "activity.job-uk-courier-cash": stand("🚲"),
  "activity.job-gulf-guard": stand("🛡️"),
  "activity.job-gulf-cleaner": "veh_labour-bus",
  "activity.job-it-farm-cash": stand("💻"),
  "activity.job-phone-sales": "shop_container-phones",
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
  "offer.parcel-shipped": "shop_provisions",
  "offer.laptop-fault": "prop_repair-table",
  "offer.send-off-party": "prop_party-set",
  "offer.family-send-off": "prop_party-set",
  "offer.family-pledge": "prop_parlour-set",
  "offer.family-pledge-small": "prop_parlour-set",
  "offer.roof": "bld_family-house",
  "offer.mum-shop": "prop_market-stall",
  "offer.fuel-scarcity": "veh_danfo",
  "offer.bridge-night": "prop_cooking-fire",
  "offer.nepa-bill": stand("💡"),
  "offer.brother-fees": stand("📚"),
  "offer.street-find-uk": stand("👛"),
  "offer.street-find-uae": stand("👛"),
  "offer.bridge-theft": stand("🎒"),
  "offer.bridge-mosquitoes": stand("🦟"),
  // The places with a built model: the building that names it, or the thing inside an interior. The bridge's span reads
// as a thin line in a square, so the bridge shows the drum fire its sleepers keep under it.
  "place.ojuelegba": "bld_flyover-span",
  "place.bode-thomas": "bld_bode-thomas-betting",
  "place.computer-village": "bld_phone-plaza",
  "place.tejuosho-market": "bld_market-block",
  "place.national-stadium": "lm_national-stadium",
  "place.third-mainland-bridge": "prop_cooking-fire",
  "place.makoko": "bld_makoko-house_b",
  "place.airport-lagos": "bld_terminal-front",
  "place.family-house": "bld_family-house",
  "place.compound-room": "prop_bed",
  "place.their-room": "prop_plastic-chair",
  "place.the-room": "prop_window-frame",
  "place.peckham": "bld_rye-lane-terrace_a",
  "place.deira": "bld_deira-arcade_a",
  "place.yaba": "prop_long-desk",
  "place.yaba-hub": "prop_papers-box",
  "place.agent-office": "prop_office-desk",
  "place.olokun-office": "prop_bank-counter",
  // The passport office's counter; the painted map and the ride sheet stand the flag mast beside it (features/map/paper).
  "place.passport-office": "prop_bank-counter",
  "place.visa-centre": "prop_waiting-chairs",
  "place.english-test-centre": "prop_test-desk",
  "place.tb-clinic": "prop_xray-stand",
  // The home's things, by their ids in the place files: the model each is built from.
  "thing.bed": "prop_bed",
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
  "thing.room": "bld_makoko-house_a",
  "thing.room-chores": "prop_cooking-corner",
  "thing.room-papers": "prop_papers-box",
};

/** What a stray id shows: a stand-in, never an empty space. */
const UNKNOWN: TilePicture = { emoji: "✨", standIn: true };

/** The picture for an id. */
export function tileOf(id: string): TilePicture {
  const row = TILE_TABLE[id];
  if (row === undefined) return UNKNOWN;
  return typeof row === "string" ? { model: row } : row;
}

/** Every id still on a stand-in, sorted, with its emoji: the models to commission. */
export function standIns(): { id: string; emoji: string }[] {
  return Object.entries(TILE_TABLE)
    .flatMap(([id, row]) => (typeof row === "string" ? [] : [{ id, emoji: row.emoji }]))
    .sort((a, b) => a.id.localeCompare(b.id));
}
