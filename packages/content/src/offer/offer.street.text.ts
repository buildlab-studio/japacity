// Words for the bridge's price (streets.md R-STREET-004). Told straight.
// The offer kind names a line by its key in a term (`lost`, `night`); the words read the key's `.name`.
export const offerStreetText: Record<string, string> = {
  "offer.bridge-theft.name": "Your bag in the night",
  "offer.bridge-theft.title": "Your bag, gone",
  "offer.bridge-theft.body": "Someone went through your bag while you slept under the bridge. {lost}",
  "offer.bridge-theft.taken.name": "The cash in it is gone.",
  "offer.bridge-theft.nothing.name": "There was no cash in it to take.",
  "offer.bridge-theft.choice.carry-on": "Carry on",

  "offer.bridge-mosquitoes.name": "Mosquitoes",
  "offer.bridge-mosquitoes.title": "Mosquitoes all night",
  "offer.bridge-mosquitoes.body": "The mosquitoes found you under the bridge all night, and you wake up aching with it still there by evening.",
  "offer.bridge-mosquitoes.choice.carry-on": "Carry on",
  "offer.bridge-mosquitoes.said.carry-on": "You carried on, aching. It did not pass.",

  "offer.bridge-night.name": "A bad night",
  "offer.bridge-night.title": "A bad night",
  "offer.bridge-night.body": "{night}",
  "offer.bridge-night.woman.name": "A man would not leave you alone in the night. You moved your mat closer to the others and did not sleep again.",
  "offer.bridge-night.man.name": "A man under the bridge wanted to fight you for your spot. You walked away, and did not sleep again.",
  "offer.bridge-night.anyone.name": "There was trouble under the bridge in the night. You kept your bag close and did not sleep again.",
  "offer.bridge-night.choice.carry-on": "Carry on",
  "offer.bridge-night.said.carry-on": "You carried on after the night under the bridge. It wore on you.",
};
