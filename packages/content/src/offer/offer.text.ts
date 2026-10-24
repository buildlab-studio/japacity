// Titles, bodies and signs are from docs/rules/offer.md. The page's outer double
// quotes mark the body and are not part of the words; single quotes inside are
// speech and stay.
import { offerHealthText } from "./offer.health.text";
import { offerHomeText } from "./offer.home.text";
import { offerParcelText } from "./offer.parcel.text";
import { offerStreetText } from "./offer.street.text";

export const offerText: Record<string, string> = {
  // Family requests

  // The family's light bill at home, wherever the character is: abroad the same ask comes (abroad-money:family-asks-more-abroad), and "the bill"
  // alone would read as London's.
  "offer.nepa-bill.name": "NEPA has brought the bill at home",
  "offer.nepa-bill.title": "NEPA bill again",
  "offer.nepa-bill.body":
    "“They want {cost} or they cut the light, and your father says he will handle it o.”",
  "offer.nepa-bill.choice.pay": "Pay the bill",
  "offer.nepa-bill.choice.leave": "Leave it to your father",
  "offer.nepa-bill.said.pay": "You paid the NEPA bill at home. The light stayed on, and your mother told the street who paid.",
  "offer.nepa-bill.said.leave": "You left the NEPA bill at home to your father. They cut the light, and the house knew why.",

  "offer.brother-fees.name": "Your brother's school fees",
  "offer.brother-fees.title": "School fees, abeg",
  "offer.brother-fees.body": "“Resumption is Monday and they want {cost}; they sent me home once already this year.”",
  "offer.brother-fees.choice.pay": "Pay all of it",
  "offer.brother-fees.choice.half": "Pay half",
  "offer.brother-fees.choice.no": "Say you cannot",
  "offer.brother-fees.said.pay": "You paid your brother's fees in full. He went back on Monday, and the family heard.",
  "offer.brother-fees.said.half": "You paid half of your brother's fees. The school let him back while the rest is found.",
  "offer.brother-fees.said.no": "You told your brother you could not pay. He stayed home from school, and the family took note.",

  "offer.mum-shop.name": "Mama's shop",
  "offer.mum-shop.title": "Help my shop",
  "offer.mum-shop.body":
    "“The supplier has stopped my credit, and {cost} would restock the provisions before the month ends.”",
  "offer.mum-shop.choice.give": "Give all of it",
  "offer.mum-shop.choice.half": "Give half",
  "offer.mum-shop.choice.no": "Say you cannot",
  "offer.mum-shop.said.give": "You restocked your mother's shop. The shelves were full again by the month's end.",
  "offer.mum-shop.said.half": "You gave your mother half of what the shop needed. Some of the shelves were filled.",
  "offer.mum-shop.said.no": "You told your mother you could not help with the shop. The shelves stayed bare.",

  "offer.aso-ebi.name": "Aso ebi for the wedding",
  "offer.aso-ebi.title": "Aso ebi o",
  "offer.aso-ebi.body": "“Your cousin is getting married o, the cloth is {cost}, and everybody is buying.”",
  "offer.aso-ebi.choice.buy": "Buy the cloth",
  "offer.aso-ebi.choice.plain": "Go in your own clothes",
  "offer.aso-ebi.choice.absent": "Stay away",
  "offer.aso-ebi.said.buy": "You bought the cloth and danced at your cousin's wedding. You came home with new numbers in your phone.",
  "offer.aso-ebi.said.plain": "You went to the wedding in your own clothes. People noticed, and you still met a few of them.",
  "offer.aso-ebi.said.absent": "You stayed away from your cousin's wedding. Your aunty told everyone.",

  "offer.roof.name": "The roof",
  "offer.roof.title": "The roof leaks",
  "offer.roof.body": "“Rain entered the roof of the house in {hometown}, and the carpenter wants {cost} for zinc and labour.”",
  "offer.roof.choice.pay": "Pay all of it",
  "offer.roof.choice.half": "Pay half",
  "offer.roof.choice.no": "Say you cannot",
  "offer.roof.said.pay": "You paid for the roof. The house back home stayed dry, and your father told everyone who paid.",
  "offer.roof.said.half": "You paid half for the roof. The carpenter patched the worst of it.",
  "offer.roof.said.no": "You told your father you could not pay for the roof. The rain came into the house back home again.",

  "offer.harvest.name": "Harvest pledge",
  "offer.harvest.title": "For the harvest",
  "offer.harvest.body": "“They are calling families by name at the harvest in {hometown}, and {cost} would cover ours.”",
  "offer.harvest.choice.give": "Give it",
  "offer.harvest.choice.no": "Let them call the name",
  "offer.harvest.said.give": "You gave to the harvest. The family's name was called, and your uncle stood up for all of you.",
  "offer.harvest.said.no": "The family's name was called at the harvest with nothing beside it.",

  "offer.uncle-burial.name": "Your uncle's burial",
  "offer.uncle-burial.title": "For the burial",
  "offer.uncle-burial.body": "“The family in {hometown} is contributing for the burial, your share is {cost}, and people will remember who gave.”",
  "offer.uncle-burial.choice.send": "Send your share",
  "offer.uncle-burial.choice.token": "Send something small",
  "offer.uncle-burial.choice.nothing": "Send nothing",
  "offer.uncle-burial.said.send": "You sent your share for the burial. Your name was read with the others who gave.",
  "offer.uncle-burial.said.token": "You sent something small for the burial. Your name was read near the end.",
  "offer.uncle-burial.said.nothing": "You sent nothing for the burial. The family noticed.",

  // Life

  "offer.send-off-party.name": "Terna's send-off",
  "offer.send-off-party.title": "My send-off party",
  "offer.send-off-party.body":
    "“I leave for Leeds on Sunday, small chops at my sister's place on Saturday, so come o, you never know who you will meet.”",
  "offer.send-off-party.choice.go": "Go",
  "offer.send-off-party.choice.message": "Send him a message",
  "offer.send-off-party.said.go": "You went to the send-off. Small chops, loud music, and a few people who know the way out.",

  // chapter:family-marks-the-grant. `.said.<choice>` is what the results say once the choice is taken, or lapsed into.
  "offer.family-send-off.name": "Your send-off at home",
  "offer.family-send-off.title": "You're really going",
  "offer.family-send-off.body":
    "“We cannot just let you go like that: rice, small chops, a canopy in the yard, everybody, and {cost} will do it, or come and eat with us, just the family.”",
  "offer.family-send-off.choice.party": "Throw the party",
  "offer.family-send-off.choice.dinner": "Just dinner at home",
  "offer.family-send-off.choice.skip": "No time for it",
  "offer.family-send-off.said.party":
    "The yard is full: your aunties, the neighbours from across the road, Pastor, two old classmates. They pray over your journey and dance you out.",
  "offer.family-send-off.said.dinner": "Just the family round the table. Your mother makes your favourite stew. Nobody talks about the visa.",
  "offer.family-send-off.said.skip": "No send-off. You are packing. Your mother says she understands.",

  "offer.laptop-fault.name": "The laptop",
  "offer.laptop-fault.title": "Screen don go",
  "offer.laptop-fault.body":
    "“The screen flickers, then nothing, so the repair is ₦85,000.”",
  "offer.laptop-fault.choice.repair": "Pay for the repair",
  "offer.laptop-fault.choice.manage": "Manage without it",
  "offer.laptop-fault.said.manage": "You managed without the laptop. The work went slower on borrowed screens, and it wore on you.",

  "offer.fuel-scarcity.name": "Fuel scarcity",
  "offer.fuel-scarcity.title": "Fuel no dey",
  "offer.fuel-scarcity.body": "“Queue for every station, so the fare to work and back don double this month.”",
  "offer.fuel-scarcity.choice.pay": "Pay the extra fares",
  "offer.fuel-scarcity.choice.trek": "Trek",
  "offer.fuel-scarcity.said.trek": "You trekked to work and back while the fuel was scarce. It wore you down.",

  "offer.recruiter-message.name": "A message from a recruiter",
  "offer.recruiter-message.title": "Saw your work",
  "offer.recruiter-message.body":
    "“We have a take-home task, no promises,” and it would eat your weekends this month.",
  "offer.recruiter-message.choice.do-it": "Do the task",
  "offer.recruiter-message.choice.ignore": "Ignore it",
  "offer.recruiter-message.said.do-it":
    "You did the recruiter's take-home task over your weekends. No job came of it, but the task went into your portfolio and they kept your name.",

  // Money

  "offer.salary-loan.name": "Salary loan",
  "offer.salary-loan.title": "You qualify today",
  "offer.salary-loan.body":
    "“A salary advance at ₦2,000 a month on every ₦100,000, for twelve months, taken from your pay at source.”",
  "offer.salary-loan.choice.take": "Take the loan",
  "offer.salary-loan.choice.no": "No, thank you",

  "offer.quick-loan.name": "QuickNaira",
  "offer.quick-loan.title": "Need cash now?",
  "offer.quick-loan.body":
    "“Approved in 5 minutes, no collateral,” and the small print says ₦20,000 a month on every ₦100,000, and access to your contacts.",
  "offer.quick-loan.choice.take": "Take the loan",
  "offer.quick-loan.choice.ignore": "Ignore it",

  "offer.held-funds.name": "Olokun Microfinance: proof of funds",
  "offer.held-funds.title": "Funds to show",
  "offer.held-funds.body":
    "“We place the funds in your account for as long as you need, to show, not to spend: ₦5,000 a month on every ₦100,000, and ₦1,000 to arrange it.” The small print: the money comes back to them before you fly, and your school fees will still be yours to pay.",
  "offer.held-funds.choice.take": "Take the funds",
  "offer.held-funds.choice.no": "No, thank you",

  "offer.held-funds-agent.name": "Mr Gbenga can arrange it",
  "offer.held-funds-agent.title": "Cheaper than bank",
  "offer.held-funds-agent.body":
    "A friend of a friend: “Proof of funds, I do it every week, ₦3,000 a month on every ₦100,000, cheaper than any bank, just bring the first payment.”",
  "offer.held-funds-agent.choice.take": "Pay him and take the funds",
  "offer.held-funds-agent.choice.walk-away": "Walk away",

  "offer.group-loan.name": "The women's group loan",
  "offer.group-loan.title": "Borrow from us",
  "offer.group-loan.body":
    "“We lend for a side business over nine months, keep a part as fees and a part as savings until you finish, and every member stands behind every loan.”",
  "offer.group-loan.choice.take": "Join and borrow",
  "offer.group-loan.choice.no": "Not now",

  "offer.parents-group-debt.name": "The group at the door",
  "offer.parents-group-debt.title": "Pay us today",
  "offer.parents-group-debt.body":
    "Three women from your mother's group are sitting in the parlour: “Her shop loan went bad months ago, and we want ₦120,000 today.”",
  "offer.parents-group-debt.choice.pay": "Pay them",
  "offer.parents-group-debt.choice.no": "Say there is nothing",
  "offer.parents-group-debt.said.no": "You told your mother's group there was nothing. They left, and people talked.",

  "offer.stand-guarantor.name": "Stand guarantor",
  "offer.stand-guarantor.title": "Stand for me?",
  "offer.stand-guarantor.body":
    "“Just your name on the paper as guarantor for my group loan, {balance} still to pay,” and if he cannot pay, the group comes to you.",
  "offer.stand-guarantor.choice.accept": "Stand for him",
  "offer.stand-guarantor.choice.refuse": "Say no",
  "offer.stand-guarantor.said.accept": "You signed as your cousin's guarantor. If he cannot pay, the group comes to you.",
  "offer.stand-guarantor.said.refuse": "You said no to standing for your cousin. He found someone else, and he remembers.",

  "offer.join-ajo.name": "The savings circle",
  "offer.join-ajo.title": "Join our ajo",
  "offer.join-ajo.body":
    "“I run a savings circle: ₦20,000 a month for ten months, each month one of us collects the whole pot, and miss a month and you are out.”",
  "offer.join-ajo.choice.join": "Join the circle",
  "offer.join-ajo.choice.no": "Not this time",
  "offer.held-funds-agent.sign.cash-only": "He only takes cash.",
  "offer.held-funds-agent.sign.office": "He has an office, with his name on the door.",
  "offer.held-funds-agent.sign.receipt": "He gives a stamped receipt.",
  "offer.held-funds-agent.sign.my-guy": "He keeps saying 'my guy at the bank will sort it'.",
  "offer.held-funds-agent.sign.friend": "Someone you know used him last year and it worked.",

  "offer.land-buyer.name": "A buyer for the land",
  "offer.land-buyer.title": "Your plot, cash",
  "offer.land-buyer.body":
    "“I will pay {price} for the plot, cash, this week, or I look elsewhere,” and your father will hear about it either way.",
  "offer.land-buyer.choice.sell": "Sell the plot",
  "offer.land-buyer.choice.hold": "Keep it",
  "offer.land-buyer.said.sell": "You sold the plot. The deed of sale says where the money came from. Your father heard about it before the week was out.",

  "offer.family-pledge.name": "The family's pledge",
  "offer.family-pledge.title": "We will help",
  "offer.family-pledge.body":
    "“We will stand behind you: I will sign that {show} in my account is for your studies, your mother and I will give you {gift}, and do not forget this house.”",
  "offer.family-pledge.choice.accept": "Accept, with thanks",
  "offer.family-pledge.choice.decline": "Tell them to keep it",
  "offer.family-pledge.said.accept": "You took your parents' help, with thanks. Their account now stands behind your file.",
  "offer.family-pledge.said.decline": "You told your parents to keep their money. Your father said nothing more about it.",

  "offer.family-pledge-small.name": "The family's small pledge",
  "offer.family-pledge-small.title": "It's not much",
  "offer.family-pledge-small.body":
    "“It is not much, {show} in the account can carry your name and take {gift}, because things are tight, you know how it is.”",
  "offer.family-pledge-small.choice.accept": "Accept, with thanks",
  "offer.family-pledge-small.choice.decline": "Tell them to keep it",
  "offer.family-pledge-small.said.accept": "You took what your parents could give, with thanks. Their account now stands behind your file.",
  "offer.family-pledge-small.said.decline": "You told your mother to keep it. She did not argue.",

  "offer.education-loan.name": "A study lender",
  "offer.education-loan.title": "We pay the school",
  "offer.education-loan.body":
    "“We fund master's students from Nigeria and pay your fees straight to the university, up to {max}. About 13.5% a year, a 4.2% fee added to the loan, {fee} to process. Repay over fifteen years, starting after your course.”",
  "offer.education-loan.choice.take": "Take the loan",
  "offer.education-loan.choice.no": "No, thank you",
  "offer.education-loan.said.take": "The lender paid the university. You owe the lender now, from after your course.",
  "offer.education-loan.said.no": "You left the lender's offer. The fees are yours to find.",

  "offer.fee-payment-plan.name": "A payment plan for your fees",
  "offer.fee-payment-plan.title": "Clear it on a plan",
  "offer.fee-payment-plan.body":
    "“You can clear the arrears on a plan: {instalment} a month until the end of the course, and a {fee} fee. Miss a plan payment and we will write to you before we withdraw you.”",
  "offer.fee-payment-plan.choice.agree": "Agree to the plan",
  "offer.fee-payment-plan.choice.no": "Not now",
  "offer.fee-payment-plan.said.agree": "You signed the plan. The fees office spread what you owe to the end of the course.",
  "offer.fee-payment-plan.said.no": "You left the plan. The arrears still stand.",

  "offer.family-gift-canada.name": "The family's gift for Canada",
  "offer.family-gift-canada.title": "Not a loan",
  "offer.family-gift-canada.body":
    "“Canada wants to see the money is yours. We will give you {gift}. Not a loan, a gift. Get the paper from the notary so they believe it.”",
  "offer.family-gift-canada.choice.accept": "Accept, with thanks",
  "offer.family-gift-canada.choice.decline": "Tell him to keep it",
  "offer.family-gift-canada.said.accept": "Papa sent the gift the same week. Canada counts it once the notary's deed is in your file.",
  "offer.family-gift-canada.said.decline": "You told your father to keep it. He said the offer stands no longer.",

  "offer.family-loan.name": "Papa's loan",
  "offer.family-loan.title": "We can lend",
  "offer.family-loan.body":
    "“Your mother and I can find {amount}, nobody is asking for it back this year, but at Christmas, when your uncles ask, you will tell them what it is for.”",
  "offer.family-loan.choice.take": "Take it, with thanks",
  "offer.family-loan.choice.no": "Tell him to keep it",
  "offer.family-loan.said.take": "Papa sent it the same evening. The house has a stake in this move now.",
  "offer.family-loan.said.no": "You told Papa to keep it for the house. He sounded relieved, then ashamed of it.",

  "offer.job.name": "A job offer",
  "offer.job.title": "We want you",
  "offer.job.body": "“We would like you to start on the first.”",
  "offer.job.choice.accept": "Accept",
  "offer.job.choice.decline": "Decline",

  // Report lines. Each carries `offer`, the entry id, so the interface can show its title.
  "line.offer.opened": "Something new needs an answer: {offer}.",
  "line.offer.taken": "Answered: {offer}.",
  "line.offer.lapsed": "{offer}: you let it pass. The time to answer is gone.",
  "line.offer.replaced": "The earlier one is off the table. A newer one took its place.",
  "line.offer.closed": "{offer}: someone else in the family has seen to it.",
  // Sponsors: route-gates.md. Sign words are the page's.

  "offer.sponsor-care-home.name": "A care home will sponsor you",
  "offer.sponsor-care-home.title": "We can sponsor",
  "offer.sponsor-care-home.body":
    "“Senior carer in the Midlands, {salary} a year, nights and weekends, and we can issue the certificate this month.”",
  "offer.sponsor-care-home.choice.take": "Take the certificate",
  "offer.sponsor-care-home.choice.decline": "Decline",
  "offer.sponsor-care-home.sign.pays-for-cos": "They want you to pay for the certificate.",
  "offer.sponsor-care-home.sign.licensed-register": "The company is on the public register of licensed sponsors.",
  "offer.sponsor-care-home.sign.video-interview": "There was an interview on video with the manager.",
  "offer.sponsor-care-home.sign.whatsapp-only": "Everything happens in a chat app.",
  "offer.sponsor-care-home.sign.start-date": "They gave a start date and a rota.",

  "offer.sponsor-trust.name": "A hospital trust offers a nursing post",
  "offer.sponsor-trust.title": "A nursing post",
  "offer.sponsor-trust.body":
    "“Staff nurse, {salary} a year, sponsorship included.”",
  "offer.sponsor-trust.choice.take": "Accept the post",
  "offer.sponsor-trust.choice.decline": "Decline",

  "offer.sponsor-tech-firm.name": "A tech firm will sponsor you",
  "offer.sponsor-tech-firm.title": "We will sponsor",
  "offer.sponsor-tech-firm.body":
    "“We liked your take-home task: {salary} a year in Manchester, and we will sponsor the visa.”",
  "offer.sponsor-tech-firm.choice.take": "Take the offer",
  "offer.sponsor-tech-firm.choice.decline": "Decline",
  "offer.sponsor-tech-firm.sign.pays-for-cos": "They want you to pay for the certificate.",
  "offer.sponsor-tech-firm.sign.licensed-register": "The company is on the public register of licensed sponsors.",
  "offer.sponsor-tech-firm.sign.video-interview": "There was an interview on video with the manager.",
  "offer.sponsor-tech-firm.sign.whatsapp-only": "Everything happens in a chat app.",
  "offer.sponsor-tech-firm.sign.start-date": "They gave a start date and a rota.",

  "offer.sponsor-agency.name": "An agency has a role for you",
  "offer.sponsor-agency.title": "Role in London",
  "offer.sponsor-agency.body":
    "“Client in London, {salary} a year, visa sorted, start in six weeks, and many people are waiting for this role.”",
  "offer.sponsor-agency.choice.take": "Take the role",
  "offer.sponsor-agency.choice.decline": "Decline",
  "offer.sponsor-agency.sign.pays-for-cos": "They want you to pay for the certificate.",
  "offer.sponsor-agency.sign.licensed-register": "The company is on the public register of licensed sponsors.",
  "offer.sponsor-agency.sign.video-interview": "There was an interview on video with the manager.",
  "offer.sponsor-agency.sign.whatsapp-only": "Everything happens in a chat app.",
  "offer.sponsor-agency.sign.start-date": "They gave a start date and a rota.",

  // The Gulf agent: route-gates.md. The pitch is the page's.

  "offer.gulf-agent.name": "An agent for Dubai",
  "offer.gulf-agent.title": "Dubai work, sorted",
  "offer.gulf-agent.body":
    "“Security or cleaning in Dubai, accommodation included, {salary} a month, visa and ticket sorted, so bring {fee} and your passport.”",
  "offer.gulf-agent.choice.take": "Pay him and give him your passport",
  "offer.gulf-agent.choice.take.shut": "He needs your passport, and you do not hold one yet. Get it first.",
  "offer.gulf-agent.choice.walk-away": "Walk away",
  "offer.gulf-agent.sign.office": "He has an office, with his name on the door.",
  "offer.gulf-agent.sign.receipt": "He gives a stamped receipt.",
  "offer.gulf-agent.sign.contract-paper": "He shows you a printed contract with the employer's name.",
  "offer.gulf-agent.sign.pay-today": "He says someone else takes it if you do not pay today.",
  "offer.gulf-agent.sign.friend": "Someone you know went through him and is working there now.",

  // The road: road.md. The pitch never says desert, sea, road or danger. Sign words are the page's.

  "offer.road-radio.name": "An advert on the radio",
  "offer.road-radio.title": "Europe, three weeks",
  "offer.road-radio.body":
    "“Europe in three weeks, no visa wahala, no embassy queue, our people will receive you,” and a deposit of {deposit} holds a place.",
  "offer.road-radio.choice.take": "Pay the deposit",
  "offer.road-radio.choice.ignore": "Change the station",
  "offer.road-radio.sign.too-cheap": "It costs less than the visa fee alone.",
  "offer.road-radio.sign.no-paper": "Nobody has mentioned a visa, a form or an office.",
  "offer.road-radio.sign.agency-warning": "A radio spot from the anti-trafficking agency ran straight after the advert.",

  "offer.road-park.name": "A man at the park",
  "offer.road-park.title": "I carry people",
  "offer.road-park.body":
    "“I help people like you to Europe in three weeks, I have carried many people, and {deposit} puts you on the next one.”",
  "offer.road-park.choice.take": "Pay the deposit",
  "offer.road-park.choice.ignore": "Walk on",
  "offer.road-park.sign.too-cheap": "It costs less than the visa fee alone.",
  "offer.road-park.sign.no-paper": "Nobody has mentioned a visa, a form or an office.",
  "offer.road-park.sign.cash-today": "He wants the deposit today, in cash.",
  "offer.road-park.sign.returnee-said": "Someone who came back is at the park. He is not saying much.",

  "offer.road-cousin.name": "Your cousin's friend",
  "offer.road-cousin.title": "Through his people",
  "offer.road-cousin.body":
    "“His people can take you to Europe in three weeks, and he only needs {deposit} to start.”",
  "offer.road-cousin.choice.take": "Pay the deposit",
  "offer.road-cousin.choice.ignore": "Tell your cousin no",
  "offer.road-cousin.sign.cousin-vouches": "Your cousin says his friend did it last year.",
  "offer.road-cousin.sign.no-paper": "Nobody has mentioned a visa, a form or an office.",

  "offer.road-ransom-call.name": "A call to your family",
  "offer.road-ransom-call.title": "Call your family",
  "offer.road-ransom-call.body":
    "They hand you a phone and tell you to call home, and the man wants {sum} before anyone moves.",
  "offer.road-ransom-call.choice.pay": "Ask the family to find it",
  "offer.road-ransom-call.choice.cannot": "Say there is no money",
  "offer.road-ransom-call.said.pay": "The family found the money. It took what they had put by, and everyone at home knows.",
  "offer.road-ransom-call.said.cannot": "You said there was no money. They added the sum to what you owe the agent, and they did not go easy on you.",

  "offer.road-exit.name": "The migration agency",
  "offer.road-exit.title": "A way back",
  "offer.road-exit.body":
    "“We fly people home from here, the anti-trafficking agency meets them when they land, and you can ask at any time.”",
  "offer.road-exit.choice.ask": "Ask them to take you home",
  // health.md
  ...offerHealthText,
  ...offerStreetText,
  ...offerHomeText,
  ...offerParcelText,

  // Luck: luck.md.
  "offer.whip-round.name": "A whip-round",
  "offer.whip-round.title": "From us all",
  "offer.whip-round.body":
    "Your old classmates heard how things are, and nobody says the word, but there is an envelope and a list of the names who put something in it.",
  "offer.whip-round.choice.accept": "Take it, and thank them",
  "offer.whip-round.choice.decline": "Thank them, and give it back",
  "offer.whip-round.said.decline": "You thanked your classmates and gave the envelope back. They spoke well of you after.",

  // Named as what it is, a message, so the results never read it as a prize won.
  "offer.telco-promo.name": "A message says you have won",
  "offer.telco-promo.title": "You have won",
  "offer.telco-promo.body": "“CONGRATULATIONS! Your line has won in our anniversary promo. Send N2,000 to claim your prize today.”",
  "offer.telco-promo.sign.shortcode": "It came from the network's own short code.",
  "offer.telco-promo.sign.reply-now": "It says you must reply within the hour.",
  "offer.telco-promo.sign.strange-number": "It came from an ordinary phone number.",
  "offer.telco-promo.choice.claim": "Send the fee and claim it",
  "offer.telco-promo.choice.ignore": "Delete it",

  "offer.relative-sends.name": "Your aunty abroad",
  "offer.relative-sends.title": "For the process",
  "offer.relative-sends.body": "“Small thing for the process, don't tell your uncle,” and $500 lands in your dollar account.",
  // The gift's risk is said before it is taken, and what happened after each answer.
  "offer.relative-sends.choice.thank": "Take it as it comes: it lands now, flagged for three months",
  "offer.relative-sends.choice.note": "Ask her to send it through the bank, with a note",
  "offer.relative-sends.said.thank":
    "You call to thank her. The $500 lands with nothing to say where it came from, and a visa officer will ask. Ask her for a note saying it was a gift, or let it sit three months before you apply.",
  "offer.relative-sends.said.note": "She sends it through her bank, with a note: a gift from her, for your travel. The $500 lands, and anyone who asks can see where it came from.",

  "offer.december-bonus.name": "A thirteenth month",
  "offer.december-bonus.title": "Thirteenth month pay",
  "offer.december-bonus.body": "The end of year letter has good news for once: a thirteenth month's pay, {pay}, with the December salary.",
  "offer.december-bonus.choice.take": "Take it",

  "offer.scholarship-round.name": "A scholarship round",
  "offer.scholarship-round.title": "Scholarship for you",
  "offer.scholarship-round.body": "“A late scholarship round picked your file: £3,000 off what you need to show.”",
  "offer.scholarship-round.choice.accept": "Accept the scholarship",

  // person.md (person:one-left-keeps-own-gains, person:papers-marriage-offer).
  "offer.people-recovery.name": "Sunday rice",
  "offer.people-recovery.title": "Come for rice",
  "offer.people-recovery.body": "“Come for Sunday rice, you don't have to talk about it.”",
  "offer.people-recovery.choice.go": "Go",
  "offer.people-recovery.choice.alone": "Stay in alone",
  "offer.people-recovery.said.go": "You went for Sunday rice at your cousin's. Nobody asked, and you stayed till evening.",
  "offer.people-recovery.said.alone": "You stayed in alone and slept most of the day.",
  "offer.papers-marriage.name": "A wedding for papers",
  "offer.papers-marriage.title": "Marry for papers",
  "offer.papers-marriage.body": "“He is a citizen over there: a wedding, papers, and you go your way after, for {fee}, half now.”",
  "offer.papers-marriage.choice.take": "Pay and marry him",
  "offer.papers-marriage.choice.walk-away": "Walk away",
  "offer.papers-marriage.sign.cash-only": "Cash only. No bank, no receipt.",
  "offer.papers-marriage.sign.no-meeting": "You will not meet him before the day.",
  "offer.papers-marriage.sign.friend": "Your friend's cousin went this way. She is in London now.",

  // Who asks each ask, shown in the ask's name pill, so the title and the line are theirs. An ask with none here takes its group's stand-in; the scam text stays an unknown number.
  "offer.brother-fees.who": "Your brother",
  "offer.agent-chaser.who": "Terna",
  "offer.agent-stop.who": "A man at the stop",
  "offer.agent-office.who": "The travel desk",
  "offer.agent-promise.who": "The agent",
  "offer.agent-papers.who": "The agent",
  "offer.aso-ebi.who": "Your aunty",
  "offer.roof.who": "Papa",
  "offer.harvest.who": "Your uncle",
  "offer.uncle-burial.who": "Papa",
  "offer.parents-group-debt.who": "Mama's group",
  "offer.stand-guarantor.who": "Your cousin",
  "offer.village-burial.who": "Papa",
  "offer.send-off-party.who": "Terna",
  "offer.laptop-fault.who": "The repairer",
  "offer.fuel-scarcity.who": "The conductor",
  "offer.recruiter-message.who": "A recruiter",
  "offer.returnee-question.who": "Your aunty",
  "offer.returnee-business.who": "Your cousin",
  "offer.returnee-hire.who": "A recruiter",
  "offer.returnee-leave-again.who": "A friend",
  "offer.street-find-uk.who": "An aunty",
  "offer.street-find-uae.who": "A crewman",
  "offer.street-find-canada.who": "A man at the stop",
  "offer.street-find-italy.who": "A grandmother",
  "offer.illness.who": "The doctor",
  "offer.illness-worse.who": "The doctor",
  "offer.whip-round.who": "Your classmates",
  "offer.relative-sends.who": "Aunty in Houston",
  "offer.december-bonus.who": "Your employer",
  "offer.scholarship-round.who": "The school",
  "offer.people-recovery.who": "Your cousin",
  "offer.bridge-theft.who": "Under the bridge",
  "offer.bridge-mosquitoes.who": "Under the bridge",
  "offer.bridge-night.who": "Under the bridge",
  "offer.where-next.who": "Your host",
  "offer.parcel-shipped.who": "The cargo office",
  "offer.taken-in.who": "Your people",
  "offer.family-send-off.who": "Mama",
  "offer.salary-loan.who": "Your bank",
  "offer.quick-loan.who": "QuickNaira",
  "offer.held-funds.who": "Olokun Microfinance",
  "offer.held-funds-agent.who": "Mr Gbenga",
  "offer.group-loan.who": "The group's leader",
  "offer.join-ajo.who": "Your neighbour",
  "offer.land-buyer.who": "A buyer",
  "offer.family-pledge.who": "Papa",
  "offer.family-pledge-small.who": "Mama",
  "offer.family-loan.who": "Papa",
  "offer.family-gift-canada.who": "Papa",
  "offer.fee-payment-plan.who": "The university's fees office",
  "offer.education-loan.who": "A study lender",
  "offer.sponsor-care-home.who": "A care home",
  "offer.sponsor-trust.who": "A hospital trust",
  "offer.sponsor-tech-firm.who": "A tech firm",
  "offer.sponsor-agency.who": "An agency",
  "offer.gulf-agent.who": "An agent",
  "offer.papers-marriage.who": "A woman at the salon",
  "offer.job.who": "The employer",
  "offer.road-radio.who": "The radio",
  "offer.road-park.who": "A man at the park",
  "offer.road-cousin.who": "Your cousin",
  "offer.road-ransom-call.who": "The man",
  "offer.road-exit.who": "The migration agency",
  "offer.sponsor-licence-lost.who": "Your manager",
  "offer.canada-assistance.who": "The assistance office",
  "offer.court-date.who": "The court",
};
