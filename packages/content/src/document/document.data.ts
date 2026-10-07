// From docs/rules/document.md, "Entries".
import type { DocumentEntry, Id } from "@japacity/sim";

export const documentTable:Record<Id<"document">, DocumentEntry> = {
  "document.passport": { id: "document.passport", wait: [1, 3], validMonths: 60, result: null },
  "document.transcript": { id: "document.transcript", wait: [1, 4], validMonths: null, result: null },
  "document.english-test": { id: "document.english-test", wait: [1, 1], validMonths: 24, result: "english-band" },
  "document.tb-certificate": { id: "document.tb-certificate", wait: [0, 0], validMonths: 6, result: null },
  // Granted by the route when the deposit is paid (R-ROUTE-008), never requested.
  "document.cas": { id: "document.cas", wait: [0, 0], validMonths: null, result: null },
};
