// Content ids the simulation's tests share, by kind. A name carries its kind when
// the same word names an entry of another kind. Nothing in the simulation imports this file.
import type { Id } from "../engine/types";

export const AGE: Id<"quality"> = "quality.age-months";
export const BELLY: Id<"quality"> = "quality.belly";
export const EDU: Id<"quality"> = "quality.edu-level";
export const ENERGY: Id<"quality"> = "quality.energy";
export const NETWORK: Id<"quality"> = "quality.network";
export const PORTFOLIO: Id<"quality"> = "quality.portfolio";
export const PREP: Id<"quality"> = "quality.interview-prep";
export const STANDING: Id<"quality"> = "quality.standing";
export const TECH: Id<"quality"> = "quality.tech";
export const WELLBEING: Id<"quality"> = "quality.wellbeing";

export const CANADA_ROUTE: Id<"route"> = "route.canada-points";
export const CARE_ROUTE: Id<"route"> = "route.uk-care";
export const CA_ACCOMPANY: Id<"route"> = "route.canada-accompany";
export const CA_SPOUSE: Id<"route"> = "route.canada-spouse";
export const GULF_ROUTE: Id<"route"> = "route.gulf-contract";
export const SKILLED: Id<"route"> = "route.uk-skilled";
export const TALENT: Id<"route"> = "route.uk-talent";
export const UK_DEPENDANT: Id<"route"> = "route.uk-dependant";
export const UK_PARTNER: Id<"route"> = "route.uk-partner";
export const UK_ROUTE: Id<"route"> = "route.uk-masters";

export const ASK_AROUND: Id<"activity"> = "activity.ask-around";
export const BET: Id<"activity"> = "activity.bet-slip";
export const BUY_PHONE: Id<"activity"> = "activity.buy-phone";
export const COOK: Id<"activity"> = "activity.cook-own";
export const HUNT: Id<"activity"> = "activity.job-hunt";
export const JUNIOR_DEV: Id<"activity"> = "activity.job-junior-dev";
export const LOOK_INTO: Id<"activity"> = "activity.look-into-route";
export const LOTTO: Id<"activity"> = "activity.play-lotto";
export const NIGHT_SUPPORT: Id<"activity"> = "activity.night-support";
export const REST: Id<"activity"> = "activity.rest";
export const RIDE: Id<"activity"> = "activity.ride-driving";
export const TO_STOP: Id<"activity"> = "activity.see-agent-stop";
export const TUTORING: Id<"activity"> = "activity.weekend-tutoring";

export const DECISION: Id<"chapter"> = "chapter.decision-day";
export const FEET: Id<"chapter"> = "chapter.find-your-feet";
export const FILE: Id<"chapter"> = "chapter.build-the-file";
export const LANDING: Id<"chapter"> = "chapter.landing";
export const SECURE: Id<"chapter"> = "chapter.secure";
export const SEND_OFF: Id<"chapter"> = "chapter.send-off";

export const CANADA_COUNTRY: Id<"country"> = "country.canada";
export const ITALY: Id<"country"> = "country.italy";
export const UAE: Id<"country"> = "country.uae";
export const UK_COUNTRY: Id<"country"> = "country.uk";

export const UK_GRADUATE: Id<"status"> = "status.uk-graduate";
export const OVERSTAYER: Id<"status"> = "status.uk-overstayer";
export const SETTLED: Id<"status"> = "status.uk-settled";
export const SPONSORED: Id<"status"> = "status.uk-sponsored";
export const STUDENT: Id<"status"> = "status.uk-student";

export const GRADUATE: Id<"scenario"> = "scenario.graduate";
export const PROLOGUE: Id<"scenario"> = "scenario.prologue";
export const READY: Id<"scenario"> = "scenario.ready";
export const BANKER: Id<"scenario"> = "scenario.banker";

export const AGENT_DEBT: Id<"obligation"> = "obligation.agent-debt";
export const CAR: Id<"obligation"> = "obligation.car";
export const FAMILY_UPKEEP: Id<"obligation"> = "obligation.upkeep";
export const RENT_FLAT: Id<"obligation"> = "obligation.rent-flat-uk";
export const RENT_ROOM: Id<"obligation"> = "obligation.rent-room-uk";
export const SHORTFALL: Id<"obligation"> = "obligation.car-shortfall";
export const TUITION: Id<"obligation"> = "obligation.tuition";
export const UK_PHONE: Id<"obligation"> = "obligation.phone-uk";
export const UK_UPKEEP: Id<"obligation"> = "obligation.upkeep-uk";
export const UNDERTAKING: Id<"obligation"> = "obligation.undertaking-canada";

export const CAS: Id<"document"> = "document.cas";
export const ENGLISH: Id<"document"> = "document.english-test";
export const PASSPORT: Id<"document"> = "document.passport";
export const TB: Id<"document"> = "document.tb-certificate";
export const TRANSCRIPT: Id<"document"> = "document.transcript";

export const CALM: Id<"era"> = "era.calm";

export const FLOAT: Id<"news"> = "news.naira-float";

export const ROAD_PARK: Id<"offer"> = "offer.road-park";
export const STOP: Id<"offer"> = "offer.agent-stop";

export const ROOM: Id<"place"> = "place.the-room";

export const ASHBY: Id<"school"> = "school.ashby";
export const KINGSMERE: Id<"school"> = "school.kingsmere";
export const NORTHGATE: Id<"school"> = "school.northgate";

export const DECEMBER_SETPIECE: Id<"setpiece"> = "setpiece.december";
export const INTERVIEW: Id<"setpiece"> = "setpiece.credibility-interview";

export const DECEMBER_VAR: Id<"var"> = "var.season-december";
export const STUDY_WINDOW: Id<"var"> = "var.uk-study-window";
