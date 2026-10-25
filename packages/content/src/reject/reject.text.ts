// One line for each rejection code in the contract.
export const rejectText: Record<string, string> = {
  "reject.stale": "Something changed while you were deciding. Look again and try once more.",
  "reject.clock-went-back": "The clock went back. Try again.",
  "reject.setpiece-open": "Answer what is in front of you first.",
  "reject.not-legal": "You cannot do that now.",
  // route-gates:canada-funds-checked-at-departure: a flight refused because the funds shown are short on the day.
  "reject.not-legal.funds": "Your funds are short of what Canada asks to see. The flight waits until the money is back.",
  "reject.cannot-afford": "You do not have enough money for that.",
  "reject.unknown-id": "That is not something the game knows.",
  "reject.bad-amount": "That amount will not work. Use a whole amount within the limit.",
  "reject.not-yours": "Only the game can do that.",
  "reject.ended": "You have left. This life at home is over.",
  "reject.prologue-open": "Finish the story of how you got here first.",
};
