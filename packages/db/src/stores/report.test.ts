import { suiteForModerationStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgModerationStore } from "./report";

const fresh = freshHandle();

suiteForModerationStore(async () => {
  const handle = await fresh();
  return pgModerationStore(handle);
});
