// Names are from docs/rules/document.md. Report lines carry the document's id
// as `document`; the interface shows its name. `band` is the band times ten,
// formatted by the interface.
export const documentText: Record<string, string> = {
  "document.passport.name": "Passport",
  "document.transcript.name": "Degree transcript",
  "document.english-test.name": "English test result",
  "document.tb-certificate.name": "TB test certificate",
  "document.cas.name": "Confirmation from the university",

  "line.document.requested": "You apply for your {document}. It should be ready in month {month}.",
  "line.document.already-pending": "Your {document} is already being made. It should be ready in month {month}. This request changes nothing.",
  "line.document.issued": "Your {document} is ready.",
  "line.document.issued-band": "Your {document} is out. Band {band}.",
  "line.document.expired": "Your {document} has run out.",
  "line.document.voided": "Your {document} is no longer valid.",
};
