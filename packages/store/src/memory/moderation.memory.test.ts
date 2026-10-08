// The in-memory moderation records, held to the contract every store keeps.
import { suiteForAppealStore, suiteForBannedIdentityStore, suiteForFeedbackStore, suiteForModerationLogStore } from "../contract";
import { memoryAppealStore, memoryBannedIdentityStore, memoryFeedbackStore, memoryModerationLogStore } from ".";

suiteForModerationLogStore(() => Promise.resolve(memoryModerationLogStore()));
suiteForBannedIdentityStore(() => Promise.resolve(memoryBannedIdentityStore()));
suiteForAppealStore(() => Promise.resolve(memoryAppealStore()));
suiteForFeedbackStore(() => Promise.resolve(memoryFeedbackStore()));
