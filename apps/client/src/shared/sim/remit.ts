// The remit quote is the wallet kind's own function (R-ABROAD-006 and 008), so
// what the sheet says will arrive is what the engine pays out. The package's
// index exports only the contract, so the function is reached by its path.
export { remitQuote } from "../../../../../packages/sim/src/wallet/wallet.logic";
export type { RemitChannel } from "../../../../../packages/sim/src/wallet/wallet.events";

export const REMIT_CHANNELS = ["app", "bank", "informal"] as const;
