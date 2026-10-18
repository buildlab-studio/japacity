// Where a life is from (prologue:family-draw-on-first-answer): Lagos is the city the game is played in, but most lives come to
// it from somewhere else. The family drawn in the city is from one of the cities, the family drawn in a town from one of the towns, spread across the six zones and
// across the north and the south as the names are (person.names.data.ts). Real towns are named as where people are
// from, never as a place the game shows. The words are `hometown.<slug>.name` in prologue.hometown.text.ts.

/**
 * The brace any line may carry for where the life is from: `{hometown}`. The screen fills it from the view, so one line
 * serves every hometown and no entry carries it as a term of its own.
 */
export const HOMETOWN_FILL = "hometown";

/** The cities a family drawn in the city is from: state capitals and the big trading cities. */
export const hometownCities: string[] = [
  "hometown.ibadan",
  "hometown.kano",
  "hometown.enugu",
  "hometown.jos",
  "hometown.port-harcourt",
  "hometown.maiduguri",
  "hometown.abeokuta",
  "hometown.kaduna",
  "hometown.owerri",
  "hometown.ilorin",
  "hometown.benin-city",
  "hometown.sokoto",
  "hometown.onitsha",
  "hometown.makurdi",
  "hometown.calabar",
  "hometown.bauchi",
  "hometown.akure",
  "hometown.zaria",
  "hometown.aba",
  "hometown.lokoja",
  "hometown.warri",
  "hometown.yola",
  "hometown.osogbo",
  "hometown.minna",
  "hometown.uyo",
];

/** The towns a family drawn in a town is from: smaller places, none a state capital. */
export const hometownTowns: string[] = [
  "hometown.nsukka",
  "hometown.okene",
  "hometown.ilesa",
  "hometown.biu",
  "hometown.ikot-ekpene",
  "hometown.kafanchan",
  "hometown.nnewi",
  "hometown.bida",
  "hometown.oyo",
  "hometown.azare",
  "hometown.sapele",
  "hometown.otukpo",
  "hometown.orlu",
  "hometown.funtua",
  "hometown.ijebu-ode",
  "hometown.keffi",
];

/** A life born in Lagos: the child of the water, whose home answer is Makoko (prologue:makoko-start-never-a-trap). */
export const hometownByHome: Record<string, string> = { makoko: "hometown.lagos" };

/** Where each of the hometowns sits, for the spread: the north (north-central, north-west, north-east) or the south. */
export const hometownRegion: Record<string, "north" | "south"> = {
  "hometown.ibadan": "south",
  "hometown.abeokuta": "south",
  "hometown.akure": "south",
  "hometown.osogbo": "south",
  "hometown.enugu": "south",
  "hometown.owerri": "south",
  "hometown.onitsha": "south",
  "hometown.aba": "south",
  "hometown.port-harcourt": "south",
  "hometown.benin-city": "south",
  "hometown.warri": "south",
  "hometown.calabar": "south",
  "hometown.uyo": "south",
  "hometown.ilorin": "north",
  "hometown.jos": "north",
  "hometown.makurdi": "north",
  "hometown.lokoja": "north",
  "hometown.minna": "north",
  "hometown.kano": "north",
  "hometown.kaduna": "north",
  "hometown.zaria": "north",
  "hometown.sokoto": "north",
  "hometown.maiduguri": "north",
  "hometown.bauchi": "north",
  "hometown.yola": "north",
  "hometown.ilesa": "south",
  "hometown.oyo": "south",
  "hometown.ijebu-ode": "south",
  "hometown.nsukka": "south",
  "hometown.nnewi": "south",
  "hometown.orlu": "south",
  "hometown.ikot-ekpene": "south",
  "hometown.sapele": "south",
  "hometown.okene": "north",
  "hometown.bida": "north",
  "hometown.otukpo": "north",
  "hometown.keffi": "north",
  "hometown.kafanchan": "north",
  "hometown.funtua": "north",
  "hometown.biu": "north",
  "hometown.azare": "north",
  "hometown.lagos": "south",
};
