import { suiteForDeletionStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgDeletionStore } from "./deletion";

const fresh = freshHandle();

suiteForDeletionStore(async () => {
  const handle = await fresh();
  return pgDeletionStore(handle);
});
