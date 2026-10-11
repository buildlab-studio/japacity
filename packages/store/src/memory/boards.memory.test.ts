// The in-memory board store, held to the contract every board store keeps.
import { suiteForBoardStore } from "../contract";
import { memoryAuditStore, memoryBoardStore, memoryPlayerStores, memoryWorldStore } from ".";

suiteForBoardStore(() => Promise.resolve({ boards: memoryBoardStore(), player: memoryPlayerStores({ world: memoryWorldStore(), audit: memoryAuditStore() }).player }));
