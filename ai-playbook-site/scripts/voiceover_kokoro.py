"""
Generate the narration locally with Kokoro TTS (fallback when no ElevenLabs key).

    pip install kokoro-onnx soundfile scipy
    # model files: https://github.com/thewh1teagle/kokoro-onnx/releases (kokoro-v1.0.onnx, voices-v1.0.bin)
    python3 scripts/voiceover_kokoro.py /path/to/model_dir

Writes public/voiceover/*.mp3 and stores each clip's duration in manifest.json.
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from scipy import signal

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, "public")
MAN = os.path.join(PUB, "voiceover", "manifest.json")
SR = 48000


def main(model_dir):
    from kokoro_onnx import Kokoro

    k = Kokoro(os.path.join(model_dir, "kokoro-v1.0.onnx"), os.path.join(model_dir, "voices-v1.0.bin"))
    # natural, conversational male voice — no artificial deepening
    style = k.get_voice_style("am_michael")
    man = json.load(open(MAN))
    for seg in man["segments"]:
        chunks = []
        for part in seg["parts"]:
            if isinstance(part, dict):
                chunks.append(np.zeros(int(part["pause"] * SR)))
                continue
            a, sr = k.create(part, voice=style, speed=0.96, lang="en-us")
            a = signal.resample_poly(a, SR, sr)
            idx = np.where(np.abs(a) > 0.008)[0]
            a = a[max(0, idx[0] - 300): idx[-1] + 1800]
            chunks.append(a)
        audio = np.concatenate(chunks)
        # gentle voice chain: rumble filter + 10 ms fades (no heavy processing)
        b, a_ = signal.butter(2, 75 / (SR / 2), "high")
        audio = signal.lfilter(b, a_, audio)
        f = int(0.01 * SR)
        audio[:f] *= np.linspace(0, 1, f)
        audio[-f:] *= np.linspace(1, 0, f)
        with tempfile.TemporaryDirectory() as td:
            wav = os.path.join(td, "v.wav")
            sf.write(wav, audio.astype(np.float32), SR)
            out = os.path.join(PUB, seg["file"])
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav,
                            "-af", "acompressor=threshold=-22dB:ratio=1.8:attack=12:release=160,loudnorm=I=-16:TP=-1.5:LRA=9",
                            "-ar", str(SR), "-ac", "1", "-c:a", "libmp3lame", "-b:a", "160k", out], check=True)
        seg["duration"] = round(len(audio) / SR, 3)
        seg["text"] = " ".join(p for p in seg["parts"] if isinstance(p, str))
        print(f"{seg['id']}: {seg['duration']} s")
    json.dump(man, open(MAN, "w"), indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main(sys.argv[1])
