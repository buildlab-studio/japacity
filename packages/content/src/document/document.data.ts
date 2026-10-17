// From docs/rules/document.md "Entries", and route-gates.md for the documents the gates need.
import type { DocumentEntry, Id } from "@japacity/sim";

export const documentTable: Record<Id<"document">, DocumentEntry> = {
  "document.passport": { id: "document.passport", wait: [1, 3], validMonths: 60, result: null },
  "document.transcript": { id: "document.transcript", wait: [1, 4], validMonths: null, result: null },
  "document.english-test": { id: "document.english-test", wait: [1, 1], validMonths: 24, result: "english-band" },
  "document.tb-certificate": { id: "document.tb-certificate", wait: [0, 0], validMonths: 6, result: null },
  // R-DOCUMENT-007: the police character certificate, for the routes that take one.
  "document.police-certificate": { id: "document.police-certificate", wait: [1, 3], validMonths: 12, result: null },
  // Granted by the route when the deposit is paid (R-ROUTE-008), never requested.
  "document.cas": { id: "document.cas", wait: [0, 0], validMonths: null, result: null },

  // Abroad: car.md, ladders.md and route-gates.md.

  // Held on arrival by anyone who can drive, for 12 months; never requested (R-CAR-006).
  "document.home-licence": { id: "document.home-licence", wait: [0, 0], validMonths: 12, result: null },
  // Granted by a pass in the driving test; never expires.
  "document.uk-licence": { id: "document.uk-licence", wait: [0, 0], validMonths: null, result: null },
  // The nursing register in the UK, after the tests: 3 to 6 months. Never expires.
  "document.nmc-pin": { id: "document.nmc-pin", wait: [3, 6], validMonths: null, result: null },
  // route-gates.md, "New qualities, documents and starting life".

  // A starting life or the prologue's graduation holds it.
  // A renewal is issued at once, as the page gives no wait.
  "document.nursing-licence": { id: "document.nursing-licence", wait: [0, 0], validMonths: 36, result: null },
  // Requested only after 24 months in a nursing job (R-SPONSOR-005).
  "document.nmcn-verification": { id: "document.nmcn-verification", wait: [6, 12], validMonths: 24, result: null },
  // The credential assessment for the points route.
  "document.eca": { id: "document.eca", wait: [2, 4], validMonths: 60, result: null },
  // The endorsement for the talent route (R-ENDORSE-001 to 003).
  "document.endorsement": { id: "document.endorsement", wait: [1, 2], validMonths: 3, result: null },
  // The medical for the contract route (R-CONTRACT-003).
  // Valid 3 months, as a Gulf work medical is; the page gives no validity.
  "document.medical": { id: "document.medical", wait: [1, 1], validMonths: 3, result: null },
  // The nurse's certification (activity.md R-ACTIVITY-013): asked for by a pass at the clinic's quiz, two months, for good.
  "document.nurse-certificate": { id: "document.nurse-certificate", wait: [2, 2], validMonths: null, result: null },
};
