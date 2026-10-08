// The types of pick.js, which stays plain JavaScript so k6 can run it.

export interface LooseCommand {
  type: string;
  [field: string]: unknown;
}

export interface MixEntry {
  kind: string;
  bp: number;
}

export interface Chosen {
  command: LooseCommand;
  wanted: string;
  fallback: boolean;
}

export type Outcome = "accepted" | "stale-expected" | "rate-limited" | "unexpected" | "server-error" | "connection-error";

export declare const STREAM: { kind: number; stale: number; choice: number; offset: number; step: number; warm: number; scenario: number; reads: number };
export declare function mix32(a: number, b: number): number;
export declare function roll(seed: number, index: number, stream: number, size: number): number;
export declare function accountAt(seed: number, index: number, count: number): number;
export declare function kindAt(seed: number, index: number, mix: readonly MixEntry[]): string;
export declare function staleAt(seed: number, index: number, staleShareBp: number): boolean;
export declare function chooseCommand(legal: readonly LooseCommand[], kind: string, choiceRoll: number): Chosen | null;
export declare function commandBody(command: LooseCommand, basedOn: number, stale: boolean): { command: LooseCommand & { basedOn: number }; basedOn: number };
export declare function classify(status: number, body: { ok?: unknown; code?: unknown } | null, stale: boolean): Outcome;
