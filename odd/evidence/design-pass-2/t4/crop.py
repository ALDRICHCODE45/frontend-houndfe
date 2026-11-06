# Crops the main content of full-height shots so they can be read at full scale.
import sys

from PIL import Image

left, top, right, bottom = (int(v) for v in sys.argv[1].split(","))
for name in sys.argv[2:]:
    Image.open(f"shots/{name}").crop((left, top, right, bottom)).save(f"crops/{name}")
