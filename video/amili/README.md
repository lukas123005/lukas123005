# AMILI Beauty Studio — cinematic film

`amili_beauty_studio_film.mp4` is a 42-second vertical film (1080×1920, 30 fps, H.264 + AAC), made for Reels, TikTok and Stories.

Every frame comes from the studio's own photographs (`photos/`). The camera moves are virtual push-ins, tracks and tilts over each original image. Nothing inside the pictures is generated or changed.

## Sequence
1. Arrival: the reed diffuser and the blush sofa. *"Some places are made to be felt."*
2. Reveal: through the curtains into the treatment room. *"Calm. Considered. Quietly luxurious."*
3. Treatment room: a slow lateral track across the wall.
4. Detail: a tilt down the bed under the magnifier lamp. *"Every detail, crafted with precision."*
5. Precision: permanent make-up instruments and pigments.
6. Nail atelier: a push toward the halo lamp. *"Every touch, with intention."*
7. Overhead: the pink and blue shell chairs. *"Because true beauty is never rushed."*
8. Signature: the entrance and the AMILI mark, which resolve into the end card. *"AMILI Beauty Studio. Where beauty becomes an experience."*

## Rebuild
```
pip install opencv-python-headless scipy soundfile kokoro-onnx
python3 audio.py mix.wav <kokoro-model-dir>   # kokoro-v1.0.onnx + voices-v1.0.bin
python3 make_film.py render film.mp4 mix.wav
python3 make_film.py preview outdir           # contact sheet for framing
```
The score is synthesised in `audio.py` and is original and royalty-free. The voice-over uses Kokoro TTS with the `af_heart` voice. The fonts are Cormorant Garamond and Montserrat, both under the SIL Open Font License.
