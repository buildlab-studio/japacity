// First drafts: the page gives types, not names.
export const obligationText: Record<string, string> = {
  "obligation.upkeep.name": "Upkeep",
  "obligation.home-support.name": "Money sent home",
  "obligation.salary-loan.name": "Salary loan",
  "obligation.quick-loan.name": "QuickNaira loan",
  "obligation.held-funds.name": "Proof of funds from the microfinance bank",
  "obligation.held-funds-agent.name": "Proof of funds from Mr Kunle",

  // Report lines. Each carries `obligation`, the entry id, so the interface can name it.
  "line.obligation.charged": "Paid this month: {amount}.",
  "line.obligation.missed": "You could not pay {amount} this month. It has been noticed.",
  "line.obligation.defaulted": "The loan has gone bad. The lender wants the {amount} still owed and will take it from your account.",
  "line.obligation.seized": "The lender took {amount} from your account toward the loan.",
  "line.obligation.taken-back": "The interest was not paid. The lender has taken back the {amount} that was held for you.",
  "line.obligation.closed": "That one is settled. Nothing more is owed on it.",
};
