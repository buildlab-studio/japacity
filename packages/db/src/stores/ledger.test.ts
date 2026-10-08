import { suiteForLedgerStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgLedgerStore } from "./ledger";

const fresh = freshHandle();

suiteForLedgerStore(async () => {
  const handle = await fresh();
  return pgLedgerStore(handle);
});
