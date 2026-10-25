# Audio

**Context and scope.** The game's sound: the interface's small sounds, the visa officer's spoken lines, and how both behave inside a phone's browser, where sound may start only after a tap and may be refused at any time. The rules that hold it are world:interface-sounds-made-live, world:officer-voice-drawn-per-interview, world:motions-under-half-second and assets:ai-media-recorded-and-credited. The code is in `apps/client/src/shared/sound/`.

**Goals.**

- Sound adds to a scene and never holds it up. Every scene plays the same in text.
- A first visit downloads no sound file.
- One mute switch for everything, remembered on the device.

**Non-goals.** Music, a loop of background sound per place, sound placed in the 3D city, voiced radio (the radio is a source of news in words, `../rules/news.md`), adverts in sound (advert:no-radio-adverts), a volume slider or separate levels, clips kept for offline play, and commercial music without a licence.

## 1. The pattern

- **The simulation never plays or names a sound.** The interface picks each sound from what happens on screen, so the simulation stays pure and its tests never touch audio.
- **The interface's sounds are made in the browser** from tones, so they cost no download.
- **The text is the scene.** A spoken line is always shown as text too, and sound is added only when the browser allows it.

## 2. The interface cues

A cue is one short sound the interface plays when something happens on screen. There are eleven (`Cue` in `cues.ts`):

| Cue | Plays when | Length |
|---|---|---|
| `tap` | A main button is pressed: the band's month button, the brief's Let's go, a step of the send-off, a road in the Bank app, a buy in the Market app, waking from sleep | 50 ms |
| `open` | A brief is handed over, and the send-off opens | 120 ms |
| `close` | The results sheet or the send-off is left, a kiosk's answer is closed, an agent's offer is turned down, or an act carried on in the month is stopped | 110 ms |
| `done` | The family's ring on the first ride abroad | 220 ms |
| `coin` | Money lands or leaves on the money toast, a buy or a sale in the Market app, an agent's offer taken | 220 ms |
| `whoosh` | A thing's acts fan out, and the plane leaves at the send-off | 420 ms |
| `month` | The results sheet opens as the month turns | 420 ms |
| `ding` | A step of the chapter is done, a brief closes, the interview's last answer is in | 200 ms |
| `thud` | The stamp lands as a brief closes, 260 ms after its `ding` | 160 ms |
| `no` | A refusal: a road the Bank app cannot take, a buy the Market app refuses, a thing that will not fit where it is set down | 270 ms |
| `pop` | A thing you own is lifted in buy mode, the mode in which the things in your room are moved (world:room-things-and-buy-mode) | 80 ms |

The three cues of the game's look, `ding`, `thud` and `no`, are each under 300 ms (world:motions-under-half-second). Every cue ends inside half a second.

## 3. How a cue is made

A cue is a row in `CUES`: one or more tones, each a wave (sine, triangle, square, or a filtered noise) gliding from one pitch to another, with its start, its length and its loudness. Adding a cue is adding a row. The noise is a fixed pattern, so the same cue sounds the same every time. The cues keep their own small audio context, made inside the first tap that plays one. Muted, a cue returns before anything is made, and a browser that refuses stays quiet with no error.

## 4. Mute

One switch mutes every cue and every spoken line. It is in the phone's Settings app and in the interview room. Sound is on by default. The choice is remembered on the device; a phone that keeps nothing still mutes for the session. Muted, no audio context is made and no clip is fetched.

## 5. The spoken lines

The visa interview's officer is the one voice in the game: sixteen lines, from the greeting to the close (`setpiece.credibility-interview.*`), in two voices, a man's and a woman's. Each line's clip and its length in milliseconds, for each voice, sit beside its words key in `packages/content/src/setpiece/setpiece.voice.ts`; the clips are in `apps/client/public/voice/officer/m/` and `apps/client/public/voice/officer/f/`, about 260 KB for every line of one voice in both formats. A line with no clip, or whose clip is missing, plays a short voice-like sound in its place. It costs no data.

## 6. Where the sounds come from

The cues are written as code, so they are the makers' own work and need no licence or credit. The officer's voices are generated: Phonon S 31M (Apache 2.0, model and voices), its catalogue voices Edwin and Bryony, both British and middle-aged, run on the makers' machine at a pinned revision with a fixed seed, one clip per line and voice, encoded as Opus at 24 kbps and MP3 at 32 kbps, mono. The assets register (`models/register.json`) names the model, its revision, the voice and the licence for each clip, and the credits say the voice is generated (assets:ai-media-recorded-and-credited, guide:generated-media-named-plainly). A recording by a person replaces a clip by its path.

## 7. Spoken lines and the browser

**The rule above the others: a scene never waits on sound.** The text is the scene. Sound is added when the browser allows it, and if anything about it fails, the player gets the same scene in text.

**One officer for each interview (world:officer-voice-drawn-per-interview).** The interview shows no face for the officer, only the officer's pill and the desk's tile, so either voice can sit across the desk. The client draws the voice from the month the interview is held in, which stays put while it is open, so a reload brings back the same officer and interviews in other months bring either. Only that voice's clips are fetched. No word on screen says whether the officer is a man or a woman.

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
| A page cannot set the volume on a phone | A mute switch, remembered on the device (section 4). No volume slider. Sound is on by default; muted, nothing is fetched, and unmuting fetches from then on |
| In-app browsers | The browser tests run the interview inside Instagram's and Facebook's in-app browsers, faked by their user agents (`apps/client/e2e/voice.spec.ts`) |
| The iPhone silent switch | Spoken lines play through Web Audio, which stays quiet when the switch is on. Not checked on a real iPhone |

### The notice

The notice is the game's one small message about sound, in the top corner. It never covers the question or the answers, never needs closing, goes by itself after five seconds, shows at most once a scene, never stacks, has no motion, and is read out to screen readers without taking the focus.

| When | It says | Tapping it |
|---|---|---|
| Sound is playing for the first time in the scene | "Sound on", with a mute icon | Mutes |
| The browser held sound back | "Better with sound. Tap to turn it on" | Starts sound: the tap is what the browser waited for |
| Data-saver or low-data mode is on | "Sound is off to save data. Tap to turn it on" | Fetches the clips and speaks the line |
| The browser cannot play the clips | "Playing in text on this browser" | Nothing |

## 8. Alternatives considered

- **Sound files for the cues.** A pack of recorded sounds would cost a download and a licence for each; tones made in the browser cost neither.
- **The audio built into three.js.** It places sound in the 3D scene, which the game has no use for; the browser's own Web Audio, with no library, does everything above.
- **A volume slider.** A page cannot set a phone's volume, so a slider would promise what it cannot do; the mute switch is the one control.
- **Keeping clips for offline play.** It would fill a phone's storage for one scene that the text already carries; the browser's own cache is enough.
- **A person's recording for every line.** A generated line is made again whenever its words change; a recording replaces a clip by its path wherever one is made.
