import { suiteForConversationStore } from "@japacity/store/contract";

import { freshHandle } from "../pglite.testing";
import { pgConversationStore } from "./conversation";

const fresh = freshHandle();

suiteForConversationStore(async () => {
  const handle = await fresh();
  return pgConversationStore(handle);
});
