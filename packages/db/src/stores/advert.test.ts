import { suiteForAdvertStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgAdvertStore } from "./advert";

const fresh = freshHandle();

suiteForAdvertStore(async () => {
  const handle = await fresh();
  return pgAdvertStore(handle);
});
