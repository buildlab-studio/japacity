import { suiteForPairStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgPlayerStores } from "./player";

const fresh = freshHandle();

suiteForPairStore(async () => {
  const handle = await fresh();
  return pgPlayerStores(handle);
});
