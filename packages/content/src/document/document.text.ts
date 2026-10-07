// Names are from docs/rules/document.md and route-gates.md. Report lines carry the
// document's id as `document`; the interface shows its name. `band` is the band
// times ten, formatted by the interface.
export const documentText: Record<string, string> = {
  "document.passport.name": "Passport",
  "document.transcript.name": "Degree transcript",
  "document.english-test.name": "English test result",
  "document.tb-certificate.name": "TB test certificate",
  "document.cas.name": "Confirmation from the university",

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

  "line.document.requested": "You apply for your {document}. It should be ready in month {month}.",
  "line.document.already-pending": "Your {document} is already being made. It should be ready in month {month}. This request changes nothing.",
  "line.document.issued": "Your {document} is ready.",
  "line.document.issued-band": "Your {document} is out. Band {band}.",
  "line.document.expired": "Your {document} has run out.",
  "line.document.voided": "Your {document} is no longer valid.",
};
