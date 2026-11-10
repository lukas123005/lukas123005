"""
Puts a new voice recording on the studio video (original audio removed).

    python3 add_voice.py zeri.m4a                 -> video_me_ze_te_ri.mp4
    python3 add_voice.py zeri.m4a --start 0.4     (voice starts at 0.4 s)
    python3 add_voice.py zeri.m4a --music         (adds a soft original music bed under the voice)

The voice is cleaned (low-cut, gentle compression, loudness to social-media level).
If the recording is longer than the video, the last frame is held so nothing is cut.
"""
import argparse
import json
import os
import subprocess
import wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
VIDEO = os.path.join(HERE, "video_pa_ze.mp4")


def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", path],
                         capture_output=True, text=True, check=True).stdout
    return float(json.loads(out)["format"]["duration"])


def trim_silence(src, dst):
    """Drop leading/trailing silence from the recording and clean it up."""
    af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,"
          "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.15,areverse,"
          "highpass=f=80,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,"
          "loudnorm=I=-15:TP=-1.5:LRA=9")
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, "-af", af, "-ar", "48000", "-ac", "2", dst], check=True)


def music_bed(path, dur, sr=48000):
    """Soft, warm pad + light pulse (original, no copyright)."""
    t = np.arange(int(dur * sr)) / sr
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)  # noqa: E731
    chords = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
    out = np.zeros_like(t)
    seg = 2.5
    for i, ch in enumerate(chords * 4):
        a = i * seg
        if a >= dur:
            break
        m = (t >= a) & (t < a + seg + 0.6)
        tt = t[m] - a
        env = np.minimum(1, tt / 0.6) * np.exp(-np.maximum(0, tt - seg) * 4)
        for n in ch:
            out[m] += np.sin(2 * np.pi * hz(n) * tt) * env * 0.18 + np.sin(2 * np.pi * hz(n + 12) * tt) * env * 0.05
    out *= np.minimum(1, t / 1.0) * np.minimum(1, (dur - t) / 1.2)
    out = out / (np.abs(out).max() + 1e-9) * 0.5
    st = np.stack([out, out], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((st * 32767).astype(np.int16).tobytes())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("voice")
    ap.add_argument("--start", type=float, default=0.3)
    ap.add_argument("--music", action="store_true")
    a = ap.parse_args()
    clean = os.path.join(HERE, "_voice_clean.wav")
    trim_silence(a.voice, clean)
    vd, vo = duration(VIDEO), duration(clean)
    total = max(vd, a.start + vo + 0.4)
    hold = max(0.0, total - vd)
    out = os.path.join(HERE, "video_me_ze_te_ri.mp4")
    inputs = ["-i", VIDEO, "-i", clean]
    vf = f"tpad=stop_mode=clone:stop_duration={hold:.3f}" if hold > 0 else "null"
    delay = int(a.start * 1000)
    if a.music:
        bed = os.path.join(HERE, "_bed.wav")
        music_bed(bed, total)
        inputs += ["-i", bed]
        af = (f"[1:a]adelay={delay}|{delay},apad,asplit=2[v][vs];"
              f"[2:a]volume=0.22[m];[m][vs]sidechaincompress=threshold=0.05:ratio=6:attack=20:release=300[md];"
              f"[md][v]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[a]")
    else:
        af = f"[1:a]adelay={delay}|{delay},apad,alimiter=limit=0.95[a]"
    cmd = ["ffmpeg", "-loglevel", "error", "-y", *inputs, "-filter_complex", f"[0:v]{vf}[v0];{af}",
           "-map", "[v0]", "-map", "[a]", "-t", f"{total:.3f}", "-c:v", "libx264", "-crf", "17", "-preset", "slow",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
    subprocess.run(cmd, check=True)
    for p in (clean, os.path.join(HERE, "_bed.wav")):
        if os.path.exists(p):
            os.remove(p)
    print(f"done: {out}  (video {vd:.1f}s, voice {vo:.1f}s, total {total:.1f}s)")


if __name__ == "__main__":
    main()
