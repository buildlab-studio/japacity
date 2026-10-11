// Titles, bodies and signs are from docs/rules/offer.md. The page's outer double
// quotes mark the body and are not part of the words; single quotes inside are
// speech and stay. Names and choice labels are first drafts.
import { offerHealthText } from "./offer.health.text";
import { offerHomeText } from "./offer.home.text";
import { offerParcelText } from "./offer.parcel.text";
import { offerStreetText } from "./offer.street.text";

export const offerText: Record<string, string> = {
  // Family requests

  "offer.nepa-bill.name": "NEPA has brought the bill",
  "offer.nepa-bill.title": "NEPA has brought the bill",
  "offer.nepa-bill.body":
    "Mama: 'They are threatening to cut the light. {cost}. Your father says he will handle it.' He will not.",
  "offer.nepa-bill.choice.pay": "Pay the bill",
  "offer.nepa-bill.choice.leave": "Leave it to your father",
  "offer.nepa-bill.said.pay": "You paid the NEPA bill. The light stayed on, and your mother told the street who paid.",
  "offer.nepa-bill.said.leave": "You left the NEPA bill to your father. They cut the light, and the house knew why.",

  "offer.brother-fees.name": "Your brother's school fees",
  "offer.brother-fees.title": "Your brother's school fees",
  "offer.brother-fees.body": "Your brother: 'Resumption is Monday. {cost}. They sent me home once already this year.'",
  "offer.brother-fees.choice.pay": "Pay all of it",
  "offer.brother-fees.choice.half": "Pay half",
  "offer.brother-fees.choice.no": "Say you cannot",
  "offer.brother-fees.said.pay": "You paid your brother's fees in full. He went back on Monday, and the family heard.",
  "offer.brother-fees.said.half": "You paid half of your brother's fees. The school let him back while the rest is found.",
  "offer.brother-fees.said.no": "You told your brother you could not pay. He stayed home from school, and the family took note.",

  "offer.mum-shop.name": "Mama's shop",
  "offer.mum-shop.title": "Mama's shop",
  "offer.mum-shop.body":
    "Mama: 'The supplier has stopped giving me credit. {cost} would restock the provisions before the month ends.'",
  "offer.mum-shop.choice.give": "Give all of it",
  "offer.mum-shop.choice.half": "Give half",
  "offer.mum-shop.choice.no": "Say you cannot",
  "offer.mum-shop.said.give": "You restocked your mother's shop. The shelves were full again by the month's end.",
  "offer.mum-shop.said.half": "You gave your mother half of what the shop needed. Some of the shelves were filled.",
  "offer.mum-shop.said.no": "You told your mother you could not help with the shop. The shelves stayed bare.",

  "offer.aso-ebi.name": "Aso ebi for the wedding",
  "offer.aso-ebi.title": "Aso ebi for the wedding",
  "offer.aso-ebi.body": "Your aunty: 'Your cousin is getting married o. The cloth is {cost}, and everybody is buying.'",
  "offer.aso-ebi.choice.buy": "Buy the cloth",
  "offer.aso-ebi.choice.plain": "Go in your own clothes",
  "offer.aso-ebi.choice.absent": "Stay away",
  "offer.aso-ebi.said.buy": "You bought the cloth and danced at your cousin's wedding. You came home with new numbers in your phone.",
  "offer.aso-ebi.said.plain": "You went to the wedding in your own clothes. People noticed, and you still met a few of them.",
  "offer.aso-ebi.said.absent": "You stayed away from your cousin's wedding. Your aunty told everyone.",

  "offer.roof.name": "The roof",
  "offer.roof.title": "The roof",
  "offer.roof.body": "Your father: 'Rain entered the roof of the house in {hometown}. The carpenter wants {cost} for zinc and labour.'",
  "offer.roof.choice.pay": "Pay all of it",
  "offer.roof.choice.half": "Pay half",
  "offer.roof.choice.no": "Say you cannot",
  "offer.roof.said.pay": "You paid for the roof. The parlour stayed dry, and your mother said so to everyone who came.",
  "offer.roof.said.half": "You paid half for the roof. The carpenter patched the worst of it.",
  "offer.roof.said.no": "You told your mother you could not pay for the roof. The rain came into the parlour again.",

  "offer.harvest.name": "Harvest pledge",
  "offer.harvest.title": "Harvest pledge",
  "offer.harvest.body": "Your uncle, from {hometown}: 'They are calling families by name at the harvest. {cost} would cover ours.'",
  "offer.harvest.choice.give": "Give it",
  "offer.harvest.choice.no": "Let them call the name",
  "offer.harvest.said.give": "You gave to the harvest. The family's name was called, and your mother stood up.",
  "offer.harvest.said.no": "The family's name was called at the harvest with nothing beside it.",

  "offer.uncle-burial.name": "Your uncle's burial",
  "offer.uncle-burial.title": "Your uncle's burial",
  "offer.uncle-burial.body": "Your father: 'The family in {hometown} is contributing for the burial. Your share is {cost}. People will remember who gave.'",
  "offer.uncle-burial.choice.send": "Send your share",
  "offer.uncle-burial.choice.token": "Send something small",
  "offer.uncle-burial.choice.nothing": "Send nothing",
  "offer.uncle-burial.said.send": "You sent your share for the burial. Your name was read with the others who gave.",
  "offer.uncle-burial.said.token": "You sent something small for the burial. Your name was read near the end.",
  "offer.uncle-burial.said.nothing": "You sent nothing for the burial. The family noticed.",

  // Life

  "offer.send-off-party.name": "Terna's send-off",
  "offer.send-off-party.title": "Terna's send-off",
  "offer.send-off-party.body":
    "'I leave for Leeds on Sunday. Small chops at my sister's place, Saturday. Come o, you never know who you will meet.'",
  "offer.send-off-party.choice.go": "Go",
  "offer.send-off-party.choice.message": "Send him a message",
  "offer.send-off-party.said.go": "You went to the send-off. Small chops, loud music, and a few people who know the way out.",

  // chapter.md R-CHAPTER-008. `.said.<choice>` is what the results say once the choice is taken, or lapsed into.
  "offer.family-send-off.name": "Your send-off at home",
  "offer.family-send-off.title": "Your send-off at home",
  "offer.family-send-off.body":
    "Your mother, the evening the email comes: 'So you are really going. We cannot just let you go like that. Rice, small chops, a canopy in the yard, everybody. {cost} will do it. Or come and eat with us, just the family.'",
  "offer.family-send-off.choice.party": "Throw the party",
  "offer.family-send-off.choice.dinner": "Just dinner at home",
  "offer.family-send-off.choice.skip": "No time for it",
  "offer.family-send-off.said.party":
    "The yard is full: your aunties, the neighbours from across the road, Pastor, two old classmates. They pray over your journey and dance you out.",
  "offer.family-send-off.said.dinner": "Just the family round the table. Your mother makes your favourite stew. Nobody talks about the visa.",
  "offer.family-send-off.said.skip": "No send-off. You are packing. Your mother says she understands.",

  "offer.laptop-fault.name": "The laptop",
  "offer.laptop-fault.title": "The laptop",
  "offer.laptop-fault.body":
    "The screen flickers, then nothing. The repairer at Computer Village says ₦85,000 and three days.",
  "offer.laptop-fault.choice.repair": "Pay for the repair",
  "offer.laptop-fault.choice.manage": "Manage without it",
  "offer.laptop-fault.said.manage": "You managed without the laptop. The work went slower on borrowed screens, and it wore on you.",

  "offer.fuel-scarcity.name": "Fuel scarcity",
  "offer.fuel-scarcity.title": "Fuel scarcity",
  "offer.fuel-scarcity.body": "Queues at every station. The fare to work and back has doubled this month.",
  "offer.fuel-scarcity.choice.pay": "Pay the extra fares",
  "offer.fuel-scarcity.choice.trek": "Trek",
  "offer.fuel-scarcity.said.trek": "You trekked to work and back while the fuel was scarce. It wore you down.",

  "offer.recruiter-message.name": "A message from a recruiter",
  "offer.recruiter-message.title": "A message from a recruiter",
  "offer.recruiter-message.body":
    "'Saw your work. We have a take-home task, no promises.' It would eat your weekends this month.",
  "offer.recruiter-message.choice.do-it": "Do the task",
  "offer.recruiter-message.choice.ignore": "Ignore it",
  "offer.recruiter-message.said.do-it":
    "You did the recruiter's take-home task over your weekends. No job came of it, but the task went into your portfolio and they kept your name.",

  // Money

  "offer.salary-loan.name": "Salary loan",
  "offer.salary-loan.title": "Salary loan",
  "offer.salary-loan.body":
    "Your bank: 'You qualify for a salary advance. 2% a month, twelve months, deducted at source.'",
  "offer.salary-loan.choice.take": "Take the loan",
  "offer.salary-loan.choice.no": "No, thank you",

  "offer.quick-loan.name": "QuickNaira",
  "offer.quick-loan.title": "QuickNaira",
  "offer.quick-loan.body":
    "'Need cash now? Approved in 5 minutes. No collateral.' The small print says 20% a month and access to your contacts.",
  "offer.quick-loan.choice.take": "Take the loan",
  "offer.quick-loan.choice.ignore": "Ignore it",

  "offer.held-funds.name": "Olokun Microfinance: proof of funds",
  "offer.held-funds.title": "Olokun Microfinance: proof of funds",
  "offer.held-funds.body":
    "'We place the funds in your account for as long as you need. 5% a month, 1% arrangement fee. The money is yours to show, not to spend.'",
  "offer.held-funds.choice.take": "Take the funds",
  "offer.held-funds.choice.no": "No, thank you",

  "offer.held-funds-agent.name": "Mr Kunle can arrange it",
  "offer.held-funds-agent.title": "Mr Kunle can arrange it",
  "offer.held-funds-agent.body":
    "A friend of a friend. 'Proof of funds? I do it every week. 3% monthly, cheaper than any bank. Just bring the first payment.'",
  "offer.held-funds-agent.choice.take": "Pay him and take the funds",
  "offer.held-funds-agent.choice.walk-away": "Walk away",

  "offer.group-loan.name": "The women's group loan",
  "offer.group-loan.title": "A loan from the group",
  "offer.group-loan.body":
    "The group's leader: 'We lend for a side business, nine months at 15%. We keep 15% as fees and hold 10% as savings until you finish. Every member stands behind every loan.'",
  "offer.group-loan.choice.take": "Join and borrow",
  "offer.group-loan.choice.no": "Not now",

  "offer.parents-group-debt.name": "The group at the door",
  "offer.parents-group-debt.title": "The group at the door",
  "offer.parents-group-debt.body":
    "Three women from your mother's group are sitting in the parlour. 'Her shop loan went bad months ago. We want ₦120,000 today.'",
  "offer.parents-group-debt.choice.pay": "Pay them",
  "offer.parents-group-debt.choice.no": "Say there is nothing",
  "offer.parents-group-debt.said.no": "You told your mother's group there was nothing. They left, and people talked.",

  "offer.stand-guarantor.name": "Stand guarantor",
  "offer.stand-guarantor.title": "Will you stand for me?",
  "offer.stand-guarantor.body":
    "Your cousin: 'I need a guarantor for my group loan. {balance} is still to pay. Just your name on the paper.' If he cannot pay, the group comes to you.",
  "offer.stand-guarantor.choice.accept": "Stand for him",
  "offer.stand-guarantor.choice.refuse": "Say no",
  "offer.stand-guarantor.said.accept": "You signed as your cousin's guarantor. If he cannot pay, the group comes to you.",
  "offer.stand-guarantor.said.refuse": "You said no to standing for your cousin. He found someone else, and he remembers.",

  "offer.join-ajo.name": "The savings circle",
  "offer.join-ajo.title": "Join the savings circle (ajo)",
  "offer.join-ajo.body":
    "Your neighbour: 'I run a savings circle. ₦20,000 a month for ten months, and each month one of us collects the whole pot. Miss a month and you are out.'",
  "offer.join-ajo.choice.join": "Join the circle",
  "offer.join-ajo.choice.no": "Not this time",
  "offer.held-funds-agent.sign.cash-only": "He only takes cash.",
  "offer.held-funds-agent.sign.office": "He has an office, with his name on the door.",
  "offer.held-funds-agent.sign.receipt": "He gives a stamped receipt.",
  "offer.held-funds-agent.sign.my-guy": "He keeps saying 'my guy at the bank will sort it'.",
  "offer.held-funds-agent.sign.friend": "Someone you know used him last year and it worked.",

  "offer.land-buyer.name": "A buyer for the land",
  "offer.land-buyer.title": "A buyer for the land",
  "offer.land-buyer.body":
    "'I will pay {price} for the plot, cash, this week. After that I look elsewhere.' Your father will hear about it either way.",
  "offer.land-buyer.choice.sell": "Sell the plot",
  "offer.land-buyer.choice.hold": "Keep it",
  "offer.land-buyer.said.sell": "You sold the plot for cash. Your father heard about it before the week was out.",

  "offer.family-pledge.name": "The family's pledge",
  "offer.family-pledge.title": "The family meeting",
  "offer.family-pledge.body":
    "Your father, after a long silence: 'We will stand behind you. I will sign that {show} in my account is for your studies. And your mother and I will give you {gift}. Do not forget this house.'",
  "offer.family-pledge.choice.accept": "Accept, with thanks",
  "offer.family-pledge.choice.decline": "Tell them to keep it",
  "offer.family-pledge.said.accept": "You took your parents' help, with thanks. Their account now stands behind your file.",
  "offer.family-pledge.said.decline": "You told your parents to keep their money. Your father said nothing more about it.",

  "offer.family-pledge-small.name": "The family's small pledge",
  "offer.family-pledge-small.title": "The family meeting",
  "offer.family-pledge-small.body":
    "Your mother speaks for them: 'It is not much. {show} in the account can carry your name, and take {gift}. Things are tight, you know how it is.'",
  "offer.family-pledge-small.choice.accept": "Accept, with thanks",
  "offer.family-pledge-small.choice.decline": "Tell them to keep it",
  "offer.family-pledge-small.said.accept": "You took what your parents could give, with thanks. Their account now stands behind your file.",
  "offer.family-pledge-small.said.decline": "You told your mother to keep it. She did not argue.",

  "offer.job.name": "A job offer",
  "offer.job.title": "A job offer",
  "offer.job.body": "'We would like you to start on the first.'",
  "offer.job.choice.accept": "Accept",
  "offer.job.choice.decline": "Decline",

  // Report lines. Each carries `offer`, the entry id, so the interface can show its title.
  "line.offer.opened": "Something new needs an answer: {offer}.",
  "line.offer.taken": "Answered: {offer}.",
  "line.offer.lapsed": "{offer}: you let it pass. The time to answer is gone.",
  "line.offer.replaced": "The earlier one is off the table. A newer one took its place.",
  "line.offer.closed": "{offer}: someone else in the family has seen to it.",
  // Sponsors: route-gates.md. Sign words are the page's. Bodies are first drafts.

  "offer.sponsor-care-home.name": "A care home will sponsor you",
  "offer.sponsor-care-home.title": "A care home will sponsor you",
  "offer.sponsor-care-home.body":
    "A care home in the Midlands answers your message. Senior carer, {salary} a year, nights and weekends. 'We can issue the certificate this month.'",
  "offer.sponsor-care-home.choice.take": "Take the certificate",
  "offer.sponsor-care-home.choice.decline": "Decline",
  "offer.sponsor-care-home.sign.pays-for-cos": "They want you to pay for the certificate.",
  "offer.sponsor-care-home.sign.licensed-register": "The company is on the public register of licensed sponsors.",
  "offer.sponsor-care-home.sign.video-interview": "There was an interview on video with the manager.",
  "offer.sponsor-care-home.sign.whatsapp-only": "Everything happens on WhatsApp.",
  "offer.sponsor-care-home.sign.start-date": "They gave a start date and a rota.",

  "offer.sponsor-trust.name": "A hospital trust offers a nursing post",
  "offer.sponsor-trust.title": "A hospital trust offers a nursing post",
  "offer.sponsor-trust.body":
    "A hospital trust's recruiter writes after your online interview: 'Staff nurse, {salary} a year, sponsorship included.'",
  "offer.sponsor-trust.choice.take": "Accept the post",
  "offer.sponsor-trust.choice.decline": "Decline",

  "offer.sponsor-tech-firm.name": "A tech firm will sponsor you",
  "offer.sponsor-tech-firm.title": "A tech firm will sponsor you",
  "offer.sponsor-tech-firm.body":
    "A software company in Manchester writes: 'We liked your take-home task. {salary} a year, and we will sponsor the visa.'",
  "offer.sponsor-tech-firm.choice.take": "Take the offer",
  "offer.sponsor-tech-firm.choice.decline": "Decline",
  "offer.sponsor-tech-firm.sign.pays-for-cos": "They want you to pay for the certificate.",
  "offer.sponsor-tech-firm.sign.licensed-register": "The company is on the public register of licensed sponsors.",
  "offer.sponsor-tech-firm.sign.video-interview": "There was an interview on video with the manager.",
  "offer.sponsor-tech-firm.sign.whatsapp-only": "Everything happens on WhatsApp.",
  "offer.sponsor-tech-firm.sign.start-date": "They gave a start date and a rota.",

  "offer.sponsor-agency.name": "An agency has a role for you",
  "offer.sponsor-agency.title": "An agency has a role for you",
  "offer.sponsor-agency.body":
    "A recruitment agency messages you first. 'Client in London, {salary} a year, visa sorted, start in six weeks. Many people are waiting for this slot.'",
  "offer.sponsor-agency.choice.take": "Take the role",
  "offer.sponsor-agency.choice.decline": "Decline",
  "offer.sponsor-agency.sign.pays-for-cos": "They want you to pay for the certificate.",
  "offer.sponsor-agency.sign.licensed-register": "The company is on the public register of licensed sponsors.",
  "offer.sponsor-agency.sign.video-interview": "There was an interview on video with the manager.",
  "offer.sponsor-agency.sign.whatsapp-only": "Everything happens on WhatsApp.",
  "offer.sponsor-agency.sign.start-date": "They gave a start date and a rota.",

  // The Gulf agent: route-gates.md. The pitch is the page's.

  "offer.gulf-agent.name": "An agent for Dubai",
  "offer.gulf-agent.title": "An agent for Dubai",
  "offer.gulf-agent.body":
    "'Dubai. Security or cleaning, accommodation included, {salary} a month. Visa and ticket are sorted. Bring {fee} and your passport.'",
  "offer.gulf-agent.choice.take": "Pay him and give him your passport",
  "offer.gulf-agent.choice.take.shut": "He needs your passport, and you do not hold one yet. Get it first.",
  "offer.gulf-agent.choice.walk-away": "Walk away",
  "offer.gulf-agent.sign.office": "He has an office, with his name on the door.",
  "offer.gulf-agent.sign.receipt": "He gives a stamped receipt.",
  "offer.gulf-agent.sign.contract-paper": "He shows you a printed contract with the employer's name.",
  "offer.gulf-agent.sign.pay-today": "He says the slot goes if you do not pay today.",
  "offer.gulf-agent.sign.friend": "Someone you know went through him and is working there now.",

  // The road: road.md. The pitch never says desert, sea, road or danger. Sign words are the page's.

  "offer.road-radio.name": "An advert on the radio",
  "offer.road-radio.title": "An advert on the radio",
  "offer.road-radio.body":
    "'Europe, three weeks. No visa wahala, no embassy queue. Our people will receive you.' A deposit of {deposit} holds a place.",
  "offer.road-radio.choice.take": "Pay the deposit",
  "offer.road-radio.choice.ignore": "Change the station",
  "offer.road-radio.sign.too-cheap": "It costs less than the visa fee alone.",
  "offer.road-radio.sign.no-paper": "Nobody has mentioned a visa, a form or an office.",
  "offer.road-radio.sign.agency-warning": "A radio spot from the anti-trafficking agency ran straight after the advert.",

  "offer.road-park.name": "A man at the park",
  "offer.road-park.title": "A man at the park",
  "offer.road-park.body":
    "'I help people like you. Europe, three weeks. I have carried many people. {deposit} and you are on the next one.'",
  "offer.road-park.choice.take": "Pay the deposit",
  "offer.road-park.choice.ignore": "Walk on",
  "offer.road-park.sign.too-cheap": "It costs less than the visa fee alone.",
  "offer.road-park.sign.no-paper": "Nobody has mentioned a visa, a form or an office.",
  "offer.road-park.sign.cash-today": "He wants the deposit today, in cash.",
  "offer.road-park.sign.returnee-said": "Someone who came back is at the park. He is not saying much.",

  "offer.road-cousin.name": "Your cousin's friend",
  "offer.road-cousin.title": "Your cousin's friend",
  "offer.road-cousin.body":
    "Your cousin calls. 'His people can take you to Europe. Three weeks. He only needs {deposit} to start.'",
  "offer.road-cousin.choice.take": "Pay the deposit",
  "offer.road-cousin.choice.ignore": "Tell your cousin no",
  "offer.road-cousin.sign.cousin-vouches": "Your cousin says his friend did it last year.",
  "offer.road-cousin.sign.no-paper": "Nobody has mentioned a visa, a form or an office.",

  "offer.road-ransom-call.name": "A call to your family",
  "offer.road-ransom-call.title": "A call to your family",
  "offer.road-ransom-call.body":
    "They hand you a phone and tell you to call home. The man wants {sum} before anyone moves.",
  "offer.road-ransom-call.choice.pay": "Ask the family to find it",
  "offer.road-ransom-call.choice.cannot": "Say there is no money",
  "offer.road-ransom-call.said.pay": "The family found the money. It took what they had put by, and everyone at home knows.",
  "offer.road-ransom-call.said.cannot": "You said there was no money. They added the sum to what you owe the agent, and they did not go easy on you.",

  "offer.road-exit.name": "The migration agency",
  "offer.road-exit.title": "There is a way back",
  "offer.road-exit.body":
    "The migration agency flies people home from here. The anti-trafficking agency meets them when they land. You can ask at any time.",
  "offer.road-exit.choice.ask": "Ask them to take you home",
  // health.md
  ...offerHealthText,
  ...offerStreetText,
  ...offerHomeText,
  ...offerParcelText,

  // Luck: luck.md. First drafts, rewritten for voice.
  "offer.whip-round.name": "A whip-round",
  "offer.whip-round.title": "A whip-round",
  "offer.whip-round.body":
    "Your old classmates heard how things are. Nobody says the word, but there is an envelope, and a list of names who put something in it.",
  "offer.whip-round.choice.accept": "Take it, and thank them",
  "offer.whip-round.choice.decline": "Thank them, and give it back",
  "offer.whip-round.said.decline": "You thanked your classmates and gave the envelope back. They spoke well of you after.",

  // Named as what it is, a message, so the results never read it as a prize won.
  "offer.telco-promo.name": "A message says you have won",
  "offer.telco-promo.title": "A message says you have won",
  "offer.telco-promo.body": "'CONGRATULATIONS! Your line has won in our anniversary promo. Send N2,000 to claim your prize today.'",
  "offer.telco-promo.sign.shortcode": "It came from the network's own short code.",
  "offer.telco-promo.sign.reply-now": "It says you must reply within the hour.",
  "offer.telco-promo.sign.strange-number": "It came from an ordinary phone number.",
  "offer.telco-promo.choice.claim": "Send the fee and claim it",
  "offer.telco-promo.choice.ignore": "Delete it",

  "offer.relative-sends.name": "Your aunty abroad",
  "offer.relative-sends.title": "Your aunty abroad",
  "offer.relative-sends.body": "Your aunty in Houston heard you are trying to travel. 'Small thing for the process. Don't tell your uncle.' $500, in your dollar account.",
  // The gift's risk is said before it is taken, and what happened after each answer.
  "offer.relative-sends.choice.thank": "Take it as it comes: it lands now, flagged for three months",
  "offer.relative-sends.choice.note": "Ask her to send it through the bank, with a note",
  "offer.relative-sends.said.thank":
    "You call to thank her. The $500 lands with nothing to say where it came from, and a visa officer will ask. Ask her for a note saying it was a gift, or let it sit three months before you apply.",
  "offer.relative-sends.said.note": "She sends it through her bank, with a note: a gift from her, for your travel. The $500 lands, and anyone who asks can see where it came from.",

  "offer.december-bonus.name": "A thirteenth month",
  "offer.december-bonus.title": "A thirteenth month",
  "offer.december-bonus.body": "The end of year letter has good news for once: a thirteenth month's pay, {pay}, with the December salary.",
  "offer.december-bonus.choice.take": "Take it",

  "offer.scholarship-round.name": "A scholarship round",
  "offer.scholarship-round.title": "A scholarship round",
  "offer.scholarship-round.body": "The school writes: 'A late scholarship round, and your file was picked.' £3,000 off what you need to show.",
  "offer.scholarship-round.choice.accept": "Accept the scholarship",

  // people.md (R-PEOPLE-038, R-PEOPLE-050).
  "offer.people-recovery.name": "Sunday rice",
  "offer.people-recovery.title": "Sunday rice",
  "offer.people-recovery.body": "Your cousin says come for Sunday rice. 'You don't have to talk about it.'",
  "offer.people-recovery.choice.go": "Go",
  "offer.people-recovery.choice.alone": "Stay in alone",
  "offer.people-recovery.said.go": "You went for Sunday rice at your cousin's. Nobody asked, and you stayed till evening.",
  "offer.people-recovery.said.alone": "You stayed in alone and slept most of the day.",
  "offer.papers-marriage.name": "A wedding for papers",
  "offer.papers-marriage.title": "A wedding for papers",
  "offer.papers-marriage.body": "A woman at the salon: 'He is a citizen over there. A wedding, papers, and you go your way after. {fee}, half now.'",
  "offer.papers-marriage.choice.take": "Pay and marry him",
  "offer.papers-marriage.choice.walk-away": "Walk away",
  "offer.papers-marriage.sign.cash-only": "Cash only. No bank, no receipt.",
  "offer.papers-marriage.sign.no-meeting": "You will not meet him before the day.",
  "offer.papers-marriage.sign.friend": "Your friend's cousin went this way. She is in London now.",
};
