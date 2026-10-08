// First drafts: the page names the route only as "the UK master's".
export const routeText: Record<string, string> = {
  "route.uk-masters.name": "A master's in the UK",
  "route.uk-masters.blurb": "A one-year taught master's at a UK university, on a student visa.",

  "route.uk-masters.item.degree": "A bachelor's degree",
  "route.uk-masters.item.grade": "Second class lower or better",
  "route.uk-masters.item.passport": "Passport held",
  "route.uk-masters.item.transcript": "Transcript held",
  "route.uk-masters.item.english": "English result at band 6.0 or better",
  "route.uk-masters.item.offer": "An offer from a university",
  "route.uk-masters.item.deposit": "Deposit paid",
  "route.uk-masters.item.funds": "Funds shown cover the funds required",
  "route.uk-masters.item.held": "Funds covered for a month, and now",
  "route.uk-masters.item.tb": "TB certificate held",
  "route.uk-masters.item.applied": "Visa application sent",

  // Report lines. First drafts.
  "line.route.heard": "You hear about {route}. People are talking about it.",
  "line.route.looked-into": "You read the official page for {route}: the full list of what it asks, as it stands. It says nothing about your own chances.",
  "line.route.school-applied": "Your application to {school} is in. The answer is due in month {month}.",
  "line.route.school-offer": "{school} offers you a place. Discount off the tuition: {discount}.",
  "line.route.school-rejected": "{school} turns you down.",
  "line.route.deposit-paid": "Deposit paid to {school}: {amount}. The university sends its confirmation.",
  "line.route.funds-covered": "Funds checked for {route}: {shown} shown against {required} required. Months covered in a row: {months}.",
  "line.route.funds-short": "Funds checked for {route}: {shown} shown against {required} required. Not covered.",
  "line.route.applied": "Visa application sent for {route}. The decision comes in month {month}.",
  "line.route.granted": "The visa for {route} is granted.",
  "line.route.refused": "The visa for {route} is refused. The letter gives the reason as {reason}.",
  "line.route.banned": "Deception on a {route} application: every route into that country is closed to you until month {month}.",
  "line.route.unbanned": "The ban on {route} has ended. The route is open to you again.",
  "line.route.deposit-refunded": "The deposit for {route} comes back, less the fee: {amount}.",
  "line.route.supported": "Your family will show {amount} for you.",
  "line.route.departed": "You fly out on {route}. Home is a phone call away now.",
  // The sponsor and contract gates (route-gates.md). First drafts.
  "line.route.sponsor-recorded": "A sponsor for {route} sends you a certificate of sponsorship.",
  "line.route.sponsor-under-bar":
    "A sponsor for {route} sends you a certificate, but the salary is under the bar. It cannot be used for the visa.",
  "line.route.agent-recorded": "The agent takes your money and your details for {route}. He says the contract will follow.",
  // The points gate (route-gates.md R-POINTS-002, 003, 005). First drafts.
  "line.route.pool-entered": "Your profile for {route} is in the pool. Now you wait for the cut-off to come down to your score.",
  "line.route.invited": "You are invited to apply for {route}. The fee goes with the application.",
  "line.route.invite-unpaid": "You are invited to apply for {route}, but the fee cannot be paid. The invitation holds one more month.",
  "line.route.invite-lapsed": "The invitation for {route} has lapsed. The fee was never paid. Your profile stays in the pool.",
  "line.route.profile-lapsed": "Your profile for {route} has run out without an invitation. You can enter the pool again.",
  // The endorsement gate (R-ENDORSE-002). First draft.
  "line.route.endorsement-refused": "The endorsing body does not back you for {route}. The letter is withdrawn, and you must wait before you ask again.",
  "route.uk-care.name": "Care work in the UK",
  "route.uk-care.blurb":
    "A health and care visa with a sponsor's certificate. For nurses and carers, if the door is open to people applying from home.",
  "route.uk-care.item.licence": "Nursing licence held",
  "route.uk-care.item.verification": "Council verification held",
  "route.uk-care.item.passport": "Passport held",
  "route.uk-care.item.english": "English result at band 4.0 or better",
  "route.uk-care.item.sponsor": "A sponsor's certificate",
  "route.uk-care.item.tb": "TB certificate held",
  "route.uk-care.item.salary": "The sponsor pays at or above the bar",
  "route.uk-care.item.applied": "Visa application sent",

  "route.uk-skilled.name": "Skilled work in the UK",
  "route.uk-skilled.blurb":
    "A skilled worker visa with a sponsor who pays above the salary bar. A degree and two years of work first.",
  "route.uk-skilled.item.degree": "A bachelor's degree",
  "route.uk-skilled.item.passport": "Passport held",
  "route.uk-skilled.item.english": "English result at band 4.0 or better",
  "route.uk-skilled.item.sponsor": "A sponsor's certificate",
  "route.uk-skilled.item.salary": "The sponsor pays at or above the bar",
  "route.uk-skilled.item.funds": "Money to show for the first month",
  "route.uk-skilled.item.tb": "TB certificate held",
  "route.uk-skilled.item.applied": "Visa application sent",

  "route.canada-points.name": "Permanent residence in Canada",
  "route.canada-points.blurb":
    "A points score from your age, degree, English and work. When the cut-off falls to your score, you are invited.",
  "route.canada-points.item.degree": "A bachelor's degree",
  "route.canada-points.item.eca": "Credential assessment held",
  "route.canada-points.item.english": "English result at band 6.0 or better",
  "route.canada-points.item.funds": "Proof of funds covered",
  "route.canada-points.item.pool": "A profile in the pool",
  "route.canada-points.item.invited": "Invited to apply",
  "route.canada-points.item.applied": "Application sent",

  "route.uk-talent.name": "The UK talent visa",
  "route.uk-talent.blurb":
    "For people whose work speaks for them. An endorsing body reads your portfolio first, then the visa.",
  "route.uk-talent.item.tech": "Tech skill at 75 or more",
  "route.uk-talent.item.portfolio": "Three pieces of work to show",
  "route.uk-talent.item.network": "People who will write for you",
  "route.uk-talent.item.passport": "Passport held",
  "route.uk-talent.item.endorsement": "Endorsement held",
  "route.uk-talent.item.tb": "TB certificate held",
  "route.uk-talent.item.applied": "Visa application sent",

  "route.gulf-contract.name": "A contract in the Gulf",
  "route.gulf-contract.blurb":
    "Security or cleaning on a two-year contract, found through an agent. The employer pays the visa and the ticket, and keeps your passport.",
  "route.gulf-contract.item.passport": "Passport held",
  "route.gulf-contract.item.medical": "Work medical held",
  "route.gulf-contract.item.agent": "An agent with a contract",
  "route.gulf-contract.item.applied": "Papers sent to the employer",

  // The road is never named to the player (road.md). This name is for the ledger and the end card only.
  "route.road.name": "The road",
  "route.road.blurb": "A way north that the man at the park does not describe.",

  // The chain's report lines (R-ROAD-003 to 010). Plain, and they never say how. First drafts.
  "line.route.road-fraud": "The man who took your deposit has stopped answering. Nobody at the park has seen him.",
  "line.route.road-go": "You get on the bus before light. Nobody at home knows yet.",
  "line.route.road-turned-back": "You go home before the bus leaves. The deposit stays with the man.",
  "line.route.road-desert": "The trucks go north across the sand. The water is counted.",
  "line.route.road-compound": "You are taken to a compound with a locked gate and told to wait. Nobody says for how long.",
  "line.route.road-coast": "You reach the coast. There are more people waiting than there is room.",
  "line.route.road-sea": "There is a boat tonight. It is too small for the people on it.",
  "line.route.road-held": "Another month in the same place. They take a phone and call your family for money.",
  "line.route.road-turned": "Soldiers stop the truck and send everyone back. The migration agency offers a flight home.",
  "line.route.road-exit": "You ask the migration agency to take you home. They do.",
  "line.route.road-lost": "Your family stops hearing from you. Nobody can tell them what happened.",
  "line.route.road-arrived": "You reach the other shore alive. You have no papers, a debt, and only cash work.",

  // The way out, shown on every card of the chain (R-ROAD-007). No phone numbers: they change.
  "road.exit.title": "You can stop",
  "road.exit.body":
    "The anti-trafficking agency takes calls about this, and the migration agency flies people home from the coast for free. Saying you want to go home is enough.",

  // The real-story card (R-ROAD-011). Credits only: nothing from the journalism is reproduced.
  "road.real-story.title": "This happened to real people",
  "road.real-story.line":
    "The road in this game follows reporting on the journey north through the desert and across the sea. Read their work.",
  // credited by outlet, work and year. The reporters' names are left to the maintainer (AGENTS.md: no real person in content).
  "road.real-story.credit.1": "Foundation for Investigative Journalism, an undercover journey north, 2026",
  "road.real-story.credit.2": "The Sun, an undercover Sahara trek, 2009",
  "road.real-story.credit.3": "CNN, migrants auctioned in Libya, 2017",
  "road.real-story.credit.4": "BBC Panorama, the debt behind the journey, 2017",

  // docs/rules/people.md: the partner and dependant routes, their apply activities and the withdrawal. First drafts.
  "route.uk-partner.name": "Joining your partner in the UK",
  "route.uk-partner.blurb": "A partner visa, for the husband, wife or long partner of someone settled or British. They must earn above the floor.",
  "route.uk-partner.item.married": "Married, or two years together",
  "route.uk-partner.item.sponsor": "Your partner is settled or British, in the UK",
  "route.uk-partner.item.floor": "Your partner earns above the floor",
  "route.uk-partner.item.english": "English result at band 3.0 or better",
  "route.uk-partner.item.passport": "Passport held",
  "route.uk-partner.item.tb": "TB certificate held",
  "route.uk-partner.item.applied": "Visa application sent",
  "route.ca-spouse.name": "Sponsored by your spouse in Canada",
  "route.ca-spouse.blurb": "Permanent residence through a spouse who lives in Canada as a resident or a citizen. They sign a promise to the government for three years.",
  "route.ca-spouse.item.married": "Married",
  "route.ca-spouse.item.sponsor": "Your spouse is a resident or a citizen, in Canada",
  "route.ca-spouse.item.passport": "Passport held",
  "route.ca-spouse.item.applied": "Application sent",
  "route.uk-dependant.name": "Going to the UK with your partner",
  "route.uk-dependant.blurb": "A dependant's visa, on your partner's work or talent visa. It lasts as long as theirs.",
  "route.uk-dependant.item.joint": "A joint application with your partner leading",
  "route.uk-dependant.item.lead": "Your partner's visa is in progress or granted",
  "route.uk-dependant.item.passport": "Passport held",
  "route.uk-dependant.item.tb": "TB certificate held",
  "route.uk-dependant.item.funds": "Money to show for your first month",
  "route.uk-dependant.item.applied": "Visa application sent",
  "route.ca-accompany.name": "Going to Canada with your spouse",
  "route.ca-accompany.blurb": "Permanent residence alongside your spouse's points application.",
  "route.ca-accompany.item.joint": "A joint application with your spouse leading",
  "route.ca-accompany.item.lead": "Your spouse's application is in progress or granted",
  "route.ca-accompany.item.applied": "Application sent",
  "activity.apply-uk-partner.name": "Apply for the partner visa",
  "activity.apply-uk-partner.blurb": "You send the marriage papers, your partner's payslips, the fee and three years of surcharge.",
  "activity.apply-ca-spouse.name": "Apply as a sponsored spouse",
  "activity.apply-ca-spouse.blurb": "You send the forms, the photos of the two of you and the fees.",
  "activity.apply-uk-dependant.name": "Apply as your partner's dependant",
  "activity.apply-uk-dependant.blurb": "You send your papers with your partner's, and the same fee and surcharge they paid.",
  "activity.apply-ca-accompany.name": "Apply alongside your spouse",
  "activity.apply-ca-accompany.blurb": "You go on your spouse's application with your own papers and fee.",
  "line.route.withdrawn": "Your application for {route} is withdrawn. The fee is not returned.",

  // The visa appointment and its reminders (world.md R-WORLD-019, story/story.notice.data.ts).
  // {month} is the decision month.
  "route.uk-masters.reminder.appointment": "Visa appointment: take the file from under the bed, then go.",
  "route.uk-masters.reminder.interview": "Your interview is now. The officer is waiting.",
  "route.uk-masters.reminder.decision": "Visa decision expected in month {month}.",
};
