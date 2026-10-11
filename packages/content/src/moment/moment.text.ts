// The screenshot moments' words: docs/rules/moments.md. One card for each big outcome: a kicker, a title, one line in
// the game's voice, the figure's caption, and the sign-off. A loss is said straight (text.md R-TEXT-002); a win may
// carry a wink. No word here reads as a bank alert, a receipt, a transfer or a government letter (R-MOMENT-004).
export const momentText: Record<string, string> = {
  // The sign-off in the card's corner, beside the game's small mark (R-MOMENT-002).
  "moment.address": "japacity.app",
  "moment.mark": "Japacity",
  "moment.close": "Close",

  // The visa granted (route.md R-ROUTE-017): the line by the route, the figure the months it took.
  "moment.granted.kicker": "Visa granted",
  "moment.granted.line": "The visa came through. Read it again. It still says yes.",
  "moment.granted.line.route.uk-masters": "The family group heard before you finished reading the email.",
  "moment.granted.line.route.uk-care": "Night shifts in England, and you have never been this happy to see a rota.",
  "moment.granted.line.route.uk-skilled": "The sponsor was real, the job is real, and now the visa is too.",
  "moment.granted.line.route.canada-points": "Canada counted your points and said come.",
  "moment.granted.line.route.uk-talent": "A visa that says you are good at what you do. Somebody at home will frame it.",
  "moment.granted.line.route.gulf-contract": "The visa is through. The company books the seat, you pack the bag.",
  "moment.granted.line.route.uk-partner": "Granted. Your person is counting the days to arrivals.",
  "moment.granted.line.route.ca-spouse": "Granted. Canada believes the two of you, and so does everyone at home.",
  "moment.granted.line.route.uk-dependant": "Granted. You are going together.",
  "moment.granted.line.route.ca-accompany": "Granted. You are going together, and it is Canada.",
  "moment.granted.caption": "months of hustle to get here",
  "moment.granted.caption.one": "month of hustle to get here",

  // The visa refused (route.md R-ROUTE-018, 019): straight, by the first reason the letter gives.
  "moment.refused.kicker": "Visa refused",
  "moment.refused.line.funds": "Your statement showed the money. It did not show where it came from.",
  "moment.refused.line.interview": "Ten minutes at the window decided it. Your answers did not hold together.",
  "moment.refused.line.history": "They remembered the last refusal.",
  "moment.refused.line.credibility": "Nothing was wrong on paper. They did not believe the plan.",
  "moment.refused.line.sponsor": "The sponsor did not hold up when they checked.",
  "moment.refused.line.agent": "The papers the agent sold you did not hold up.",
  "moment.refused.line.endorsement": "No endorsement, no visa.",
  "moment.refused.line.relationship": "They were not sure the two of you are a couple.",
  "moment.refused.line.sham": "They decided the marriage was for papers.",
  "moment.refused.line.lead": "Your partner's visa was refused, and yours went with it.",
  "moment.refused.caption": "months in. Not finished.",
  "moment.refused.caption.one": "month in. Not finished.",
  // The funds reason's figure: the share of the funds they could not trace (R-ROUTE-013).
  "moment.refused.caption.funds": "of your funds they could not trace",
  "moment.refused.again": "Refusal {count} on this route",

  // The agent who was a scam (advice.md R-ADVICE-005, 009): straight, the fee gone.
  "moment.agent.kicker": "The agent is gone",
  "moment.agent.line": "He was a scam. The papers he promised were never coming.",
  "moment.agent.caption": "paid to him, and gone",

  // The one chance on the bus home (activity.md R-ACTIVITY-011): straight.
  "moment.robbed.kicker": "One chance",
  "moment.robbed.title": "The bus home",
  "moment.robbed.line": "The men already inside were not passengers. They took the cash on you and the phone in your hand.",
  "moment.robbed.caption": "in cash, gone before your stop",
  "moment.robbed.caption.phone": "for a new phone",
  "moment.robbed.phone": "New phone {phone}",

  // A big win on the draw (luck.md R-LUCK-008, lottery.md): a jackpot or a mid prize.
  "moment.won.kicker": "Lotto win",
  "moment.won.title.letter": "The Friday draw",
  "moment.won.title.kiosk": "The kiosk",
  "moment.won.line": "Tell nobody. By evening, three cousins have business plans for it.",
  "moment.won.caption": "won on the numbers",
  "moment.won.tickets": "{tickets} tickets for {stake}",
  "moment.won.tickets.one": "1 ticket for {stake}",

  // Landing abroad (route.md R-ROUTE-020): the line by the country, the figure the months from Lagos.
  "moment.landed.kicker": "Landed",
  "moment.landed.line": "Everything costs more than you planned. You are here anyway.",
  "moment.landed.line.country.uk": "The cold met you on the airbridge. Nobody at home warned you properly.",
  "moment.landed.line.country.canada": "Everyone warned you about the winter. Nobody warned you enough.",
  "moment.landed.line.country.uae": "Hotter than Lagos, and the light has not blinked once.",
  "moment.landed.caption": "months from Lagos to here",
  "moment.landed.caption.one": "month from Lagos to here",

  // A chapter closing (chapter.md): its own closing line, the figure japacity at home and the months after the flight.
  "moment.chapter.kicker": "Chapter done",
  "moment.chapter.caption.japacity": "Japacity, how ready you are to go",
  "moment.chapter.caption": "months played",
  "moment.chapter.caption.one": "month played",
};
