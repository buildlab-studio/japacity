# Audio

## Context and scope

The game's sound and why it works as it does: the interface's short sounds, the visa officer's spoken lines, and how both behave in a phone's browser, where sound may start only after a tap and may be refused at any time. The rules are world:interface-sounds-made-live, world:officer-voice-drawn-per-interview and world:motions-under-half-second in [the world rules](../rules/world.md), and assets:ai-media-recorded-and-credited in [the assets rules](../rules/assets.md). The code is in `apps/client/src/shared/sound/`.

## Goals and non-goals

**Goals.**

- Sound adds to a scene and never holds it up. Every scene plays the same in text.
- A first visit downloads no sound file.
- One mute switch for everything, remembered on the device.

**Non-goals.** Music; a background loop per place; sound placed in the 3D city; a voiced radio (the radio gives news in words, `../rules/news.md`); adverts in sound (advert:no-radio-adverts); a volume slider or separate levels; clips kept for offline play; commercial music without a licence.

## 1. Principles

- **The simulation never plays or names a sound.** The interface picks each sound from what happens on screen, so the simulation stays pure and its tests never touch audio.
- **The interface's sounds are made in the browser** from tones, so they cost no download.
- **The text is the scene.** A spoken line is always shown as text too, and sound is added only when the browser allows it.

## 2. Interface cues

A cue is one short sound the interface plays when something happens on screen. The set is the `Cue` type in `cues.ts`, and each cue's tones and length are its row in `CUES`; every cue is short (world:motions-under-half-second).

Each cue stands for one kind of event. The examples are some of the places each plays; the calls to `cue` in the client are the full list.

| Cue | Means | For example |
|---|---|---|
| `tap` | A main button is pressed | The brief's Let's go, a step of the send-off, waking from sleep |
| `open`, `close` | Something opens or is put away | A brief handed over; the results sheet left, an offer turned down |
| `done` | An act went through at no cost | An act answered or planned, the family's ring on the first ride abroad |
| `coin` | Money moves | The money toast, a buy or a sale in the Market app, an agent's offer taken |
| `whoosh` | Something takes off | A thing's acts fan out, the plane leaves at the send-off |
| `month` | The month turns | The results sheet opens |
| `ding` | A step is done | A step of the chapter done, a brief's close, the interview's last answer |
| `thud` | A stamp lands | The stamp as a brief closes, just after its `ding` |
| `no` | A refusal | A road the Bank app cannot take, a thing that will not fit where it is set down |
| `pop` | A thing is lifted | A thing you own lifted in buy mode, the mode for moving the things in your room (world:room-things-and-buy-mode) |

## 3. How a cue is made

A cue is a row in `CUES`: one or more tones, each with a wave (sine, triangle, square, or filtered noise) gliding from one pitch to another, a start, a length and a loudness. Adding a cue means adding a row. The noise is a fixed pattern, so a cue sounds the same every time. The cues have their own small audio context, created inside the first tap that plays one. When muted, a cue returns before anything is created. If the browser refuses, the cue stays quiet and raises no error.

## 4. Mute

One switch mutes every cue and every spoken line. It is in the phone's Settings app and in the interview room. Sound is on by default. The choice is remembered on the device; a phone that stores nothing still mutes for the session. When muted, no audio context is created and no clip is fetched.

## 5. The officer's spoken lines

The visa interview's officer is the only voice in the game: its lines, from the greeting to the close (`setpiece.credibility-interview.*`), in two voices, a man's and a woman's.

- Each line's clip and its length in milliseconds, for each voice, sit beside its words key in `packages/content/src/setpiece/setpiece.voice.ts`, which is also the list of lines that are spoken.
- The clips are in `apps/client/public/voice/officer/m/` and `apps/client/public/voice/officer/f/`, each with its measured size in its register row (`models/register.json`). Only one voice's clips are fetched for an interview (section 7).
- A line with no clip, or whose clip is missing, plays a short voice-like sound instead, which costs no data.

## 6. Sources and licences

The cues are written as code, so they are the makers' own work and need no licence or credit.

The officer's voices are generated with Phonon S 31M (Apache 2.0, model and voices), using its catalogue voices Edwin and Bryony, both British and middle-aged. The model runs on the makers' machine at a pinned revision with a fixed seed, one clip per line and voice. Each clip is encoded as Opus at 24 kbps and MP3 at 32 kbps, mono. The assets register (`models/register.json`) names the model, its revision, the voice and the licence for each clip, and the credits say the voice is generated (assets:ai-media-recorded-and-credited, guide:generated-media-named-plainly). A recording by a person can replace a clip at the same path.

## 7. Spoken lines in the browser

**A scene never waits on sound.** This comes before everything below: if anything about sound fails, the player gets the same scene in text (section 1).

**One officer for each interview** (world:officer-voice-drawn-per-interview). The interview shows no face for the officer, only the officer's pill and the desk's tile, so either voice fits. The client draws the voice from the month the interview is held in, a value that does not change while the interview is open, so a reload brings back the same officer. Only that voice's clips are fetched.

### Browser limits

| Limit | What the game does |
|---|---|
| Sound starts only after a tap | The first tap anywhere in the game wakes sound, silently. Phones put sound back to sleep when the game goes to the background, so the first tap after it returns wakes it again. The tap on "Enter the interview room" is the backstop |
| Any single play can be refused | Every failure is caught and the scene carries on in text. No error is shown |
| A clip that never loads never ends | The answers show when the clip ends, when its known length plus 1.5 seconds has passed, or on a tap, whichever comes first. The lengths sit beside the clip keys in content |
| Opus does not play everywhere | Each clip ships as Opus and MP3 (section 6). The browser is asked which it plays, Opus first. A clip that will not decode is tried in the other format, then the voice-like sound stands in |
| Phones limit loading | Only the clips the scene will use are fetched, starting when the application is sent, so the first line plays the moment the player walks in. When muted or saving data, nothing is fetched |
| Cached audio | Clips are not stored for offline play. The browser's own cache keeps them |
| A call or an app switch | Hiding the page stops the clip and puts sound to sleep. On return, the rest of the clip is skipped and the text is there |
| A page cannot set the volume on a phone | The mute switch of section 4, and no volume slider. Unmuting fetches from then on |
| In-app browsers | The browser tests run the interview inside Instagram's and Facebook's in-app browsers, faked by their user agents (`apps/client/e2e/voice.spec.ts`) |
| The iPhone silent switch | Spoken lines play through Web Audio, which stays quiet when the switch is on. Not checked on a real iPhone |

### The sound notice

The notice is the game's one small message about sound, in the top corner. It never covers the question or the answers, never needs closing, goes by itself after five seconds, shows at most once per scene, never stacks, does not move, and is read out to screen readers without taking focus.

| When | It says | Tapping it |
|---|---|---|
| Sound plays for the first time in the scene | "Sound on", with a mute icon | Mutes |
| The browser held sound back | "Better with sound. Tap to turn it on" | Starts sound: the tap is what the browser was waiting for |
| Data-saver or low-data mode is on | "Sound is off to save data. Tap to turn it on" | Fetches the clips and speaks the line |
| The browser cannot play the clips | "Playing in text on this browser" | Nothing |

## 8. Alternatives considered

- **Sound files for the cues.** A pack of recorded sounds would cost a download and a licence for each; tones made in the browser cost neither.
- **The audio built into three.js.** It places sound in the 3D scene, which the game does not need; the browser's own Web Audio, with no library, does everything above.
- **A volume slider.** A page cannot set a phone's volume, so a slider would promise what it cannot do; the mute switch is the one control.
- **Keeping clips for offline play.** It would fill a phone's storage for one scene that the text already carries; the browser's own cache is enough.
- **A person's recording for every line.** A generated line can be made again whenever its words change; a recording can still replace any clip at its path.
