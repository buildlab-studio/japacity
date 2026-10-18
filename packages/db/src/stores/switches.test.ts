import { suiteForSwitchStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgSwitchStore } from "./switches";

const fresh = freshHandle();

suiteForSwitchStore(async () => {
  const handle = await fresh();
  return pgSwitchStore(handle);
});
