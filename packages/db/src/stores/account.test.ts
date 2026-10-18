import { suiteForAccountStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgAccountStore } from "./account";

const fresh = freshHandle();

suiteForAccountStore(async () => {
  const handle = await fresh();
  return pgAccountStore(handle);
});
