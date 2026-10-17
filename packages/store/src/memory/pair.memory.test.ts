// The pair side's in-memory stores, held to the contract every store keeps.
import { suiteForConversationStore, suiteForInviteStore, suiteForModerationStore } from "../contract";
import { memoryConversationStore, memoryInviteStore, memoryModerationStore } from ".";

suiteForInviteStore(() => Promise.resolve(memoryInviteStore()));
suiteForConversationStore(() => Promise.resolve(memoryConversationStore()));
suiteForModerationStore(() => Promise.resolve(memoryModerationStore()));
