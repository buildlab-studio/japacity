// One line for each rejection code in the contract. First drafts.
export const rejectText: Record<string, string> = {
  "reject.stale": "Something changed while you were deciding. Look again and try once more.",
  "reject.clock-went-back": "The clock went back. Try again.",
  "reject.no-turns": "You have no months left to play. More come with time.",
  "reject.setpiece-open": "Finish the interview first.",
  "reject.not-legal": "You cannot do that now.",
  "reject.cannot-afford": "You do not have enough money for that.",
  "reject.unknown-id": "That is not something the game knows.",
  "reject.bad-amount": "That amount will not work. Use a whole amount within the limit.",
  "reject.not-yours": "Only the game can do that.",
  "reject.ended": "You have left. This life at home is over.",
};
