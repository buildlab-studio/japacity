// The in-memory advert store, held to the contract every advert store keeps.
import { suiteForAdvertStore } from "../contract";
import { memoryAdvertStore } from ".";

suiteForAdvertStore(() => Promise.resolve(memoryAdvertStore()));
