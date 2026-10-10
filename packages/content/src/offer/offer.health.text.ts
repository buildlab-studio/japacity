// First drafts for health.md's offers.
export const offerHealthText: Record<string, string> = {
  "offer.illness.name": "You are ill",
  "offer.illness.title": "You are ill",
  "offer.illness.body":
    "Fever, a headache that will not go, and no appetite. The hospital will want {hospital} for the consultation, the tests and the drugs. The chemist down the road sells a dose for {chemist}.",
  "offer.illness.choice.hospital": "Go to the hospital and rest",
  "offer.illness.choice.chemist": "Buy something at the chemist",
  "offer.illness.choice.ignore": "Ignore it and carry on",
  "offer.illness.said.hospital": "You went to the hospital and rested. The fever broke, and the rest took its weeks.",
  "offer.illness.said.chemist": "You bought something at the chemist. The fever eased, but it did not go.",
  "offer.illness.said.ignore": "You carried on with the fever. It put you on your back anyway, for weeks.",

  "offer.illness-worse.name": "It has got worse",
  "offer.illness-worse.title": "It has got worse",
  "offer.illness-worse.body":
    "The fever is back, and worse. The doctor wants a scan and an X-ray and a bed for you: {hospital}. Either way it will be weeks before you are well.",
  "offer.illness-worse.choice.hospital": "Be admitted",
  "offer.illness-worse.choice.cannot": "Stay home and let the family nurse you",
  "offer.illness-worse.said.hospital": "You were admitted: the scan, the X-ray and a bed for weeks.",
  "offer.illness-worse.said.cannot": "You stayed home and the family nursed you. It took weeks, and the whole house carried it.",

  "offer.village-burial.name": "A burial in the village",
  "offer.village-burial.title": "A burial in the village",
  "offer.village-burial.body":
    "Your father: 'My uncle has died. The burial is this month, in the village, and the family expects to see you there.' The trip is ₦60,000.",
  "offer.village-burial.choice.go": "Travel home for it",
  "offer.village-burial.choice.send-money": "Send ₦100,000 instead",
  "offer.village-burial.choice.absent": "Stay away",
  "offer.village-burial.said.send-money": "You sent money instead of going to the burial. The family took it, and saw you were not there.",
  "offer.village-burial.said.absent": "You stayed away from the burial. The family will not forget it.",
  // What the results say once the trip is taken.
  "offer.village-burial.said.go": "You travel to the village for the burial. The whole family is there.",

  "offer.court-date.name": "A court date",
  "offer.court-date.title": "A court date",
  "offer.court-date.body": "A letter from the court about what you still owe. The hearing is this month, and it will take a day.",
  "offer.court-date.choice.attend": "Attend",
  "offer.court-date.said.attend": "You attended the hearing. It took the day.",
};
