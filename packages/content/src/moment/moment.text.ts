// The screenshot moments' words: docs/rules/moment.md. One card for each big outcome: a kicker, a title, one line in
// the game's voice, the figure's caption, and the sign-off. A loss is said straight (text:bad-news-never-joked); a win may
// carry a wink. No word here reads as a bank alert, a receipt, a transfer or a government letter (moment:card-never-looks-official).
export const momentText: Record<string, string> = {
  // The sign-off in the card's corner, beside the game's small mark (moment:moment-card-contents).
  "moment.address": "japacity.app",
  "moment.mark": "Japacity",
  "moment.close": "Close",

  // The visa granted (route:grant-moves-to-granted): the line by the route, the figure the months it took.
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

  // The visa refused (route:refusal-refunds-and-resets, route:refusal-reasons-recorded): straight, by the first reason the letter gives.
  "moment.refused.kicker": "Visa refused",
  // The endorsing body said no before any visa was asked for (route-gates:endorsement-decided-by-draw): its own kicker.
  "moment.refused.kicker.endorsement": "Endorsement refused",
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
  // The funds reason's figure: the share of the funds they could not trace (route:unexplained-share-of-funds).
  "moment.refused.caption.funds": "of your funds they could not trace",
  "moment.refused.again": "Refusal {count} on this route",

  // The agent who was a scam (advice:agent-kind-drawn-on-offer, advice:bad-news-told-straight): straight, the fee gone.
  "moment.agent.kicker": "The agent is gone",
  "moment.agent.line": "He was a scam. The papers he promised were never coming.",
  "moment.agent.caption": "paid to him, and gone",

  // The deposit a road pitch took for nothing (road:taking-pitch-pays-deposit, the fraud): straight, as the agent's,
  // the pitch's own name in the title, the line by the pitch, the deposit gone as the figure.
  "moment.deposit.kicker": "The deposit is gone",
  "moment.deposit.line": "Three weeks to Europe, he said. His number is switched off now.",
  "moment.deposit.line.offer.road-cousin": "Your cousin swears he did not know. His friend's number is switched off.",
  "moment.deposit.line.offer.road-park": "He is not at the park any more. Nobody there will say his name.",
  "moment.deposit.line.offer.road-radio": "The advert still plays on the radio. The number in it rings out.",
  "moment.deposit.caption": "paid to hold a place, and gone",

  // The one chance on the bus home (activity:one-chance-bus-robbery): straight.
  "moment.robbed.kicker": "One chance",
  "moment.robbed.title": "The bus home",
  "moment.robbed.line": "The men already inside were not passengers. They took the cash on you and the phone in your hand.",
  "moment.robbed.caption": "in cash, gone before your stop",
  "moment.robbed.caption.phone": "for a new phone",
  "moment.robbed.phone": "New phone {phone}",

  // A big win on the draw (luck:big-wins-are-staged, lottery.md): a jackpot or a mid prize.
  "moment.won.kicker": "Lotto win",
  "moment.won.title.letter": "The Friday draw",
  "moment.won.title.kiosk": "The kiosk",
  "moment.won.line": "Tell nobody. By evening, three cousins have business plans for it.",
  "moment.won.caption": "won on the numbers",
  "moment.won.tickets": "{tickets} tickets for {stake}",
  "moment.won.tickets.one": "1 ticket for {stake}",

  // Landing abroad (route:departure-pays-flight): the line by the country, the figure the months from Lagos.
  "moment.landed.kicker": "Landed",
  "moment.landed.line": "Everything costs more than you planned. You are here anyway.",
  "moment.landed.line.country.uk": "The cold met you on the airbridge. Nobody at home warned you properly.",
  "moment.landed.line.country.canada": "Everyone warned you about the winter. Nobody warned you enough.",
  "moment.landed.line.country.uae": "Hotter than Lagos, and the light has not blinked once.",
  "moment.landed.caption": "months from Lagos to here",
  "moment.landed.caption.one": "month from Lagos to here",

  // A chapter closing (chapter.md): its own closing line, the figure japacity at home and the months after the flight.
  "moment.chapter.kicker": "Brief done",
  "moment.chapter.caption.japacity": "Japacity, how ready you are to go",
  "moment.chapter.caption": "months played",
  "moment.chapter.caption.one": "month played",

  // A stamp in the passbook: a milestone held for the road, and the road's own figure.
  "moment.held.kicker": "Held for the road",
  "moment.held.kicker.ready": "Money ready",
  "moment.held.title": "Mama heard",
  "moment.held.line": "By evening the whole street knows you are saving for something.",
  "moment.held.line.ready": "Fees, flight and all, in one place. Now it only has to stay there.",
  "moment.held.caption": "held for the road",
  "moment.held.caption.ready": "everything the road costs, held",
};
