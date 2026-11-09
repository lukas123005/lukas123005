"""Cut the 6 storyboard panels, remove the time badges, upscale 3x with EDSR.

usage: python3 prep_frames.py EDSR_x3.pb
"""
import os
import sys

import cv2
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
COLS = [(0, 835), (838, 1672)]
ROWS = [(0, 314), (316, 627), (629, 941)]

sb = cv2.imread(os.path.join(HERE, "storyboard.png"), cv2.IMREAD_COLOR)
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(sys.argv[1])
sr.setModel("edsr", 3)

k = 0
for r0, r1 in ROWS:
    for c0, c1 in COLS:
        k += 1
        p = sb[r0:r1, c0:c1].copy()
        # time badge (top-left pill): mask the pill and its soft edge, then inpaint
        mask = np.zeros(p.shape[:2], np.uint8)
        cv2.rectangle(mask, (8, 8), (138, 68), 255, -1)
        p = cv2.inpaint(p, mask, 9, cv2.INPAINT_TELEA)
        # soften the inpainted patch so it reads like the out-of-focus surroundings
        blur = cv2.GaussianBlur(p, (0, 0), 6)
        m = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 6)[..., None]
        p = (p * (1 - m) + blur * m).astype(np.uint8)
        up = sr.upsample(p)
        cv2.imwrite(os.path.join(HERE, "frames", f"shot{k}.png"), up)
        print(k, p.shape, "->", up.shape, flush=True)
