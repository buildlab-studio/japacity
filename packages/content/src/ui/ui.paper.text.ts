// Each painted city's own words (decision 0026; docs/rules/world.md R-WORLD-038, R-WORLD-039): its districts, its
// cards, its water and any inset, in the voice of docs/rules/text.md. Read only by the painted maps abroad, so they ride
// their chunk and never a first visit (engine.md R-ENGINE-020).

/** London's own words: its districts, its cards, its river and Heathrow's inset. */
export const uiLondonMapText: Record<string, string> = {
  "map.area.peckham": "Peckham",
  "map.area.camberwell": "Camberwell",
  "map.area.nunhead": "Nunhead",
  "map.area.old-kent-road": "Old Kent Road",
  "map.area.elephant": "Elephant and Castle",
  "map.area.london-bridge": "London Bridge",
  "map.area.city": "The City",
  "map.water.thames": "The Thames",
  "map.card.elephant": "Elephant and London Bridge",
  "map.card.old-kent-road": "Old Kent Road",
  "map.card.camberwell": "Camberwell",
  "map.card.peckham": "Peckham",
  "map.card.nunhead": "Nunhead",
  "map.inset.heathrow": "Heathrow",
  "map.inset.west": "Far west, by train",
};

/** Calgary's own words: its districts, its cards and its river. */
export const uiCalgaryMapText: Record<string, string> = {
  "map.area.calgary.whitehorn": "Whitehorn",
  "map.area.calgary.rundle": "Rundle",
  "map.area.calgary.sunridge": "Sunridge",
  "map.area.calgary.airport": "The airport",
  "map.area.calgary.downtown": "Downtown",
  "map.water.bow": "The Bow",
  "map.card.airport": "The airport",
  "map.card.north-east": "The north-east",
  "map.card.downtown": "Downtown",
};

/** Dubai's own words: its districts, its cards and its water. */
export const uiDubaiMapText: Record<string, string> = {
  "map.area.dubai.deira": "Deira",
  "map.area.dubai.bur-dubai": "Bur Dubai",
  "map.area.dubai.garhoud": "Al Garhoud",
  "map.area.dubai.qusais": "Al Qusais",
  "map.area.dubai.business-bay": "Business Bay",
  "map.water.creek": "Dubai Creek",
  "map.water.gulf": "The Gulf",
  "map.card.deira": "Deira",
  "map.card.airport": "The airport",
  "map.card.camp": "The camp",
  "map.card.site": "The site",
};

/** The coast's own words: its districts, its cards, its sea and river, and Naples' inset. */
export const uiCastelMapText: Record<string, string> = {
  "map.area.castel.town": "Castel Volturno",
  "map.area.castel.pinetamare": "Pinetamare",
  "map.area.castel.fields": "The fields",
  "map.area.castel.varcaturo": "Varcaturo",
  "map.water.tyrrhenian": "The sea",
  "map.water.volturno": "The Volturno",
  "map.card.town": "The town",
  "map.card.fields": "The fields",
  "map.card.domitiana": "The Domitiana",
  "map.inset.naples": "Naples",
  "map.inset.inland": "Inland, by bus",
};
