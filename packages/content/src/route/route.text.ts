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
  "line.route.looked-into": "You look into {route}. Now you know what it takes.",
  "line.route.school-applied": "Your application to {school} is in. The answer is due in month {month}.",
  "line.route.school-offer": "{school} offers you a place. Discount off the tuition: {discount}.",
  "line.route.school-rejected": "{school} turns you down.",
  "line.route.deposit-paid": "Deposit paid to {school}: {amount}. The university sends its confirmation.",
  "line.route.funds-covered": "Funds checked for {route}: {shown} shown against {required} required. Months covered in a row: {months}.",
  "line.route.funds-short": "Funds checked for {route}: {shown} shown against {required} required. Not covered.",
  "line.route.applied": "Visa application sent for {route}. The decision comes in month {month}.",
  "line.route.granted": "The visa for {route} is granted.",
  "line.route.refused": "The visa for {route} is refused. The letter gives the reason as {reason}.",
  "line.route.deposit-refunded": "The deposit for {route} comes back, less the fee: {amount}.",
  "line.route.supported": "Your family will show {amount} for you.",
  "line.route.departed": "You fly out on {route}. The life at home is over.",
  // The sponsor and contract gates (route-gates.md). First drafts.
  "line.route.sponsor-recorded": "A sponsor for {route} sends you a certificate of sponsorship.",
  "line.route.sponsor-under-bar":
    "A sponsor for {route} sends you a certificate, but the salary is under the bar. It cannot be used for the visa.",
  "line.route.agent-recorded": "The agent takes your money and your details for {route}. He says the contract will follow.",
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

  // The way out, shown on every card of the chain (R-ROAD-007). No phone numbers: they change.
  "road.exit.title": "You can stop",
  "road.exit.body":
    "The anti-trafficking agency takes calls about this, and the migration agency flies people home from the coast for free. Saying you want to go home is enough.",

  // The real-story card (R-ROAD-011). Credits only: nothing from the journalism is reproduced.
  "road.real-story.title": "This happened to real people",
  "road.real-story.line":
    "The road in this game follows reporting on the journey north through the desert and across the sea. Read their work.",
  // credited by outlet, work and year. The reporters' names are left to the maintainer (AGENTS.md: no real person in content).
  "road.real-story.credit.1": "Foundation for Investigative Journalism, an undercover journey from Kano through Niger to Tripoli, 2026",
  "road.real-story.credit.2": "The Sun, an undercover Sahara trek, 2009",
  "road.real-story.credit.3": "CNN, migrants auctioned in Libya, 2017",
  "road.real-story.credit.4": "BBC Panorama, the debt behind the journey, 2017",
};
