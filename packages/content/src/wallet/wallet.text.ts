// The wallet's report lines. Each line carries `amount` and
// `currency`; the interface formats the money. Keys follow docs/rules/text.md.
export const walletText: Record<string, string> = {
  // Money in.
  "line.wallet.opening": "You started with {amount}.",
  "line.wallet.salary": "Salary paid: {amount}.",
  "line.wallet.salary.label": "Salary",
  "line.wallet.gig": "Paid for side work: {amount}.",
  "line.wallet.gift": "A gift landed: {amount}.",
  "line.wallet.sale": "Sold. {amount} came in.",
  "line.wallet.loan": "The loan was paid out: {amount}.",
  "line.wallet.held-funds": "{amount} went into your account, locked. It counts when funds are shown. It cannot be spent.",
  "line.wallet.refund": "Refund received: {amount}.",

  // Money out.
  "line.wallet.upkeep": "Living costs: {amount}.",
  "line.wallet.family": "Sent to family: {amount}.",
  "line.wallet.fee-document": "Paid at the office: {amount}.",
  "line.wallet.fee-test": "Test fee paid: {amount}.",
  "line.wallet.fee-school": "Paid to the school: {amount}.",
  "line.wallet.fee-visa": "Visa fee paid: {amount}.",
  "line.wallet.fee-surcharge": "Health surcharge paid: {amount}.",
  "line.wallet.fee-agent": "Paid to the agent: {amount}.",
  "line.wallet.fee-advice": "Paid to the adviser: {amount}.",
  "line.wallet.food": "Food: {amount}.",
  "line.wallet.foodstuff": "Foodstuff for the house: {amount}.",
  "line.wallet.goods": "Bought for the home: {amount}.",
  "line.wallet.running": "To run your things: {amount}.",
  "line.wallet.enjoyment": "Enjoyment: {amount}.",
  "line.wallet.bank-charge": "The bank's charge: {amount}.",
  "line.wallet.loan-repay": "Loan repayment: {amount}.",
  "line.wallet.loan-interest": "Interest on the loan: {amount}.",
  "line.wallet.held-funds-return": "The locked money went back: {amount}.",
  "line.wallet.held-funds-interest": "Paid for the use of the money: {amount}.",
  "line.wallet.study": "Spent on study: {amount}.",
  "line.wallet.social": "Spent going out: {amount}.",
  "line.wallet.mishap": "Something went wrong and it cost {amount}.",
  "line.wallet.flight": "Ticket paid: {amount}.",
  "line.wallet.short-count": "You counted it again at home. The FX man was short by {amount}.",

  // Transfers and the bank's queue.
  "line.wallet.converted": "Changed money. {amount} in hand.",
  "line.wallet.convert-paid": "Changed at the bank: {amount}.",
  "line.wallet.moved": "Moved {amount} to {pocket}.",
  "line.wallet.queued": "The bank has your {paid}. Your foreign currency is due {readyMonth}.",
  // wallet:cash-pile-warning: someone who cares, in their own words, with no figure.
  // The passbook's stamps, told as people tell them.
  "line.passbook.stamped": "{amount} held for the road. Mama heard, and so did the whole street.",
  "line.passbook.ready": "{amount} held: everything {route} costs, flight and all. The money is ready.",
  "line.wallet.cash-warning": "Mama called. 'This cash you are carrying about, it is not safe. They are robbing people inside danfo these days. Keep small for transport and put the rest in the bank, you hear?'",
  "line.wallet.flagged": "A deposit of {amount} came from somewhere a visa officer will ask about. It will show for three months.",
  "line.wallet.rent": "Rent paid: {amount}.",
  "line.wallet.rent.label": "Rent",
  "line.wallet.deposit-return": "Your deposit came back: {amount}.",
  "line.wallet.phone": "Phone bill paid: {amount}.",
  "line.wallet.car-payment": "Car payment made: {amount}.",
  "line.wallet.car-deposit": "Car deposit paid: {amount}.",
  "line.wallet.remit": "Sent home: {amount}.",
  "line.wallet.remit-fee": "Transfer fee: {amount}.",
  "line.wallet.cash-work": "Cash in hand from work: {amount}.",
  "line.wallet.tax": "Tax taken: {amount}.",
  "line.wallet.agent-debt": "Paid toward the agent's debt: {amount}.",
  "line.wallet.fare": "Fare paid: {amount}.",
  "line.wallet.fine": "Overstay fine paid: {amount}.",
  "line.wallet.win": "You won {amount}. A letter came with it.",
  "line.wallet.ticket": "Lottery tickets: {amount}.",
  "line.wallet.wedding": "Your share of the wedding: {amount}.",
  "line.wallet.undertaking": "The undertaking you signed took {amount}.",
  "line.wallet.assistance": "Social assistance came in: {amount}.",
  // wallet:top-ups-are-marked: naira bought with real money; it buys anything but a ticket.
  "line.wallet.top-up": "Topped up: {amount}.",
  "line.wallet.remit-app": "You sent {sent} home by app. {naira} reached your naira account.",
  "line.wallet.remit-bank": "You sent {sent} home through the bank. About {naira} reaches your naira account {readyMonth}.",
  "line.wallet.remit-informal": "You handed {sent} to the man who sends money home. {naira} reached your people in cash.",
  "line.wallet.remit-lost": "You handed {sent} to the man who sends money home. It never arrived, and his number is off.",

  // world:month-end-results-sheet: each change of money in the month, said under Kept
  // with both sides as they were, since a change counts for nothing in the kept figure (decision 0024).
  "ui.results.changed-into": "Changed {paid} into {got}",

  // The Bank's savings line before a plan is made: one line, no figure.
  "phone.bank.savings.no-plan": "No plan yet.",
  // A plan made with nothing left to save for that is not the employer's paying.
  "phone.bank.savings.nothing": "Nothing left to save for on this plan.",
};
