"""Pack the repaired eight-pose row without changing its poses or idle artwork."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
source = Image.open(root / 'rear-gait-repair.png').convert('RGBA')
cell = source.width / 8
sheet = Image.new('RGBA', (2048, 256))
for frame in range(8):
    image = source.crop((round(frame * cell), 230, round((frame + 1) * cell), 230 + round(cell)))
    image = image.resize((256, 256), Image.Resampling.LANCZOS)
    # Remove the generator's nearly invisible alpha noise outside the drawings.
    image.putalpha(image.getchannel('A').point(lambda alpha: 0 if alpha < 8 else alpha))
    sheet.paste(image, (frame * 256, 0))
sheet.save(root / 'walk.webp', lossless=True)
