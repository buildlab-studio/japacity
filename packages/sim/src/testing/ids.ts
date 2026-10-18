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
export const CA_ACCOMPANY: Id<"route"> = "route.ca-accompany";
export const CA_SPOUSE: Id<"route"> = "route.ca-spouse";
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
