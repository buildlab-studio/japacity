import { suiteForPushStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgPushStore } from "./push";

const fresh = freshHandle();

suiteForPushStore(async () => {
  const handle = await fresh();
  return pgPushStore(handle);
});
