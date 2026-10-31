import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageChops

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / 'source'
original_body = Image.open(SOURCE/'original-body-complete.png').convert('RGBA')
generated_body = Image.open(SOURCE/'body-repair-generated.png').convert('RGBA')
bounds = generated_body.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox()
generated_body = generated_body.crop(bounds).resize((406,285),Image.Resampling.LANCZOS)
aligned = Image.new('RGBA',(512,512),(0,0,0,0))
aligned.alpha_composite(generated_body,(53,148))
old_pixels,new_pixels = original_body.load(),aligned.load()
samples = []
for y in range(399,406):
    for left,right in [(127,192),(320,382)]:
        for x in range(left,right):
            if old_pixels[x,y][3]>250 and new_pixels[x,y][3]>250:
                samples.append((old_pixels[x,y],new_pixels[x,y]))
ratios = [sum(a[c] for a,b in samples)/max(1,sum(b[c] for a,b in samples)) for c in range(3)]
channels = aligned.split()
matched = [channels[c].point(lambda value:round(max(0,min(255,value*ratios[c])))) for c in range(3)]
aligned = Image.merge('RGBA',tuple(matched+[channels[3]]))
curved = aligned.copy()
for x in range(53,459):
    alpha = aligned.getchannel('A').crop((x,0,x+1,512))
    column_bounds = alpha.point(lambda value:255 if value>=128 else 0).getbbox()
    if not column_bounds or column_bounds[3]<=397:
        continue
    old_bottom = column_bounds[3]
    target_bottom = min(old_bottom,round(433-.00115*(x-256)**2))
    target_bottom = max(398,target_bottom)
    column = aligned.crop((x,396,x+1,old_bottom+2))
    column = column.resize((1,target_bottom-396+2),Image.Resampling.LANCZOS)
    curved.paste((0,0,0,0),(x,396,x+1,512))
    curved.paste(column,(x,396))
aligned = curved
repair = Image.new('L',(512,512),0)
repair_pixels = repair.load()
for y in range(396,512):
    value = round(min(1,(y-396)/16)*255)
    for x in range(512):
        repair_pixels[x,y] = value
body = Image.composite(aligned,original_body,repair)
body.save(SOURCE/'body-complete.png')
repair.save(SOURCE/'body-repair-mask.png')
aligned.save(SOURCE/'body-repair-aligned.png')

generated_foot = Image.open(SOURCE/'foot-repair-generated.png').convert('RGBA')
foot_bounds = generated_foot.getchannel('A').point(lambda value:255 if value>=128 else 0).getbbox()
generated_foot = generated_foot.crop(foot_bounds)
for side in ['left','right']:
    original = Image.open(SOURCE/('original-foot-'+side+'.png')).convert('RGBA')
    bounds = original.getchannel('A').getbbox()
    width = bounds[2]-bounds[0]
    top = bounds[1]-12
    pad = generated_foot.resize((width,bounds[3]-top),Image.Resampling.LANCZOS)
    complete = Image.new('RGBA',(512,512),(0,0,0,0))
    complete.alpha_composite(pad,(bounds[0],top))
    old,new = original.load(),complete.load()
    preserved_start = bounds[1]+6
    for x in range(bounds[0],bounds[2]):
        reference = next((old[x,y] for y in range(preserved_start,bounds[3]) if old[x,y][3]>240),None)
        if reference:
            for y in range(preserved_start-6,preserved_start):
                pixel = new[x,y]
                blend = (y-(preserved_start-6))/5
                rgb = [round(pixel[c]*(1-blend)+reference[c]*blend) for c in range(3)]
                new[x,y] = tuple(rgb+[pixel[3]])
    for y in range(preserved_start,512):
        for x in range(512):
            new[x,y] = old[x,y]
    complete.save(SOURCE/('foot-'+side+'.png'))

notes = {'scope':'The lower contact band of the original body and the previously missing upper foot contours are repaired. Original face and body pixels above source y=396 are unchanged.','bodyColorMatch':ratios,'bodyRepairMask':'source/body-repair-mask.png','footVisibleLowerPixels':'Original source rows y>=426 retained exactly.','layering':'Complete feet behind the continuous body silhouette; exposed upper contours exist for every pose.'}
(ROOT/'source-repair.json').write_bytes((json.dumps(notes)+'\r\n').encode('utf-8'))
print(json.dumps({'bodyBounds':body.getchannel('A').getbbox(),'footTop':408,'originalFrontPreservedAboveY':396}))
