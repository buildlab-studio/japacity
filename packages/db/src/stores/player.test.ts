import { suiteForPlayerStore } from "@japacity/store/contract";

import { freshHandle } from "../testing";
import { pgPlayerStores } from "./player";

const fresh = freshHandle();

suiteForPlayerStore(async () => {
  const handle = await fresh();
  return pgPlayerStores(handle).player;
});
