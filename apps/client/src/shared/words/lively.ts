// The hand's words (docs/design/13-the-lively-layer.md sections 4, 5 and 7):
// the brief handed by its person, the chip and the marker, the talk, the toasts. In the voice of
// docs/rules/text.md, each speaker in their own register; content's table wins over these.
export const livelyText: Record<string, string> = {
  // The brief: a title with a wink, the giver, the rewards as picture chips. Never "chapter", "step", "item" or "task".
  "ui.brief.who": "{name}, {where}",
  "ui.brief.road": "Japa road",
  "ui.brief.now": "Now",
  "ui.brief.then": "Then: {title}",
  "ui.brief.go": "Let's go",
  "ui.brief.next-road": "Next on the road",
  "ui.brief.done": "Done",
  "ui.brief.label": "{title}, from {name}",
  // The road's log in the Japa app: the briefs handed so far, the one carried now, and the next.
  "ui.brief.log": "Your briefs",
  "ui.brief.carrying": "Carrying",
  "ui.brief.next": "Next",
  // The ask: who asks, a title in their voice, the kind as a chip.
  "ui.ask.unknown": "Unknown number",
  "ui.ask.someone": "Someone you know",
  "ui.ask.group.family": "Family",
  "ui.ask.group.job": "Work",
  "ui.ask.group.money": "Money",
  "ui.ask.group.life": "Life",
  "ui.ask.group.road": "The road",
  "ui.ask.group.abroad": "Abroad",
  "ui.ask.group.return": "Home",
  // The month's close: the rest behind one fold.
  "ui.results.whole-month": "See the whole month",
  // Toasts that answer every tap: money in with no act to name.
  "ui.toast.money-in": "Money in",
  // The talk budget: someone near the player, and a longer line opened in its sheet.
  "ui.talk.someone": "Someone nearby",
  "ui.talk.home": "Someone in the house",
  "ui.talk.open": "{name} has more to say",
  "ui.talk.open.someone": "What is on their mind",
};
