import { suiteForInviteStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgInviteStore } from "./invite";

const fresh = freshHandle();

suiteForInviteStore(async () => {
  const handle = await fresh();
  return pgInviteStore(handle);
});
