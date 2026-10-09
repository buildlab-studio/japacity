// Names are from docs/rules/document.md and route-gates.md. Report lines carry the
// document's id as `document`; the interface shows its name. `band` is the band
// times ten, formatted by the interface.
export const documentText: Record<string, string> = {
  "document.passport.name": "Passport",
  "document.transcript.name": "Degree transcript",
  "document.english-test.name": "English test result",
  "document.tb-certificate.name": "TB test certificate",
  "document.police-certificate.name": "Police character certificate",
  "document.police-certificate.blurb": "A letter from the police that says you have no record. The routes abroad ask for it. It lasts a year.",
  "document.cas.name": "Confirmation from the university",
  "document.home-licence.name": "Nigerian driving licence",
  "document.uk-licence.name": "UK driving licence",
  "document.nmc-pin.name": "UK nursing registration",

  "document.nursing-licence.name": "Nursing licence",
  "document.nursing-licence.blurb": "Your licence to practise as a nurse at home. It runs out every three years.",
  "document.nmcn-verification.name": "Council verification",
  "document.nmcn-verification.blurb":
    "The nursing council's letter confirming your licence to a board abroad. They only write it after two years of work.",
  "document.eca.name": "Credential assessment",
  "document.eca.blurb": "A report that says what your degree is worth in Canada.",
  "document.endorsement.name": "Talent endorsement",
  "document.endorsement.blurb": "A letter from the endorsing body saying your work leads the field. It lasts three months.",
  "document.medical.name": "Work medical",
  "document.medical.blurb": "The medical the Gulf employer asks for: blood tests, a chest X-ray and a stamp.",
  "document.nurse-certificate.name": "Nursing certificate",
  "document.nurse-certificate.blurb": "The certificate from the clinic's exam. Boards abroad read it beside your licence. It does not run out.",

  "line.document.requested": "Your {document} is on the way. It should be ready {month}.",
  "line.document.already-pending": "Your {document} is already being made. It should be ready {month}. This request changes nothing.",
  "line.document.issued": "Your {document} is ready.",
  "line.document.issued-band": "Your {document} is out. Band {band}.",
  // R-WORLD-008: a band under the one the route needs ({needed}) says so, and what next.
  "line.document.issued-band-short": "Band {band}. The route needs {needed}: study and sit again.",
  "line.document.issued-band-met": "Your {document} is out. Band {band}. That meets the route's {needed}.",
  "line.document.expired": "Your {document} has run out.",
  "line.document.voided": "Your {document} is no longer valid.",

  // The phone's reminders (world.md R-WORLD-019, story/story.notice.data.ts). {month} is the month
  // the paper is due, told as months away (world.md R-WORLD-002).
  "document.english-test.reminder.book": "English test: book it. Take your passport from the box first.",
  "document.english-test.reminder.due": "English test: your result comes {month}.",
  "document.tb-certificate.reminder.book": "TB test: take your passport to the clinic.",
  "document.passport.reminder.due": "Passport: ready to collect {month}.",
  "document.transcript.reminder.due": "Transcript: your school says it is ready {month}.",
  "document.passport.reminder.expired": "Your passport has run out. Renew it before anything else.",
  "document.english-test.reminder.expired": "Your English result has run out. Sit the test again.",
  "document.tb-certificate.reminder.expired": "Your TB certificate has run out. Get another before you apply.",
};
