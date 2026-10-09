// Words for where the character lives (docs/rules/home.md). The eviction is told straight, never
// as a joke (text.md R-TEXT-002). First drafts.
export const homeText: Record<string, string> = {
  "line.home.moved": "You live at {place} now.",
  "line.home.evicted": "The settlement was cleared. Your room is gone, and {lost} in cash went with it.",
  "line.home.taken-in": "{who} takes you in. No rent for {months} months.",
  "line.home.hosting": "{who} stays with you: upkeep up {amount}.",

  // The story of it, for the News app the month it happens (R-HOME-003).
  "news.makoko-cleared.in-force.head": "Makoko waterfront cleared at dawn",
  "news.makoko-cleared.in-force.body": "Bulldozers and armed men came before sunrise. Families on the water watched their rooms come down. Nobody was told where to go.",
};
