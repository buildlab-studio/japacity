// Words for where the character lives (docs/rules/home.md). The eviction is told straight, never
// as a joke (text.md R-TEXT-002). First drafts.
export const homeText: Record<string, string> = {
  "line.home.moved": "Home is {place} now.",
  // R-HOME-011: the room's rent went bad. Told straight.
  "line.home.put-out": "The room is gone. The rent was not paid, so you are back at {place}.",
  "line.home.evicted": "The settlement was cleared. Your room is gone, and {lost} in cash went with it.",
  "line.home.evicted-no-cash": "The settlement was cleared. Your room is gone, and what was in it.",
  "line.home.taken-in": "{who} took you in. No rent for {months} months.",
  "line.home.hosting": "{who} stayed with you: living costs up {amount}.",
  // How the lines name a real player, whose own name lives in the other life.
  "home.friend.name": "Your friend",
  "home.guest.name": "A friend",

  // The phone's home card (R-HOME-007). The risk is said once, plainly.
  "phone.home.title": "Where you live",
  "phone.home.place.place.family-house": "The family house",
  "phone.home.place.place.makoko": "A room on the water in Makoko",
  "phone.home.place.place.compound-room": "A room in a compound in Ojuelegba",
  "phone.home.none": "Nowhere of your own right now.",
  "phone.home.guest": "{who} took you in. You stay {until}.",
  "phone.home.charge": "{amount} a month",
  // The month's charge said as what it is: living costs at the family house and in the
  // room, the rent itself on the water.
  "phone.home.charge.place.family-house": "Living costs {amount} a month",
  "phone.home.charge.place.compound-room": "Living costs {amount} a month",
  "phone.home.charge.place.makoko": "Rent {amount} a month",
  // R-HOME-010: the room's year and when it is next taken.
  "phone.home.rent-year": "Rent {amount} a year, next in {count} months",
  "phone.home.rent-year.one": "Rent {amount} a year, next due next month",
  "phone.home.rent-year.zero": "Rent {amount} a year, due this month",
  "phone.home.charge.none": "No rent while you stay.",
  "phone.home.risk": "Some months the settlement is cleared.",
  "phone.home.move.place.makoko": "Move to Makoko",
  "phone.home.move.place.family-house": "Move back to the family house",
  "phone.home.move.place.compound-room": "Rent a room in Ojuelegba",
  "phone.home.move.line.place.makoko": "A room on the water for {amount} a month. The first month is paid now.",
  "phone.home.move.line.place.family-house": "Back home: living costs {amount} a month, food and light included. Your people will talk.",
  // R-HOME-010: from the room, the year paid is gone.
  "phone.home.move.line.from.place.compound-room.place.family-house": "Back home: living costs {amount} a month, food and light included. The year's rent stays with the landlord. Your people will talk.",
  "phone.home.move.line.place.compound-room": "A room of your own. {now} now for the year's rent and fees, then {amount} a month to live.",
  "phone.home.move.button": "Move",
  "phone.home.moved": "Moved.",
  "phone.home.shut.moved": "You moved this month. You can move again next month.",
  "phone.home.shut.short": "You need {amount} for the first month's rent.",
  "phone.home.shut.short.place.compound-room": "You need {amount} for the year's rent and fees.",

  // The story of it, for the News app the month it happens (R-HOME-003).
  "news.makoko-cleared.in-force.head": "Makoko waterfront cleared at dawn",
  "news.makoko-cleared.in-force.body": "Bulldozers and armed men came before sunrise. Families on the water watched their rooms come down. Nobody was told where to go.",
};
