import { suiteForDedicationStore } from "../contract";
import { memoryDedicationStore } from ".";

suiteForDedicationStore(() => Promise.resolve({ dedication: memoryDedicationStore(), account: () => Promise.resolve() }));
