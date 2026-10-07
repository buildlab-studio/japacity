// From docs/rules/document.md, "Entries".
import type { DocumentEntry, Id } from "@japacity/sim";

export const documentTable:Record<Id<"document">, DocumentEntry> = {
  "document.passport": { id: "document.passport", wait: [1, 3], validMonths: 60, result: null },
  "document.transcript": { id: "document.transcript", wait: [1, 4], validMonths: null, result: null },
  "document.english-test": { id: "document.english-test", wait: [1, 1], validMonths: 24, result: "english-band" },
  "document.tb-certificate": { id: "document.tb-certificate", wait: [0, 0], validMonths: 6, result: null },
  // Granted by the route when the deposit is paid (R-ROUTE-008), never requested.
  "document.cas": { id: "document.cas", wait: [0, 0], validMonths: null, result: null },

  // Abroad: car.md, ladders.md and route-gates.md.

  // Held on arrival by anyone who can drive, for 12 months; never requested (R-CAR-006).
  "document.home-licence": { id: "document.home-licence", wait: [0, 0], validMonths: 12, result: null },
  // Granted by a pass in the driving test; never expires.
  "document.uk-licence": { id: "document.uk-licence", wait: [0, 0], validMonths: null, result: null },
  // The nursing register in the UK, after the tests: 3 to 6 months. Never expires in this milestone.
  "document.nmc-pin": { id: "document.nmc-pin", wait: [3, 6], validMonths: null, result: null },
  // The Gulf medical: wait 1 (R-CONTRACT-003).
  // the page gives no validity, so it never expires.
  "document.medical": { id: "document.medical", wait: [1, 1], validMonths: null, result: null },
};
