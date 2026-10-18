# Audio

> The game carries the synthesised interface cues (`apps/client/src/shared/sound/cues.ts`), the mute switch and the notice, and the officers' spoken lines (section 7). Place ambience and voiced radio are designed below and are not part of the game.
> Library download figures are for the week of 28 Sep 2026.

## 1. The pattern

- **The simulation never plays a sound.** It writes sound cues to a list, and the interface plays them.
- **Sound effects are synthesised in the browser** where they can be, so the base bundle carries no sound files.
- **Radio is content.** Bulletins are written once and voiced once, and the written version is always shown.

## 2. In the baseline

Cheap to build, and the game feels unfinished without it.

| Part | What |
|---|---|
| Interface sounds | About a dozen: tap, turn resolved, money in, money out, checklist item met, japacity up, japacity down, news alert, granted, refused, the send-off |
| Place ambience | A short loop per place: market, office, embassy queue, airport |
| Controls | Mute, separate levels for effects and ambience, remembered on the device. Silent until the first tap, as browsers require |
| Radio you can hear | The radio is a news source in the design. Each bulletin is written once, voiced once in Nigerian English or Pidgin, and cached for everyone. About 90 KB per 30 seconds. The written version is always shown too |

**How it is built:**

- The simulation emits a cue name, such as `money/in`. It never touches audio. This keeps it pure and testable.
- A cue is a row in a table: name, sound, volume. Adding a sound is a data change.
- Sounds are synthesised, or taken from packs under a licence that allows any use. Each one is recorded in the assets file.

## 3. Not part of the game

| Part | What | What it needs |
|---|---|---|
| Music stations | Tracks that are commissioned, openly licensed, or submitted by artists | Clear rights for every track |
| Artists paying for airtime | An advert surface with a review step | The advert review (`../rules/advert.md`) carried over to sound |
| Sound that comes from places in the city | Louder as you walk closer | Sound sources placed in the city |

## 4. Voiced radio

Bulletins are shared by all players, so each is generated once. At 10 to 30 a week that is about 15 minutes of audio a month.

- A native speaker hears every voice, since a generated voice can stumble on numbers such as years.
- Format: Opus at 24 kbps, with an MP3 fallback for old phones.
- A person approves every voice before it ships.

## 5. Left out

Commercial Nigerian music without a licence, however much it would add.

## 6. Tools

| Job | Choice | Weekly downloads |
|---|---|---|
| Sound in the 3D city | The audio built into three.js, already in the stack | 24.3m |
| Interface sounds | The browser's own Web Audio, with no library | |

## 7. Spoken lines and the browser

> Built for the visa interview; the same layer serves every spoken scene and the interface sounds.

**The rule above the others: a scene never waits on sound.** The text is the scene. Sound is added when the browser allows it, and if anything about it fails, the player gets the same scene in text.

### How the sound layer behaves

| Limit | What the game does |
|---|---|
| Sound starts only after a tap | The first tap anywhere in the game wakes sound, silently. The first tap after the game comes back from the background wakes it again, since phones put it back to sleep. The tap on "Enter the interview room" is the backstop |
| Any one play can be refused | Every failure is caught and the scene carries on in text. No error is shown |
| A clip that never loads never ends | The answers show when the clip ends, or when its known length plus 1.5 seconds has passed, or on a tap, whichever is first. The lengths sit beside the clip keys in content |
| Opus is not played everywhere | Each clip ships as Opus (24 kbps) and MP3 (32 kbps). The browser is asked which it plays; Opus first. A clip that will not decode is tried in the other format, then the voice-like sound stands in |
| Phones limit loading | Only the clips the scene will use are fetched, ahead from the moment the application is sent, so the first line plays the moment the player walks in. Muted or saving data, nothing is fetched |
| Cached audio | Clips are not cached for offline play. The browser's own cache keeps them |
| A call or an app switch | Hiding the page stops the clip and puts sound to sleep. On return the rest of the clip is skipped and the text is there |
| A page cannot set the volume on a phone | A mute switch, remembered on the device. No volume slider. Sound is on by default; muted, nothing is fetched, and unmuting fetches from then on |
| In-app browsers | The browser tests run the interview inside faked Instagram and Facebook in-app browsers |
| The iPhone silent switch | Spoken lines play through Web Audio, which stays quiet when the switch is on. Not checked on a real iPhone |

A line with no clip, or whose clip is missing, plays a short voice-like sound in its place. It costs no data.

### The notice

One small notice for the whole game, in the top corner. It never covers the question or the answers, never needs closing, goes by itself after five seconds, shows at most once a scene, never stacks, has no motion, and is read out to screen readers without taking the focus.

| When | It says | Tapping it |
|---|---|---|
| Sound is playing for the first time in the scene | "Sound on", with a mute icon | Mutes |
| The browser held sound back | "Better with sound. Tap to turn it on" | Starts sound: the tap is what the browser waited for |
| Data-saver or low-data mode is on | "Sound is off to save data. Tap to turn it on" | Fetches the clips and speaks the line |
| The browser cannot play the clips | "Playing in text on this browser" | Nothing |

### The voices

Every officer has one generated voice: Kokoro-82M (Apache 2.0), voice `bf_emma`, run on the machine, one clip per line. A recording by a person replaces a clip by its path. The credits say the voices are generated, and the register names the model, the voice and the licence for each clip (assets:ai-media-recorded-and-credited).
