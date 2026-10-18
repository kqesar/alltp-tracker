# Voice fixtures

The browser tests' microphone: Chromium plays one of these files in a loop
(`--use-file-for-fake-audio-capture`), as `e2e/voice.e2e.ts` sets up.

| File | Said |
|---|---|
| `tracker-hook-shot.wav` | "tracker hook shot": a command |
| `talk-about-the-hook-shot.wav` | "I really need the hook shot": talk, no wake word |

Synthesized with [Piper](https://github.com/rhasspy/piper) and its
`en_US-ljspeech-medium` voice, trained on the
[LJ Speech dataset](https://keithito.com/LJ-Speech-Dataset/) (public domain),
then converted to 16 kHz mono with 1.5 s of silence after the phrase, so that
each loop ends an utterance:

```sh
echo "tracker hook shot" | piper -m en_US-ljspeech-medium.onnx -f raw.wav
ffmpeg -i raw.wav -af apad=pad_dur=1.5 -ar 16000 -ac 1 -sample_fmt s16 tracker-hook-shot.wav
```
