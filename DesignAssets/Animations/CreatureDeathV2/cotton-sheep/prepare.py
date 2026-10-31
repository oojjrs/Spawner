from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

folder = Path(__file__).resolve().parent
source = folder / 'Source'
parts = folder / 'Parts'
parts.mkdir(0o777, False, True)
original = Image.open(source / 'reference.png').convert('RGBA')
closed = Image.open(source / 'blink-closed.png').convert('RGBA')
atlas = Image.open(source / 'complete-parts-atlas.png').convert('RGBA')

def clean(region):
    value = atlas.crop(region)
    array = np.array(value)
    mask = Image.fromarray(np.uint8(array[:, :, 3] > 70) * 255)
    support = mask.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
    box = support.getbbox()
    array[:, :, 3] = np.minimum(array[:, :, 3], np.asarray(support))
    array[array[:, :, 3] < 16] = 0
    return Image.fromarray(array).crop(box)

def fit(image, target):
    left, top, right, bottom = target
    scale = min((right - left) / image.width, (bottom - top) / image.height)
    dimensions = (round(image.width * scale), round(image.height * scale))
    resized = image.resize(dimensions, Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (512, 512))
    out.alpha_composite(resized, (round((left + right - resized.width) / 2), round((top + bottom - resized.height) / 2)))
    return out

def polygon(points):
    out = Image.new('L', (512, 512))
    ImageDraw.Draw(out).polygon(points, 255)
    return np.asarray(out).astype(float) / 255

specs = [
    ('far-ear', [(58,181),(104,165),(134,171),(132,192),(120,203),(110,226),(91,235),(65,224),(55,207)], (54,165,147,236), (0,512,550,1024)),
    ('head', [(101,165),(109,136),(125,113),(149,96),(176,82),(201,83),(222,78),(252,83),(278,88),(300,108),(312,130),(328,160),(330,191),(328,217),(303,224),(275,224),(244,216),(241,265),(233,283),(222,294),(201,301),(181,299),(159,294),(140,290),(118,284),(101,271),(99,250),(105,234),(112,214),(113,197),(104,181)], (98,79,328,322), (580,0,1060,512)),
    ('near-ear', [(241,215),(268,220),(289,234),(313,251),(326,267),(318,280),(301,287),(276,281),(253,270),(239,250)], (236,209,332,292), (1060,0,1536,512)),
    ('far-foreleg', [(177,357),(215,361),(221,382),(213,410),(193,423),(165,419),(156,403),(167,379)], (158,324,222,424), (580,512,1060,1024)),
    ('near-foreleg', [(230,369),(272,371),(286,412),(278,438),(250,444),(229,438),(220,421)], (219,323,287,445), (580,512,1060,1024)),
    ('far-hindleg', [(311,340),(347,341),(351,374),(340,392),(308,395),(297,383)], (294,299,355,397), (1060,512,1536,1024)),
    ('near-hindleg', [(374,331),(413,330),(426,387),(412,410),(381,415),(360,399)], (359,294,429,417), (1060,512,1536,1024)),
]
raw = np.asarray(original)
alpha = raw[:, :, 3].astype(float) / 255
order = ['far-hindleg','far-foreleg','near-hindleg','near-foreleg','body','far-ear','head','near-ear','collar','ear-root']
owners = np.full((512,512), order.index('body'))
textures = {'body': fit(clean((0,0,580,512)), (120,158,450,395))}
for name, points, target, region in specs:
    owners[polygon(points) > 0] = order.index(name)
    textures[name] = fit(clean(region), target)
head_limit = polygon([(0,0),(512,0),(512,249),(241,249),(233,268),(214,282),(187,287),(159,287),(132,280),(115,267),(109,249),(0,249)])
head_pixels = np.asarray(textures['head']).copy()
head_pixels[:,:,3] = np.uint8(head_pixels[:,:,3] * head_limit)
textures['head'] = Image.fromarray(head_pixels)
collar = polygon([(108,284),(148,281),(190,285),(224,282),(263,290),(275,332),(242,365),(168,365),(123,339),(105,313)]) > 0
owners[collar & (owners == order.index('body'))] = order.index('collar')
ear_root = polygon([(231,193),(266,199),(278,221),(252,228),(234,217)]) > 0
owners[ear_root & (owners == order.index('head'))] = order.index('ear-root')
textures['collar'] = original.copy()
textures['ear-root'] = original.copy()
for name in order:
    index = order.index(name)
    own = owners == index
    hidden = (owners > index) & (raw[:, :, 3] >= 200)
    data = np.asarray(textures[name]).copy()
    allowed = own | hidden
    if name in ['collar','ear-root']:
        allowed = own
    if name in ['body','head']:
        allowed = np.ones((512,512), bool)
    data[:, :, 3] = np.uint8(data[:, :, 3] * allowed)
    visible_pixels = own
    if name in ['body','head']:
        visible_pixels = np.zeros((512,512), bool)
    if name == 'collar':
        data = np.asarray(textures['body']).copy()
        data[:, :, 3] = np.uint8(data[:, :, 3] * own)
        visible_pixels = np.zeros((512,512), bool)
    if name == 'ear-root':
        data = np.asarray(textures['head']).copy()
        data[:, :, 3] = np.uint8(data[:, :, 3] * own)
        visible_pixels = np.zeros((512,512), bool)
    data[visible_pixels] = raw[visible_pixels]
    Image.fromarray(data).save(parts / (name + '.png'))
    visible_image = raw.copy()
    visible_image[:, :, 3] = np.uint8(visible_image[:, :, 3] * own)
    Image.fromarray(visible_image).save(source / (name + '-original.png'))
def pupil_bounds(image, region, center):
    values = np.asarray(image)
    selection = (values[:,:,0] < 80) & (values[:,:,1] < 140) & (values[:,:,2] < 125) & (values[:,:,3] > 128)
    window = np.zeros((512,512), bool)
    left,top,right,bottom = region
    window[top:bottom,left:right] = True
    positions = np.argwhere(selection & window)
    start = positions[np.argmin((positions[:,1]-center[0])**2 + (positions[:,0]-center[1])**2)]
    stack = [(int(start[0]),int(start[1]))]
    visited = set(stack)
    found = []
    while stack:
        y,x = stack.pop()
        found.append((x,y))
        for dy,dx in [(0,1),(0,-1),(1,0),(-1,0)]:
            yy,xx = y+dy,x+dx
            if top <= yy < bottom and left <= xx < right and selection[yy,xx] and (yy,xx) not in visited:
                visited.add((yy,xx))
                stack.append((yy,xx))
    points = np.array(found)
    return (int(points[:,0].min()),int(points[:,1].min()),int(points[:,0].max())+1,int(points[:,1].max())+1)

head = Image.open(parts / 'head.png').convert('RGBA')
old_open = Image.open(source / 'blink-neutral.png').convert('RGBA')
for index,old_region,new_region,old_center,new_center in [
    (0,(116,207,140,249),(117,192,147,241),(127,227),(129,215)),
    (1,(182,223,231,272),(184,216,240,273),(206,248),(211,240))
]:
    old_box = pupil_bounds(old_open,old_region,old_center)
    new_box = pupil_bounds(head,new_region,new_center)
    mask_image = Image.open(source / ('blink-eye-mask-'+str(index)+'.png')).convert('L')
    box = mask_image.getbbox()
    sx = (new_box[2]-new_box[0])/(old_box[2]-old_box[0])
    sy = (new_box[3]-new_box[1])/(old_box[3]-old_box[1])
    target = (round(new_box[0]+(box[0]-old_box[0])*sx),round(new_box[1]+(box[1]-old_box[1])*sy),round(new_box[0]+(box[2]-old_box[0])*sx),round(new_box[1]+(box[3]-old_box[1])*sy))
    dimensions = (target[2]-target[0],target[3]-target[1])
    patch = closed.crop(box).resize(dimensions,Image.Resampling.LANCZOS)
    mask = mask_image.crop(box).resize(dimensions,Image.Resampling.LANCZOS)
    original_region = np.asarray(head.crop(target)).astype(float)
    data = np.asarray(patch).astype(float)
    ring = np.asarray(mask) < 35
    correction = np.median(original_region[ring,:3],0)-np.median(data[ring,:3],0)
    data[:,:,:3] = np.clip(data[:,:,:3]+correction,0,255)
    patch = Image.fromarray(np.uint8(data))
    head.paste(patch,(target[0],target[1]),mask)
head.save(parts / 'head-closed.png')
assembly = Image.new('RGBA', (512,512))
for name in order:
    assembly.alpha_composite(Image.open(parts / (name+'.png')).convert('RGBA'))
assembly.save(folder / 'neutral-reassembled.png')
print('Prepared complete static sheep attachments.')
