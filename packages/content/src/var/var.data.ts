// From docs/rules/rate.md, "Variables".
import type { Id, VarEntry } from "@japacity/sim";

export const varTable: Record<Id<"var">, VarEntry> = {
  "var.fx-supply": { id: "var.fx-supply", start: 97 },
  "var.fx-bank-queue": { id: "var.fx-bank-queue", start: 0 },
  // US cents.
  "var.fx-bank-allowance": { id: "var.fx-bank-allowance", start: 50000 },
  // 2 open, 1 narrowing, 0 closed.
  "var.uk-study-window": { id: "var.uk-study-window", start: 2 },
  // Pence a month.
  "var.uk-living-line": { id: "var.uk-living-line", start: 117100 },
  "var.uk-living-months": { id: "var.uk-living-months", start: 9 },
  // Pence.
  "var.uk-visa-fee": { id: "var.uk-visa-fee", start: 55800 },
  "var.uk-surcharge": { id: "var.uk-surcharge", start: 116400 },
  "var.uk-study-strictness": { id: "var.uk-study-strictness", start: 50 },
};
