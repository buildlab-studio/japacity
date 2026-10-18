// Words for the boards and their two pickers (docs/rules/city.md R-CITY-039,
// R-CITY-040). In the voice of docs/rules/text.md.
// ui.words.ts takes them in whole.
export const boardsWords: Record<string, string> = {
  "ui.boards.title": "Boards",
  "ui.boards.when": "When",
  "ui.boards.when.this-week": "This week",
  "ui.boards.when.all-time": "All time",
  "ui.boards.who": "Who",
  "ui.boards.who.everyone": "Everyone",
  "ui.boards.who.friends": "Friends",
  "ui.boards.about.this-week": "How far each japacity rose since Monday. A new player can top it.",
  "ui.boards.about.all-time": "Each player's japacity on their best route.",
  "ui.boards.about.friends": "You and the players you joined through an invite.",
  "ui.boards.loading": "Fetching the board...",
  "ui.boards.paused": "This board is paused for now. Look again later.",
  "ui.boards.secure": "Secure your life to see the boards and be on them. Until then it lives only on this phone.",
  "ui.boards.failed": "The board did not load.",
  "ui.boards.retry": "Try again",
  "ui.boards.empty": "Nobody is on this board yet.",
  "ui.boards.empty.friends": "None of your friends has a route yet.",
  "ui.boards.you": "You",
  // R-CITY-040: a line whose account is not there (a deletion under way) has no username to show.
  "ui.boards.someone": "A player",
  "ui.boards.your-place": "Your place",
  "ui.boards.no-route": "You are not on this board yet: you have no route yet.",
  // The figure alone, as the week's "+N" says it, never a percentage.
  "ui.boards.figure.all-time": "{figure}",
  "ui.boards.figure.this-week.up": "+{figure}",
  "ui.boards.figure.this-week.down": "{figure}",
  "ui.boards.rank": "Number {rank}",
  "ui.boards.joined-week": "Joined the same week as you",
  "ui.boards.joined-week.about": "Everyone who started in the same week, by japacity.",
};
