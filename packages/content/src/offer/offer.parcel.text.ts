// Words for things shipped home (offer.parcel.data.ts). The sender's note is in their own voice; the
// clerk's slip is plain. The board over the booth names the trade and never a figure of money.
// The offer kind names who sent it by a words key in the term `from`; the words read that key's `.name`.
export const offerParcelText: Record<string, string> = {
  "offer.parcel-shipped.name": "A parcel for you",
  "offer.parcel-shipped.title": "Parcel for you",
  "offer.parcel-shipped.body": "“{from} shipped you something for your birthday: collect it here at the cargo office on Bode Thomas Street.”",
  "offer.parcel-shipped.from.aunty.name": "Your aunty in Houston",

  "offer.parcel-shipped.choice.aunty-phone": "Collect it",
  "offer.parcel-shipped.choice.aunty-laptop": "Collect it",
  "offer.parcel-shipped.choice.aunty-clothes": "Collect it",
  "offer.parcel-shipped.choice.aunty-food": "Collect it",
  "offer.parcel-shipped.choice.sibling-phone": "Collect it",
  "offer.parcel-shipped.choice.sibling-laptop": "Collect it",
  "offer.parcel-shipped.choice.sibling-clothes": "Collect it",
  "offer.parcel-shipped.choice.sibling-food": "Collect it",

  // The results line, once it is collected.
  "offer.parcel-shipped.said.aunty-phone": "A parcel from your aunty in Houston: a phone.",
  "offer.parcel-shipped.said.aunty-laptop": "A parcel from your aunty in Houston: a laptop.",
  "offer.parcel-shipped.said.aunty-clothes": "A parcel from your aunty in Houston: clothes for an interview.",
  "offer.parcel-shipped.said.aunty-food": "A parcel from your aunty in Houston: foodstuff.",
  "offer.parcel-shipped.said.sibling-phone": "A parcel from your sibling abroad: a phone.",
  "offer.parcel-shipped.said.sibling-laptop": "A parcel from your sibling abroad: a laptop.",
  "offer.parcel-shipped.said.sibling-clothes": "A parcel from your sibling abroad: clothes for an interview.",
  "offer.parcel-shipped.said.sibling-food": "A parcel from your sibling abroad: foodstuff.",

  // The note taped to it, in the sender's own words.
  "offer.parcel-shipped.note.aunty-phone": "Your phone is always off when I call. Charge this one. Happy birthday, my dear.",
  "offer.parcel-shipped.note.aunty-laptop": "For your applications. Do not lend it to anybody. Happy birthday, my dear.",
  "offer.parcel-shipped.note.aunty-clothes": "Two shirts and a jacket. Dress well for the interview. Happy birthday, my dear.",
  "offer.parcel-shipped.note.aunty-food": "Milo, cornflakes and tinned fish. Eat, you are too thin. Happy birthday, my dear.",
  "offer.parcel-shipped.note.sibling-phone": "My old one, but it works well. Call Mummy on it sometimes. Happy birthday.",
  "offer.parcel-shipped.note.sibling-laptop": "Work gave me a new one, so this one is yours. Use it well. Happy birthday.",
  "offer.parcel-shipped.note.sibling-clothes": "They don't fit me again. Wear the jacket to the interview. Happy birthday.",
  "offer.parcel-shipped.note.sibling-food": "Biscuits, Milo and noodles. Don't share it with everybody. Happy birthday.",

  // The waybill at the counter: a paper slip.
  "offer.parcel-shipped.waybill.head": "Waybill · air cargo",
  "offer.parcel-shipped.waybill.from": "From",
  "offer.parcel-shipped.waybill.to": "To",
  "offer.parcel-shipped.waybill.you": "You",
  "offer.parcel-shipped.waybill.contents": "Contents",
  "offer.parcel-shipped.waybill.handling": "Handling",
  "offer.parcel-shipped.waybill.note": "On the note taped to it:",
  "offer.parcel-shipped.waybill.number": "No.",
  "offer.parcel-shipped.contents.phone": "1 phone",
  "offer.parcel-shipped.contents.laptop": "1 laptop",
  "offer.parcel-shipped.contents.clothes": "Clothes, 1 bag",
  "offer.parcel-shipped.contents.food": "Foodstuff, 1 carton",

  // The booth on Bode Thomas Street and its act; its boards are the place's signs 22 and 23.
  "offer.parcel-shipped.booth": "Cargo office",
  "offer.parcel-shipped.act": "Collect it",
  // The nudge while it waits (at most eight words), and the asks sheet away from the booth.
  "offer.parcel-shipped.nudge": "Collect your parcel on Bode Thomas Street",
  "offer.parcel-shipped.away": "Your parcel is at the cargo office on Bode Thomas Street.",

  // The foodstuff takes its share off next month's living costs, as cooking does (R-OBLIGATION-014).
  "line.obligation.relief.parcel-shipped.aunty-food": "Food from the parcel: {amount} less.",
  "line.obligation.relief.parcel-shipped.sibling-food": "Food from the parcel: {amount} less.",
};
