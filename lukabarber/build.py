"""Builds index.html = template.html + data.js (prices copied from the current lukabarber site)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
t = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
d = open(os.path.join(HERE, "data.js"), encoding="utf-8").read()
open(os.path.join(HERE, "index.html"), "w", encoding="utf-8").write(t.replace("/*DATA*/", d))
print("index.html", os.path.getsize(os.path.join(HERE, "index.html")), "bytes")
