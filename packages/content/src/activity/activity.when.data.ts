// When each act answers (docs/rules/activity.md R-ACTIVITY-015).
// A now-act is anything quick, a purchase or a conversation, sent at once by `activity/now`; every
// other entry, each job and side job among them, fills the month as a slot pick. A purchase runs as
// often as money allows, an act marked repeat as often as the month's free time allows (R-ACTIVITY-019),
// and any other now-act once a month.
import type { ActivityEntry, Id } from "@japacity/sim";

import { NOW_HALF_DAYS } from "./activity.days.data";

type Now = "once" | "purchase" | "repeat";

const NOW_ACTS: Record<string, Now> = {
  // The kiosk and the bet slip: the slip in hand now, the draw or the match later.
  "activity.play-lotto": "purchase",
  "activity.bet-slip": "purchase",
  // Asking around: a line from someone there now, the route heard now, the pitch opened now.
  "activity.ask-around": "once",
  // The official page and the adviser's visit.
  "activity.look-into-route": "once",
  "activity.see-adviser": "once",
  // The word of someone who went, and the agents at the stop and up the stairs: a conversation.
  "activity.ask-someone-who-went": "once",
  "activity.see-agent-stop": "once",
  "activity.see-agent-office": "once",
  // The meetup, at home and abroad, seeing or calling someone, the family meeting.
  "activity.meetup": "once",
  "activity.community-uk": "once",
  "activity.community-ca": "once",
  "activity.community-uae": "once",
  "activity.see-someone": "once",
  "activity.call-someone": "once",
  "activity.call-home": "once",
  "activity.family-meeting": "once",
  "activity.ask-family-loan": "once",
  // Buying a phone and the shopping abroad.
  "activity.buy-phone": "purchase",
  "activity.street-shopping-uk": "purchase",
  "activity.street-shopping-uae": "purchase",
  // Signing for a car, a flat or a phone abroad, and sending money home: done at a counter.
  "activity.buy-car-finance": "once",
  "activity.rent-flat-uk": "once",
  "activity.rent-flat-ca": "once",
  "activity.phone-contract-uk": "once",
  "activity.phone-contract-ca": "once",
  "activity.send-money": "once",
  // The cash gig, posting from the phone, the safe ride.
  "activity.side-gig": "once",
  "activity.tech-posts": "once",
  "activity.safe-ride": "once",
  // Every paper's request: made now, the wait starting now.
  "activity.get-passport": "once",
  "activity.get-transcript": "once",
  "activity.sit-english-test": "once",
  "activity.tb-test": "once",
  "activity.get-police-certificate": "once",
  "activity.gulf-medical": "once",
  "activity.get-eca": "once",
  "activity.request-verification": "once",
  "activity.apply-endorsement": "once",
  "activity.renew-licence": "once",
  "activity.nmc-tests": "once",
  // Every application: sent now, the answer with the month.
  "activity.apply-to-school": "once",
  "activity.apply-for-visa": "once",
  "activity.apply-uk-care": "once",
  "activity.apply-uk-talent": "once",
  "activity.apply-uk-skilled": "once",
  "activity.apply-uk-partner": "once",
  "activity.apply-uk-dependant": "once",
  "activity.apply-ca-spouse": "once",
  "activity.apply-ca-accompany": "once",
  "activity.apply-gulf-contract": "once",
  "activity.enter-pool": "once",
  "activity.find-sponsor": "once",
  // The job hunt: applied now, the employer answering with the month.
  "activity.job-hunt": "once",
  // The room and the family, as often as the month's time allows (R-ACTIVITY-019, decision 0035): meals, water, a nap, a bath, the TV,
  // gist with Mama and her shop, and the study that answers at once.
  "activity.cook-at-home": "repeat",
  "activity.cook-jollof": "repeat",
  "activity.cook-own": "repeat",
  "activity.cook-own-pot": "repeat",
  "activity.fetch-water": "repeat",
  "activity.fill-drum": "repeat",
  "activity.nap": "repeat",
  "activity.bucket-bath": "repeat",
  "activity.watch-tv": "repeat",
  "activity.help-shop": "repeat",
  "activity.family-time": "repeat",
  "activity.study-english": "repeat",
  "activity.learn-tech": "repeat",
  "activity.build-portfolio": "repeat",
  // The street's enjoyment and spending (streets.md R-STREET-011, decision 0037): the barber and the clothes once a
  // month, the water a purchase, the rest as often as the month's time allows.
  "activity.buy-suya": "repeat",
  "activity.mallam-tea": "repeat",
  "activity.pure-water": "purchase",
  "activity.barber": "once",
  "activity.viewing-centre": "repeat",
  "activity.beer-joint": "repeat",
  "activity.night-out": "repeat",
  "activity.buy-clothes": "once",
  // London lived by hand (place.md R-PLACE-012, streets.md R-STREET-012): the bus pass once a month at the machine.
  "activity.bus-pass-uk": "once",
  // The food and the evenings as often as the month's time allows, the barber and the clothes once a month.
  "activity.weekly-shop-uk": "repeat",
  "activity.cook-own-uk": "repeat",
  "activity.chicken-shop": "repeat",
  "activity.naija-shop-uk": "repeat",
  "activity.pub-pint": "repeat",
  "activity.barber-uk": "once",
  "activity.buy-clothes-uk": "once",
  // Calgary, Dubai and Castel Volturno lived by hand (place.md R-PLACE-012, streets.md R-STREET-013 to 015):
  // each pass once a month at its machine, the coffees a purchase, the food and the evenings as often as the month's
  // time allows, the barbers and the clothes once a month, the church's community once as the other countries' are.
  "activity.transit-pass-ca": "once",
  "activity.weekly-shop-ca": "repeat",
  "activity.cook-own-ca": "repeat",
  "activity.coffee-ca": "purchase",
  "activity.naija-shop-ca": "repeat",
  "activity.barber-ca": "once",
  "activity.buy-clothes-ca": "once",
  "activity.transit-pass-uae": "once",
  "activity.weekly-shop-uae": "repeat",
  "activity.cook-own-uae": "repeat",
  "activity.cafeteria-uae": "repeat",
  "activity.naija-shop-uae": "repeat",
  "activity.barber-uae": "once",
  "activity.buy-clothes-uae": "once",
  "activity.laundry-uae": "repeat",
  "activity.weekly-shop-it": "repeat",
  "activity.cook-own-it": "repeat",
  "activity.coffee-it": "purchase",
  "activity.naija-shop-it": "repeat",
  "activity.barber-it": "once",
  "activity.buy-clothes-it": "once",
  "activity.street-shopping-it": "repeat",
  "activity.community-it": "once",
};

/**
 * Every entry with its `when`, and a purchase marked (R-ACTIVITY-015). An entry that already says when it answers is
 * kept as the same object, so a table sorted where it is written stays itself in content.
 */
export function withWhen(table: Record<Id<"activity">, ActivityEntry>): Record<Id<"activity">, ActivityEntry> {
  const sorted: Record<Id<"activity">, ActivityEntry> = {};
  for (const [id, entry] of Object.entries(table) as [Id<"activity">, ActivityEntry][]) {
    if (entry.when !== undefined) {
      sorted[id] = entry;
      continue;
    }
    const now = NOW_ACTS[id];
    // A purchase spends no time; any other now-act spends its half-days from the table, a morning without one (R-ACTIVITY-018).
    sorted[id] =
      now === undefined
        ? { ...entry, when: "month" }
        : now === "purchase"
          ? { ...entry, when: "now", purchase: true as const }
          : { ...entry, when: "now", halfDays: NOW_HALF_DAYS[id] ?? 1, ...(now === "repeat" ? { repeat: true as const } : {}) };
  }
  return sorted;
}

/** The now-acts this table names, so a test can find one that names no entry. */
export const nowActIds: readonly string[] = Object.keys(NOW_ACTS);
