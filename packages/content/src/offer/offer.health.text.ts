// First drafts for health.md's offers.
export const offerHealthText: Record<string, string> = {
  "offer.illness.name": "You are ill",
  "offer.illness.title": "You are ill",
  "offer.illness.body":
    "Fever, a headache that will not go, and no appetite. The hospital will want {hospital} for the consultation, the tests and the drugs. The chemist down the road sells a dose for {chemist}.",
  "offer.illness.choice.hospital": "Go to the hospital and rest",
  "offer.illness.choice.chemist": "Buy something at the chemist",
  "offer.illness.choice.ignore": "Ignore it and carry on",

  "offer.illness-worse.name": "It has got worse",
  "offer.illness-worse.title": "It has got worse",
  "offer.illness-worse.body":
    "The fever is back, and worse. The doctor wants a scan and an X-ray and a bed for you: {hospital}. Either way it will be weeks before you are well.",
  "offer.illness-worse.choice.hospital": "Be admitted",
  "offer.illness-worse.choice.cannot": "There is no money. The family nurses you at home",

  "offer.village-burial.name": "A burial in the village",
  "offer.village-burial.title": "A burial in the village",
  "offer.village-burial.body":
    "Your grandfather's brother has died. The burial is this month, in the village, and the family expects to see you there. The trip is ₦60,000 and it takes one of this month's slots.",
  "offer.village-burial.choice.go": "Travel home for it",
  "offer.village-burial.choice.send-money": "Send ₦100,000 instead",
  "offer.village-burial.choice.absent": "Stay away",
  // What the results say once the trip is taken.
  "offer.village-burial.said.go": "You travel to the village for the burial. The whole family is there.",

  "offer.court-date.name": "A court date",
  "offer.court-date.title": "A court date",
  "offer.court-date.body": "A letter from the court about what you still owe. The hearing is this month, and it will take a day.",
  "offer.court-date.choice.attend": "Attend",
};
