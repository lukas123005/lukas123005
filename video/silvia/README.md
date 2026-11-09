# SILVIA Beauty Studio — film (18 s, instrumental)

`silvia_beauty_studio_film.mp4`: 1920×1080, 30 fps, 2.39:1 cinema letterbox, 18 s, music only (no voice).

1. `prep_frames.py` cuts the 6 frames from `storyboard.png`, removes the time badges and upscales 3× (EDSR).
2. `music.py` builds an original instrumental track (96 BPM; one bar = 2.5 s, so every cut lands on a beat).
3. `make_film.py render out.mp4 music.wav` renders the slow camera moves, dissolves and grade.

Sequence: entrance and logo → treatment room → nail bar → PMU detail → treatment rooms → signature card (Nails · Skin Care · Treatments · BOOK NOW).
