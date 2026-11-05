# Crop a region of a shot to read it at full scale: python3 -I crop.py L,T,R,B shot.png out.png
import sys

from PIL import Image

left, top, right, bottom = (int(v) for v in sys.argv[1].split(","))
Image.open(f"shots/{sys.argv[2]}").crop((left, top, right, bottom)).save(f"shots/{sys.argv[3]}")
