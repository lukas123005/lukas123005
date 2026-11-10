"""English voiceover with Kokoro (local TTS). Writes vo/NN.wav + vo/manifest.json."""
import json, os, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
V = "/tmp/claude-0/-home-user-lukas123005/101589f2-ff2a-5a15-987e-0ac03921828e/scratchpad/voices"
LINES = [
    "Tried to quit smoking before?",
    "You're not starting over. You're starting smarter.",
    "Quit in Thirty Days gives you one page a day.",
    "One small writing task. One real-life task.",
    "And a Save Box, so you can watch your money grow.",
    "When a craving hits, you have a plan. It passes in minutes.",
    "Thirty real facts from the World Health Organization keep you going.",
    "And on day thirty, you test your breathing with the sport you love.",
    "Thirty days. Thirty pages. One fresh start.",
    "Get your copy today. Link in bio.",
]
voice = sys.argv[1] if len(sys.argv) > 1 else "af_heart"
k = Kokoro(f"{V}/kokoro-v1.0.onnx", f"{V}/voices-v1.0.bin")
out = []
for i, t in enumerate(LINES):
    s, sr = k.create(t, voice=voice, speed=1.0, lang="en-us")
    s = np.asarray(s, np.float32)
    nz = np.where(np.abs(s) > 0.01)[0]
    s = s[max(0, nz[0] - 800): nz[-1] + 1600]
    p = f"vo/{i:02d}.wav"; sf.write(p, s, sr)
    out.append({"i": i, "text": t, "file": p, "dur": round(len(s) / sr, 3)})
    print(i, round(len(s) / sr, 2), t)
json.dump({"voice": voice, "sr": sr, "lines": out}, open("vo/manifest.json", "w"), indent=1)
