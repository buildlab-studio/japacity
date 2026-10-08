// The officer's clips: one per spoken line, keyed by the line's words
// key. `clip` is the path under the client's public/voice/ without its extension, since each
// clip ships as Opus and as MP3 (docs/design/06-audio.md, section 7). `ms` is how long it plays,
// so the answers show when it never ends. A recording by a person replaces a clip by its path.
// Generated voices: one for every officer, the asset register says which.

export interface VoiceClip {
  clip: string;
  ms: number;
}

export const setpieceVoice: Record<string, VoiceClip> = {
  "setpiece.credibility-interview.q.why-uk": { clip: "officer/q-why-uk", ms: 3200 },
  "setpiece.credibility-interview.q.who-pays": { clip: "officer/q-who-pays", ms: 1813 },
  "setpiece.credibility-interview.q.after": { clip: "officer/q-after", ms: 1749 },
  "setpiece.credibility-interview.q.course": { clip: "officer/q-course", ms: 1664 },
  "setpiece.credibility-interview.q.deposit": { clip: "officer/q-deposit", ms: 3285 },
  "setpiece.credibility-interview.q.living": { clip: "officer/q-living", ms: 2411 },
  "setpiece.credibility-interview.q.sponsor-who": { clip: "officer/q-sponsor-who", ms: 2219 },
  "setpiece.credibility-interview.q.agent-said": { clip: "officer/q-agent-said", ms: 2069 },
  "setpiece.credibility-interview.q.gift-uncle": { clip: "officer/q-gift-uncle", ms: 2944 },
  "setpiece.credibility-interview.officer.greet": { clip: "officer/greet", ms: 3093 },
  "setpiece.credibility-interview.officer.react-1": { clip: "officer/react-1", ms: 1173 },
  "setpiece.credibility-interview.officer.react-2": { clip: "officer/react-2", ms: 917 },
  "setpiece.credibility-interview.officer.react-3": { clip: "officer/react-3", ms: 1216 },
  "setpiece.credibility-interview.officer.react-4": { clip: "officer/react-4", ms: 1216 },
  "setpiece.credibility-interview.officer.close": { clip: "officer/close", ms: 2731 },
};

/** The reactions, one drawn at random after each answer, never from what it scored (R-SETPIECE-005). */
export const OFFICER_REACTIONS: readonly string[] = [
  "setpiece.credibility-interview.officer.react-1",
  "setpiece.credibility-interview.officer.react-2",
  "setpiece.credibility-interview.officer.react-3",
  "setpiece.credibility-interview.officer.react-4",
];
