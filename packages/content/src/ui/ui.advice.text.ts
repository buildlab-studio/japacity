// The agent's sheet's own words (docs/rules/advice.md R-ADVICE-005, 006), in the voice of docs/rules/text.md. The
// agent's line, his tells, his looks and his choices are in advice/advice.text.ts.
export const uiAdviceText: Record<string, string> = {
  "advice.notice": "You notice",
  "advice.looks": "Look before you pay",
  "advice.looks.free": "Free",
  "advice.look.done": "Done",
  "advice.look.nobody": "You know nobody to ask yet.",
  "advice.says": "What he says you need",
  "advice.says.sure": "Only the hub's official page is sure",
  "advice.short": "His fee would take the last of your money.",
  "advice.promise.month": "The card says: {when}",
  "advice.gone": "He has gone.",
  // R-TEXT-008: each tell as a few words beside its icon and the warning mark; the agent's own sentence stays in content.
  "advice.tell.mark": "Warning sign",
  "advice.tell.cash-only.short": "Cash only",
  "advice.tell.guarantee.short": "Visa \"guaranteed\"",
  "advice.tell.no-office.short": "No office",
  "advice.tell.no-licence.short": "No licence number",
  "advice.tell.holds-passport.short": "Keeps your passport",
  "advice.tell.no-passport.short": "\"No passport needed\"",
  "advice.tell.pay-today.short": "\"Pay today\"",
  "advice.tell.price-low.short": "Far below official fees",
};
