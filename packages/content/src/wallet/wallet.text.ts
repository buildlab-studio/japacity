// First drafts of the wallet's report lines. Each line carries `amount` and
// `currency`; the interface formats the money. Keys follow docs/rules/text.md.
export const walletText: Record<string, string> = {
  // Money in.
  "line.wallet.opening": "You start with {amount}.",
  "line.wallet.salary": "Salary paid: {amount}.",
  "line.wallet.gig": "Paid for side work: {amount}.",
  "line.wallet.gift": "A gift lands: {amount}.",
  "line.wallet.sale": "Sold. {amount} comes in.",
  "line.wallet.loan": "The loan is paid out: {amount}.",
  "line.wallet.held-funds": "{amount} sits in your account, locked. It counts when funds are shown. You cannot spend it.",
  "line.wallet.refund": "Refund received: {amount}.",

  // Money out.
  "line.wallet.upkeep": "Rent, food and transport: {amount}.",
  "line.wallet.family": "Sent to family: {amount}.",
  "line.wallet.fee-document": "Paid at the office: {amount}.",
  "line.wallet.fee-test": "Test fee paid: {amount}.",
  "line.wallet.fee-school": "Paid to the school: {amount}.",
  "line.wallet.fee-visa": "Visa fee paid: {amount}.",
  "line.wallet.fee-surcharge": "Health surcharge paid: {amount}.",
  "line.wallet.fee-agent": "Paid to the agent: {amount}.",
  "line.wallet.bank-charge": "The bank takes its charge: {amount}.",
  "line.wallet.loan-repay": "Loan repayment: {amount}.",
  "line.wallet.loan-interest": "Interest on the loan: {amount}.",
  "line.wallet.held-funds-return": "The locked money goes back: {amount}.",
  "line.wallet.held-funds-interest": "Paid for the use of the money: {amount}.",
  "line.wallet.study": "Spent on study: {amount}.",
  "line.wallet.social": "Spent going out: {amount}.",
  "line.wallet.mishap": "Something went wrong and it cost {amount}.",
  "line.wallet.flight": "Ticket paid: {amount}.",
  "line.wallet.short-count": "You count it again at home. The aboki was short by {amount}.",

  // Transfers and the bank's queue.
  "line.wallet.converted": "Changed money. {amount} in hand.",
  "line.wallet.moved": "Moved {amount} to {pocket}.",
  "line.wallet.queued": "The bank has your {paid}. Your foreign currency comes in month {readyMonth}.",
  "line.wallet.flagged": "A deposit of {amount} came from somewhere a visa officer will ask about. It will show for three months.",
};
