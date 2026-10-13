// pnpm --filter @japacity/teaser sound
// Makes the teaser's sounds from code, so they are the makers' own: a rhythm bed, the danfo's horn and engine, a crowd,
// the pops of a bubble and a sticker, the swish of a card, the coins of the passbook, a stamp, a chime, the night's
// crickets and generator, the jet, the light switch and the swell. Each is written as a 16 bit WAV under public/sound
// at 44100 Hz, mono; ffmpeg then packs the long ones as AAC so the repository stays small.
import { execFileSync } from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RATE = 44100;
const OUT = join(import.meta.dirname, "..", "public", "sound");

type Wave = Float32Array;

function seconds(s: number): Wave {
  return new Float32Array(Math.round(s * RATE));
}

/** A deterministic noise, so a render is the same every time. */
function noise(length: number, seed = 7): Wave {
  const out = new Float32Array(length);
  let x = seed;
  for (let i = 0; i < length; i += 1) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    out[i] = (x / 0x7fffffff) * 2 - 1;
  }
  return out;
}

/** One pole low pass, `cut` in Hz. */
function lowpass(wave: Wave, cut: number): Wave {
  const out = new Float32Array(wave.length);
  const a = 1 - Math.exp((-2 * Math.PI * cut) / RATE);
  let y = 0;
  for (let i = 0; i < wave.length; i += 1) {
    y += a * ((wave[i] ?? 0) - y);
    out[i] = y;
  }
  return out;
}

function highpass(wave: Wave, cut: number): Wave {
  const low = lowpass(wave, cut);
  const out = new Float32Array(wave.length);
  for (let i = 0; i < wave.length; i += 1) out[i] = (wave[i] ?? 0) - (low[i] ?? 0);
  return out;
}

/** A tone whose frequency can move: `freq(t)` in Hz, `shape` sine or square. */
function tone(length: number, freq: (t: number) => number, shape: "sine" | "square" | "tri" = "sine"): Wave {
  const out = new Float32Array(length);
  let phase = 0;
  for (let i = 0; i < length; i += 1) {
    phase += (2 * Math.PI * freq(i / RATE)) / RATE;
    const s = Math.sin(phase);
    out[i] = shape === "sine" ? s : shape === "square" ? Math.sign(s) * 0.6 : (2 / Math.PI) * Math.asin(s);
  }
  return out;
}

/** An envelope: attack, then exponential decay to `tail` of the length. */
function env(length: number, attack: number, decay: number): Wave {
  const out = new Float32Array(length);
  const a = Math.max(1, Math.round(attack * RATE));
  for (let i = 0; i < length; i += 1) {
    const t = i / RATE;
    out[i] = i < a ? i / a : Math.exp(-(t - attack) / decay);
  }
  return out;
}

function mul(a: Wave, b: Wave, gain = 1): Wave {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i += 1) out[i] = (a[i] ?? 0) * (b[i] ?? 0) * gain;
  return out;
}

function add(into: Wave, wave: Wave, at: number, gain = 1): void {
  const start = Math.round(at * RATE);
  for (let i = 0; i < wave.length && start + i < into.length; i += 1) into[start + i] = (into[start + i] ?? 0) + (wave[i] ?? 0) * gain;
}

function fade(wave: Wave, inS: number, outS: number): Wave {
  const out = new Float32Array(wave.length);
  const a = Math.round(inS * RATE);
  const b = Math.round(outS * RATE);
  for (let i = 0; i < wave.length; i += 1) {
    let g = 1;
    if (i < a) g = i / a;
    if (wave.length - i < b) g = Math.min(g, (wave.length - i) / b);
    out[i] = (wave[i] ?? 0) * g;
  }
  return out;
}

function writeWav(name: string, wave: Wave): string {
  let peak = 0;
  for (const v of wave) peak = Math.max(peak, Math.abs(v));
  const norm = peak > 0 ? 0.92 / peak : 1;
  const data = Buffer.alloc(wave.length * 2);
  for (let i = 0; i < wave.length; i += 1) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, (wave[i] ?? 0) * norm)) * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  const path = join(OUT, `${name}.wav`);
  writeFileSync(path, Buffer.concat([header, data]));
  return path;
}

/** The long sounds are packed as AAC; the short ones stay WAV. */
function pack(name: string, wave: Wave, long: boolean): void {
  const wav = writeWav(name, wave);
  if (!long) return;
  execFileSync(process.env.FFMPEG ?? "ffmpeg", ["-y", "-loglevel", "error", "-i", wav, "-c:a", "aac", "-b:a", "112k", join(OUT, `${name}.m4a`)]);
  unlinkSync(wav);
}

// The pieces.

function pop(): Wave {
  const n = seconds(0.14);
  const blip = mul(tone(n.length, (t) => 900 - t * 2600), env(n.length, 0.002, 0.03));
  const click = mul(highpass(noise(n.length, 3), 3000), env(n.length, 0.0005, 0.006));
  const out = seconds(0.14);
  add(out, blip, 0, 0.8);
  add(out, click, 0, 0.5);
  return out;
}

function swish(): Wave {
  const n = seconds(0.32);
  const sweep = new Float32Array(n.length);
  const raw = noise(n.length, 11);
  let y = 0;
  for (let i = 0; i < n.length; i += 1) {
    const t = i / n.length;
    const cut = 600 + 5000 * t * t;
    const a = 1 - Math.exp((-2 * Math.PI * cut) / RATE);
    y += a * ((raw[i] ?? 0) - y);
    sweep[i] = (raw[i] ?? 0) - y;
  }
  return mul(sweep, env(n.length, 0.08, 0.09));
}

function horn(): Wave {
  const out = seconds(1.1);
  const honk = (at: number, len: number) => {
    const n = seconds(len);
    const a = mul(tone(n.length, () => 392, "square"), env(n.length, 0.01, 0.6));
    const b = mul(tone(n.length, () => 494, "square"), env(n.length, 0.01, 0.6));
    const body = seconds(len);
    add(body, a, 0, 0.5);
    add(body, b, 0, 0.5);
    add(out, lowpass(fade(body, 0.01, 0.06), 2600), at, 1);
  };
  honk(0, 0.32);
  honk(0.42, 0.5);
  return out;
}

function engine(): Wave {
  const n = seconds(7);
  const rumble = lowpass(noise(n.length, 5), 140);
  const pulse = tone(n.length, (t) => 38 + 6 * Math.sin(t * 0.7));
  const out = seconds(7);
  add(out, rumble, 0, 1.2);
  add(out, mul(pulse, rumble), 0, 1.6);
  return fade(out, 0.3, 0.4);
}

function crowd(): Wave {
  const n = seconds(4);
  const band = lowpass(highpass(noise(n.length, 17), 300), 1800);
  const out = new Float32Array(n.length);
  for (let i = 0; i < n.length; i += 1) {
    const t = i / RATE;
    const swell = 0.55 + 0.45 * Math.sin(t * 2.1) * Math.sin(t * 5.3 + 1) + 0.2 * Math.sin(t * 13.7);
    out[i] = (band[i] ?? 0) * swell;
  }
  return fade(out, 0.3, 0.4);
}

function coin(): Wave {
  const n = seconds(0.09);
  const out = seconds(0.09);
  add(out, mul(tone(n.length, () => 2400), env(n.length, 0.001, 0.025)), 0, 0.7);
  add(out, mul(tone(n.length, () => 3600), env(n.length, 0.001, 0.015)), 0, 0.3);
  return out;
}

function stamp(): Wave {
  const n = seconds(0.3);
  const out = seconds(0.3);
  add(out, mul(tone(n.length, (t) => 130 - t * 300), env(n.length, 0.002, 0.09)), 0, 1);
  add(out, mul(lowpass(noise(n.length, 23), 900), env(n.length, 0.001, 0.02)), 0, 0.5);
  return out;
}

function chime(): Wave {
  const out = seconds(1.2);
  [523, 659, 784, 1047].forEach((f, index) => {
    const n = seconds(0.7);
    add(out, mul(tone(n.length, () => f, "tri"), env(n.length, 0.004, 0.22)), index * 0.09, 0.5);
  });
  return out;
}

function night(): Wave {
  const n = seconds(5);
  const out = seconds(5);
  const hum = seconds(5);
  add(hum, tone(n.length, () => 50), 0, 0.5);
  add(hum, tone(n.length, () => 100), 0, 0.25);
  add(hum, lowpass(noise(n.length, 29), 220), 0, 0.6);
  add(out, hum, 0, 0.35);
  // Crickets: bursts of a high tone pulsed at about 30 a second.
  let x = 31;
  for (let b = 0; b < 5 * 3; b += 1) {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    const at = (x / 0x7fffffff) * 4.6;
    const len = seconds(0.35);
    const chirp = mul(tone(len.length, () => 4200 + (x % 400)), env(len.length, 0.01, 0.12));
    for (let i = 0; i < len.length; i += 1) chirp[i] = (chirp[i] ?? 0) * (Math.sin((i / RATE) * 2 * Math.PI * 32) > 0 ? 1 : 0);
    add(out, chirp, at, 0.11);
  }
  return fade(out, 0.4, 0.5);
}

function jet(): Wave {
  const n = seconds(3.2);
  const raw = noise(n.length, 41);
  const out = new Float32Array(n.length);
  let y = 0;
  for (let i = 0; i < n.length; i += 1) {
    const t = i / n.length;
    const cut = 200 + 2400 * t;
    const a = 1 - Math.exp((-2 * Math.PI * cut) / RATE);
    y += a * ((raw[i] ?? 0) - y);
    out[i] = y * (0.2 + 0.8 * t);
  }
  return fade(out, 0.6, 0.6);
}

function click(): Wave {
  const n = seconds(0.06);
  const out = seconds(0.06);
  add(out, mul(highpass(noise(n.length, 43), 1500), env(n.length, 0.0005, 0.004)), 0, 1);
  add(out, mul(tone(n.length, () => 1100), env(n.length, 0.0005, 0.01)), 0, 0.5);
  return out;
}

function swell(): Wave {
  const n = seconds(2.6);
  const out = seconds(2.6);
  [261.6, 329.6, 392, 523.3].forEach((f, index) => {
    add(out, mul(tone(n.length, () => f, "tri"), env(n.length, 0.9 + index * 0.08, 0.9)), 0, 0.35);
  });
  return lowpass(out, 2200);
}

/** The bed: a shaker on the sixteenths, a kick on one and the and of two, a low drum that answers every other bar. */
function bed(lengthS: number, bpm: number): Wave {
  const out = seconds(lengthS);
  const beat = 60 / bpm;
  const shakerLen = seconds(0.07);
  const shaker = mul(highpass(noise(shakerLen.length, 53), 5000), env(shakerLen.length, 0.004, 0.02));
  const kickLen = seconds(0.28);
  const kick = mul(tone(kickLen.length, (t) => 48 + 90 * Math.exp(-t * 28)), env(kickLen.length, 0.002, 0.11));
  const drumLen = seconds(0.4);
  const drum = mul(tone(drumLen.length, (t) => 170 - 60 * Math.min(1, t * 3)), env(drumLen.length, 0.004, 0.14));
  const claveLen = seconds(0.05);
  const clave = mul(tone(claveLen.length, () => 1800), env(claveLen.length, 0.001, 0.012));
  const bars = Math.ceil(lengthS / (beat * 4));
  for (let bar = 0; bar < bars; bar += 1) {
    const t0 = bar * beat * 4;
    for (let s = 0; s < 16; s += 1) {
      const accent = s % 4 === 0 ? 0.5 : s % 2 === 0 ? 0.3 : 0.18;
      add(out, shaker, t0 + s * (beat / 4), accent);
    }
    add(out, kick, t0, 0.9);
    add(out, kick, t0 + beat * 1.5, 0.7);
    add(out, kick, t0 + beat * 2.5, 0.5);
    add(out, clave, t0 + beat * 0.5, 0.4);
    add(out, clave, t0 + beat * 1.75, 0.4);
    add(out, clave, t0 + beat * 2.5, 0.4);
    add(out, clave, t0 + beat * 3.25, 0.4);
    if (bar % 2 === 1) {
      add(out, drum, t0 + beat * 3, 0.7);
      add(out, drum, t0 + beat * 3.5, 0.5);
    }
  }
  return fade(out, 0.4, 1.2);
}

mkdirSync(OUT, { recursive: true });
pack("bed", bed(30, 104), true);
pack("engine", engine(), true);
pack("crowd", crowd(), true);
pack("night", night(), true);
pack("jet", jet(), true);
pack("horn", horn(), false);
pack("pop", pop(), false);
pack("swish", swish(), false);
pack("coin", coin(), false);
pack("stamp", stamp(), false);
pack("chime", chime(), false);
pack("click", click(), false);
pack("swell", swell(), false);
console.log(`sound: thirteen sounds written under ${OUT}`);
