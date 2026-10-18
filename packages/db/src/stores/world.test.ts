import { suiteForWorldStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgWorldStore } from "./world";

const fresh = freshHandle();

suiteForWorldStore(async () => {
  const handle = await fresh();
  return pgWorldStore(handle);
});
