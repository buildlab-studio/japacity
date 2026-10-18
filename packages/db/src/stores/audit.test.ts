import { suiteForAuditStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgAuditStore } from "./audit";

const fresh = freshHandle();

suiteForAuditStore(async () => {
  const handle = await fresh();
  return pgAuditStore(handle);
});
