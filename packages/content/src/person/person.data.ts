// Computer characters who can fill a slot: docs/rules/person.md "Entries:
// computer partners" and "Entries: computer siblings". All invented.
//
// The page gives no age gap for a partner, so each is drawn from two
// years younger to three years older.
// A partner abroad has been there from the first month
// (`abroadFromMonth` 0), since it holds its status already (person:joint-application-proposed).
// The page gives skills only for the nurse; the others carry working
// values that suit their work.
// There is no driver's job in the Gulf ladder, so the driver holds no job id.
import type { Id, PersonEntry, Requirement } from "@japacity/sim";

import { aed, cad, naira, pounds } from "../units";

const AGE: Id<"quality"> = "quality.age-months";
const MONTHS_PER_YEAR = 12;

function ageAtLeast(years: number): Requirement {
  return { type: "quality/min", quality: AGE, value: years * MONTHS_PER_YEAR };
}

const AT_HOME: Requirement = { type: "place/is", where: "home" };
const PARTNER_GAP: [number, number] = [-24, 36];

/** The spots people meet at (person:time-together-is-an-act). */
export const peopleSpots: string[] = ["beach", "suya-spot", "church", "cinema", "mall", "friends-wedding", "campus", "bus-stop"];
const WHATS = ["talked", "ate", "walked", "watched-film", "met-family", "argued-made-up", "prayed", "danced"];
const CALLS = ["video-call", "voice-note", "long-call"];

type Profile = PersonEntry["profile"];
type Behaviour = PersonEntry["behaviour"];

const NO_PLACE = { country: null, status: null, abroadFromMonth: null, settledStatus: null, settledFromMonth: null } as const;

function partner(id: Id<"person">, when: Requirement[], profile: Profile, behaviour: Behaviour, abroad: boolean): PersonEntry {
  return { id, role: "partner", weight: 1, when, profile, behaviour, spots: [...peopleSpots], whats: [...WHATS], calls: abroad ? [...CALLS] : [] };
}

function sibling(id: Id<"person">, weight: number, profile: Profile): PersonEntry {
  const behaviour: Behaviour = { courtMonths: 0, agreeBp: 0, marryAfterMonths: 0, marryInDecember: false, patienceMonths: null, jealousBp: 0, recallBp: 0, plan: "not-decided", papers: false };
  return { id, role: "sibling", weight, when: [], profile, behaviour, spots: [], whats: [], calls: [] };
}

function behaviour(courtMonths: number, agreeBp: number, marryAfterMonths: number, marryInDecember: boolean, patienceMonths: number | null, jealousBp: number, recallBp: number, plan: string): Behaviour {
  return { courtMonths, agreeBp, marryAfterMonths, marryInDecember, patienceMonths, jealousBp, recallBp, plan, papers: false };
}

export const personTable: Record<Id<"person">, PersonEntry> = {
  "person.dele-banker": partner(
    "person.dele-banker",
    [ageAtLeast(21), AT_HOME],
    { ageGapMonths: PARTNER_GAP, eduLevel: 3, englishBand: 55, care: 20, tech: 30, home: "city", job: "activity.job-bank-officer", pay: { currency: "NGN", amount: naira(4800000) }, ...NO_PLACE },
    behaviour(4, 6000, 8, false, 3, 5000, 8500, "with-you-abroad"),
    false,
  ),
  "person.hauwa-nurse": partner(
    "person.hauwa-nurse",
    [ageAtLeast(21), AT_HOME],
    { ageGapMonths: PARTNER_GAP, eduLevel: 3, englishBand: 60, care: 60, tech: 15, home: "town", job: "activity.job-nurse", pay: { currency: "NGN", amount: naira(2400000) }, ...NO_PLACE },
    behaviour(5, 6000, 8, false, 3, 4000, 8500, "canada"),
    false,
  ),
  "person.kelechi-developer": partner(
    "person.kelechi-developer",
    [ageAtLeast(22)],
    {
      ageGapMonths: PARTNER_GAP,
      eduLevel: 4,
      englishBand: 75,
      care: 10,
      tech: 70,
      home: "city",
      job: "activity.job-uk-skilled",
      pay: { currency: "GBP", amount: pounds(48000) },
      country: "country.uk",
      status: "status.uk-sponsored",
      abroadFromMonth: 0,
      settledStatus: null,
      settledFromMonth: null,
    },
    behaviour(9, 5000, 12, true, 2, 6000, 8000, "uk"),
    true,
  ),
  "person.ejiro-uk": partner(
    "person.ejiro-uk",
    [ageAtLeast(22)],
    {
      ageGapMonths: PARTNER_GAP,
      eduLevel: 2,
      englishBand: 65,
      care: 65,
      tech: 15,
      home: "town",
      job: "activity.job-uk-senior-care",
      pay: { currency: "GBP", amount: pounds(31000) },
      country: "country.uk",
      status: "status.uk-settled",
      abroadFromMonth: 0,
      settledStatus: null,
      settledFromMonth: null,
    },
    behaviour(9, 5000, 12, true, 2, 5000, 8000, "uk"),
    true,
  ),
  "person.uduak-canada": partner(
    "person.uduak-canada",
    [ageAtLeast(22)],
    {
      ageGapMonths: PARTNER_GAP,
      eduLevel: 3,
      englishBand: 80,
      care: 15,
      tech: 50,
      home: "city",
      job: "activity.job-ca-professional",
      pay: { currency: "CAD", amount: cad(62000) },
      country: "country.canada",
      status: "status.ca-resident",
      abroadFromMonth: 0,
      settledStatus: null,
      settledFromMonth: null,
    },
    behaviour(9, 5000, 12, true, 2, 5000, 8000, "canada"),
    true,
  ),
  "person.tonye-dubai": partner(
    "person.tonye-dubai",
    [ageAtLeast(21)],
    {
      ageGapMonths: PARTNER_GAP,
      eduLevel: 1,
      englishBand: null,
      care: 10,
      tech: 10,
      home: "town",
      job: null,
      pay: { currency: "AED", amount: aed(30000) },
      country: "country.uae",
      status: "status.gulf-worker",
      abroadFromMonth: 0,
      settledStatus: null,
      settledFromMonth: null,
    },
    behaviour(6, 6000, 10, true, 2, 5000, 8000, "home"),
    true,
  ),
  "person.papers-uk": {
    id: "person.papers-uk",
    role: "partner",
    weight: 1,
    // person:papers-marriage-offer: only through `offer.papers-marriage`, never offered as a candidate.
    when: [],
    profile: {
      ageGapMonths: [60, 240],
      eduLevel: 1,
      englishBand: null,
      care: 0,
      tech: 0,
      home: "city",
      job: null,
      pay: { currency: "GBP", amount: pounds(30000) },
      country: "country.uk",
      status: "status.uk-citizen",
      abroadFromMonth: 0,
      settledStatus: null,
      settledFromMonth: null,
    },
    behaviour: { courtMonths: 0, agreeBp: 10000, marryAfterMonths: 0, marryInDecember: false, patienceMonths: null, jealousBp: 0, recallBp: 2000, plan: "not-decided", papers: true },
    spots: [...peopleSpots],
    whats: [...WHATS],
    calls: [...CALLS],
  },

  "person.sibling-home": sibling("person.sibling-home", 6000, { ageGapMonths: [-60, 60], eduLevel: 1, englishBand: null, care: 20, tech: 10, home: "town", job: null, pay: null, ...NO_PLACE }),
  "person.sibling-lagos-hustle": sibling("person.sibling-lagos-hustle", 1800, { ageGapMonths: [-36, 36], eduLevel: 2, englishBand: null, care: 10, tech: 20, home: "city", job: null, pay: null, ...NO_PLACE }),
  "person.sibling-uk-later": sibling("person.sibling-uk-later", 900, {
    ageGapMonths: [12, 60],
    eduLevel: 3,
    englishBand: 70,
    care: 50,
    tech: 20,
    home: "city",
    job: "activity.job-uk-nurse",
    pay: { currency: "GBP", amount: pounds(33000) },
    country: "country.uk",
    status: "status.uk-sponsored",
    abroadFromMonth: 36,
    settledStatus: "status.uk-settled",
    settledFromMonth: 96,
  }),
  "person.sibling-gulf": sibling("person.sibling-gulf", 700, {
    ageGapMonths: [-24, 36],
    eduLevel: 1,
    englishBand: null,
    care: 10,
    tech: 10,
    home: "town",
    job: "activity.job-gulf-guard",
    pay: { currency: "AED", amount: aed(24000) },
    country: "country.uae",
    status: "status.gulf-worker",
    abroadFromMonth: 12,
    settledStatus: null,
    settledFromMonth: null,
  }),
  "person.sibling-canada": sibling("person.sibling-canada", 300, {
    ageGapMonths: [24, 96],
    eduLevel: 3,
    englishBand: 80,
    care: 15,
    tech: 50,
    home: "city",
    job: "activity.job-ca-professional",
    pay: { currency: "CAD", amount: cad(58000) },
    country: "country.canada",
    status: "status.ca-resident",
    abroadFromMonth: 0,
    settledStatus: "status.ca-citizen",
    settledFromMonth: 36,
  }),
  "person.sibling-uk-settled": sibling("person.sibling-uk-settled", 300, {
    ageGapMonths: [36, 120],
    eduLevel: 2,
    englishBand: 70,
    care: 60,
    tech: 10,
    home: "city",
    job: "activity.job-uk-senior-care",
    pay: { currency: "GBP", amount: pounds(31000) },
    country: "country.uk",
    status: "status.uk-settled",
    abroadFromMonth: 0,
    settledStatus: "status.uk-citizen",
    settledFromMonth: 60,
  }),
};
