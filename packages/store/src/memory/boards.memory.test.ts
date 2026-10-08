// The in-memory board store, held to the contract every board store keeps.
import { suiteForBoardStore } from "../contract";
import { memoryBoardStore, memoryPlayerStores } from ".";

suiteForBoardStore(() => Promise.resolve({ boards: memoryBoardStore(), player: memoryPlayerStores().player }));
