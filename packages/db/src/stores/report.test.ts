import { suiteForModerationStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgModerationStore } from "./report";

const fresh = freshHandle();

suiteForModerationStore(async () => {
  const handle = await fresh();
  return pgModerationStore(handle);
});
