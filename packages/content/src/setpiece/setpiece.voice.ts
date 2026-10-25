// The officer's clips: one per spoken line in each of the officer's two voices, keyed by the
// line's words key. `clip` is the path under the client's public/voice/ without its extension, since
// each clip ships as Opus and as MP3 (docs/design/05-audio.md, section 7). `ms` is how long it plays,
// the longer of its two files, so the answers show when it never ends. The client draws which voice
// holds an interview (world:officer-voice-drawn-per-interview). A recording by a person replaces a
// clip by its path. Generated voices: the asset register says which.

/** The officer's two voices: `m` a man's, `f` a woman's. Neither is ever said in words. */
export type OfficerVoice = "m" | "f";

export const OFFICER_VOICES: readonly OfficerVoice[] = ["m", "f"];

export interface VoiceClip {
  clip: string;
  ms: number;
}

export const setpieceVoice: Record<string, Record<OfficerVoice, VoiceClip>> = {
  "setpiece.credibility-interview.q.why-uk": { m: { clip: "officer/m/q-why-uk", ms: 3213 }, f: { clip: "officer/f/q-why-uk", ms: 3318 } },
  "setpiece.credibility-interview.q.who-pays": { m: { clip: "officer/m/q-who-pays", ms: 1802 }, f: { clip: "officer/f/q-who-pays", ms: 1881 } },
  "setpiece.credibility-interview.q.after": { m: { clip: "officer/m/q-after", ms: 2038 }, f: { clip: "officer/f/q-after", ms: 2090 } },
  "setpiece.credibility-interview.q.course": { m: { clip: "officer/m/q-course", ms: 1750 }, f: { clip: "officer/f/q-course", ms: 1802 } },
  "setpiece.credibility-interview.q.deposit": { m: { clip: "officer/m/q-deposit", ms: 3422 }, f: { clip: "officer/f/q-deposit", ms: 3396 } },
  "setpiece.credibility-interview.q.papers": { m: { clip: "officer/m/q-papers", ms: 4859 }, f: { clip: "officer/f/q-papers", ms: 4937 } },
  "setpiece.credibility-interview.q.living": { m: { clip: "officer/m/q-living", ms: 2847 }, f: { clip: "officer/f/q-living", ms: 2612 } },
  "setpiece.credibility-interview.q.sponsor-who": { m: { clip: "officer/m/q-sponsor-who", ms: 2429 }, f: { clip: "officer/f/q-sponsor-who", ms: 2403 } },
  "setpiece.credibility-interview.q.course-about": { m: { clip: "officer/m/q-course-about", ms: 2926 }, f: { clip: "officer/f/q-course-about", ms: 2717 } },
  "setpiece.credibility-interview.q.gift-uncle": { m: { clip: "officer/m/q-gift-uncle", ms: 3318 }, f: { clip: "officer/f/q-gift-uncle", ms: 3422 } },
  "setpiece.credibility-interview.officer.greet": { m: { clip: "officer/m/greet", ms: 3474 }, f: { clip: "officer/f/greet", ms: 3631 } },
  "setpiece.credibility-interview.officer.react-1": { m: { clip: "officer/m/react-1", ms: 784 }, f: { clip: "officer/f/react-1", ms: 836 } },
  "setpiece.credibility-interview.officer.react-2": { m: { clip: "officer/m/react-2", ms: 731 }, f: { clip: "officer/f/react-2", ms: 836 } },
  "setpiece.credibility-interview.officer.react-3": { m: { clip: "officer/m/react-3", ms: 862 }, f: { clip: "officer/f/react-3", ms: 914 } },
  "setpiece.credibility-interview.officer.react-4": { m: { clip: "officer/m/react-4", ms: 836 }, f: { clip: "officer/f/react-4", ms: 914 } },
  "setpiece.credibility-interview.officer.close": { m: { clip: "officer/m/close", ms: 3161 }, f: { clip: "officer/f/close", ms: 3239 } },
};

/** The reactions, one drawn at random after each answer, never from what it scored (route:view-shows-progress-not-score). */
export const OFFICER_REACTIONS: readonly string[] = [
  "setpiece.credibility-interview.officer.react-1",
  "setpiece.credibility-interview.officer.react-2",
  "setpiece.credibility-interview.officer.react-3",
  "setpiece.credibility-interview.officer.react-4",
];
