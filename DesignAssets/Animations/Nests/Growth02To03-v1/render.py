import sys
from pathlib import Path
from riglib import *

WORK = Path(__file__).resolve().parent
ROOT = WORK
OLD = WORK / 'Sources/Level02-v3'
OLD_SHEETS = {}
DRAFT = '--draft' in sys.argv
DRAFT_FRAMES = [0, 18, 23, 30, 43, 50, 58, 65, 67, 68, 74, 80]
MATERIALS = {}

def cell(tribe, columns, rows, index):
    source = Image.open(WORK / tribe / 'parts-atlas.png').convert('RGBA')
    pixels = np.array(source)
    mask = np.uint8(pixels[:, :, 3] > 215)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    count, labels, stats, centers = cv2.connectedComponentsWithStats(mask, 8)
    col, row = index % columns, index // columns
    chosen = [i for i in range(1, count) if stats[i, 4] > 80 and col * source.width / columns <= centers[i, 0] < (col + 1) * source.width / columns and row * source.height / rows <= centers[i, 1] < (row + 1) * source.height / rows]
    if not chosen:
        raise ValueError(('Missing atlas part', tribe, index))
    full = np.uint8(np.isin(labels, chosen))
    contours, unused = cv2.findContours(full, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(full, contours, -1, 1, -1)
    yy, xx = np.where(full)
    box = (max(0, int(xx.min()) - 1), max(0, int(yy.min()) - 1), min(source.width, int(xx.max()) + 2), min(source.height, int(yy.max()) + 2))
    pixels[:, :, 3] = np.minimum(pixels[:, :, 3], full * 255)
    pixels[:, :, 3][pixels[:, :, 3] > 235] = 255
    return Image.fromarray(pixels, 'RGBA').crop(box)

def old_frame(tribe, index):
    if index == 60:
        return premul(Image.open(WORK / tribe / 'start.png'))
    if tribe not in OLD_SHEETS:
        OLD_SHEETS[tribe] = Image.open(OLD / tribe / 'growth.png').convert('RGBA')
    image = OLD_SHEETS[tribe]
    x, y = index % 8 * 512, index // 8 * 512
    return premul(image.crop((x, y, x + 512, y + 512)))

def complete(source, owner, part, fill, occluders):
    hidden = np.isin(owner, occluders) & (source[:, :, 3] > .99)
    return over(source * (owner == part)[:, :, None], fill * hidden[:, :, None])

def controls(layer, anchors):
    return contour_points(layer, anchors)

def solid_morph(a, b, pa, pb, q, root, joint, angle):
    if q <= 0:
        return a.copy()
    if q >= 1:
        return b.copy()
    weight = np.clip(np.linalg.norm(pa - np.array(root), axis=1) / 160, 0, 1)
    posed = skin(pa, root, joint, angle * q, -angle * .45 * q, weight)
    end = skin(pa, root, joint, angle, -angle * .45, weight)
    posed += (pb - end) * q
    for layer in [a, b]:
        if id(layer) not in MATERIALS:
            MATERIALS[id(layer)] = (layer, padded_material(layer))
    aa = tps(MATERIALS[id(a)][1], pa, posed)
    bb = tps(MATERIALS[id(b)][1], pb, posed)
    shape = np.zeros((512, 512), np.uint8)
    cv2.fillPoly(shape, [np.int32(posed[:-1] * 8)], 255, cv2.LINE_AA, 3)
    return (aa * (1 - q) + bb * q) * (shape.astype(np.float32) / 255)[:, :, None]

def clean_surface(layer, material):
    mask = np.uint8(layer[:, :, 3] > .12)
    contours, unused = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    shape = np.zeros((512, 512), np.uint8)
    cv2.drawContours(shape, [max(contours, key=cv2.contourArea)], -1, 1, -1)
    inside = np.uint8(layer[:, :, 3] > .95)
    rgb = layer[:, :, :3] / np.maximum(layer[:, :, 3:4], 1e-6)
    supplied = material[:, :, :3] / np.maximum(material[:, :, 3:4], 1e-6)
    rgb = np.where((inside == 0)[:, :, None], supplied, rgb)
    return np.concatenate([rgb * shape[:, :, None], shape[:, :, None].astype(np.float32)], 2)

def growing_rigid(layer, pivot, progress, angle, opened):
    if progress <= 0:
        return np.zeros_like(layer)
    rotation = angle * (1 - opened)
    moved = affine(layer, pivot, (1, 1), rotation, ((256 - pivot[0]) * (1 - progress), (400 - pivot[1]) * (1 - progress)))
    clip = np.uint8(Y <= 448)
    return moved * clip[:, :, None]

def arm(layer, pivot, parent, parent_angle, local_angle, progress):
    if progress <= 0:
        return np.zeros_like(layer)
    radians = math.radians(parent_angle)
    delta = np.array(pivot) - np.array(parent)
    shift = np.array([[math.cos(radians), -math.sin(radians)], [math.sin(radians), math.cos(radians)]]) @ delta - delta
    moved = affine(layer, pivot, (1, 1), parent_angle + local_angle, (float(shift[0]) + (256 - parent[0]) * (1 - progress), float(shift[1]) + (400 - parent[1]) * (1 - progress)))
    return moved * np.uint8(Y <= 448)[:, :, None]

def opening_texture(path, side, fraction, old_points, end_points, old_anchors, end_anchors):
    atlas = Image.open(path).convert('RGBA')
    index = 1 if fraction < .5 else 2
    row = 0 if side == 1 else 1
    image = atlas.crop((round(index * atlas.width / 4), round(row * atlas.height / 2), round((index + 1) * atlas.width / 4), round((row + 1) * atlas.height / 2)))
    ob = old_points.min(0)
    oe = old_points.max(0)
    nb = end_points.min(0)
    ne = end_points.max(0)
    corner = ob * (1 - fraction) + nb * fraction
    opposite = oe * (1 - fraction) + ne * fraction
    layer = normalize(image, (int(corner[0]), int(corner[1]), int(opposite[0]) + 1, int(opposite[1]) + 1))
    anchors = np.array(old_anchors) * (1 - fraction) + np.array(end_anchors) * fraction
    source_points = controls(layer, anchors.tolist())
    target_points = old_points * (1 - fraction) + end_points * fraction
    layer = tps(layer, source_points, target_points)
    shape = np.zeros((512, 512), np.uint8)
    cv2.fillPoly(shape, [np.int32(target_points[:-1])], 1)
    return clean_surface(layer * shape[:, :, None], padded_material(layer)), target_points

def turn_wheel(layer, pivot, radius, degrees):
    radians = math.radians(degrees)
    dx = (X - pivot[0]) / radius[0]
    dy = (Y - pivot[1]) / radius[1]
    sx = pivot[0] + (dx * math.cos(radians) + dy * math.sin(radians)) * radius[0]
    sy = pivot[1] + (-dx * math.sin(radians) + dy * math.cos(radians)) * radius[1]
    return cv2.remap(layer, sx.astype(np.float32), sy.astype(np.float32), cv2.INTER_LINEAR, cv2.BORDER_CONSTANT)

def finish(tribe, frames, rig):
    folder = WORK / tribe
    if DRAFT:
        contact = Image.new('RGB', (1536, 1152), '#13201c')
        for at, index in enumerate(DRAFT_FRAMES):
            image = preview(rgba(frames[index])).resize((384, 384), Image.Resampling.LANCZOS)
            contact.paste(image, (at % 4 * 384, at // 4 * 384))
        contact.save(folder / 'contact-draft.png')
        MATERIALS.clear()
        print(tribe + ' draft rendered', flush=True)
        return
    export([rgba(frame) for frame in frames], folder, {'method': 'drawn-keys-layered-local-rigs', 'source': 'Parts'})
    sheet = Image.open(folder / 'growth.png')
    contact = Image.new('RGB', (1536, 768), '#13201c')
    for at, index in enumerate([0, 18, 30, 43, 50, 58, 68, 80]):
        image = preview(rgba(frames[index])).resize((384, 384), Image.Resampling.LANCZOS)
        contact.paste(image, (at % 4 * 384, at // 4 * 384))
    contact.save(folder / 'contact.png')
    metadata = json.loads((folder / 'animation.json').read_text('utf-8'))
    metadata['markersMs'] = {'closeStart': 500, 'closed': 1180, 'assemblyStart': 1420, 'assemblyEnd': 2180, 'openStart': 2220, 'openEnd': 3180, 'mechanismStart': 3180, 'mechanismEnd': 3660}
    metadata['audio'] = {'src': 'DesignAssets/Audio/NestGrowth02To03-v1/' + tribe + '.mp3', 'startMs': 500, 'volume': 1, 'loop': False, 'sourceProcessing': 'none'}
    metadata['previewRepeats'] = True
    rig['timeline'] = {'keys': [0, 18, 23, 43, 68, 80], 'frameStepMs': 40, 'initialHoldMs': 500, 'finalHoldMs': 900, 'assemblyInsideClosedNest': True}
    rig['parts'] = [path.name for path in sorted((folder / 'Parts').glob('*.png'))]
    rig['sources'] = {'start': 'start.png', 'end': 'end.png', 'layerArt': 'parts-atlas.png', 'closingInput': '../Sources/Level02-v3/' + tribe + '/growth.png'}
    rig['closingFrames'] = [round(60 - 27 * smooth(index / 18)) for index in range(19)]
    json_write(folder / 'animation.json', metadata)
    json_write(folder / 'rig.json', rig)
    print(tribe + ' exported', flush=True)
    MATERIALS.clear()

def sprout():
    tribe = 'sprout'
    folder = WORK / tribe
    parts_path = folder / 'Parts'
    parts_path.mkdir(511, True, True)
    source = premul(Image.open(folder / 'end.png'))
    owner = np.full((512, 512), 5, np.uint8)
    owner[(Y > 350) | ((X < 110) & (Y > 306)) | ((X > 402) & (Y > 306))] = 0
    petal = [(256, 365), (232, 319), (208, 288), (186, 260), (174, 239), (179, 221), (198, 216), (212, 205), (214, 192), (203, 180), (176, 176), (148, 191), (118, 220), (98, 251), (98, 314), (118, 341), (166, 366)]
    owner[poly(petal)] = 1
    owner[poly([(512 - x, y) for x, y in petal])] = 2
    hsv = cv2.cvtColor(np.uint8(rgba(source))[:, :, :3], cv2.COLOR_RGB2HSV)
    wood = ((hsv[:, :, 0] < 40) & (hsv[:, :, 1] > 65) & (hsv[:, :, 2] > 40)).astype(np.uint8)
    wood = cv2.morphologyEx(wood, cv2.MORPH_CLOSE, np.ones((17, 17), np.uint8))
    wood = cv2.dilate(wood, np.ones((5, 5), np.uint8)) > 0
    center = poly([(150, 138), (216, 138), (244, 186), (260, 192), (275, 184), (294, 138), (358, 138), (344, 220), (334, 249), (316, 269), (300, 319), (274, 350), (256, 361), (228, 349), (209, 321), (192, 275), (172, 254)])
    owner[(owner == 5) & ~center & (Y < 373) & (X < 256)] = 1
    owner[(owner == 5) & ~center & (Y < 373) & (X >= 256)] = 2
    left_lower = poly([(90, 286), (115, 284), (126, 299), (126, 314), (150, 338), (159, 351), (154, 367), (140, 374), (124, 364), (121, 352), (98, 327), (90, 313)])
    left_upper = poly([(150, 182), (164, 185), (155, 207), (140, 219), (131, 237), (117, 258), (105, 278), (96, 288), (83, 282), (94, 260), (106, 240), (118, 217), (138, 196)])
    for part, region in [(6, left_lower), (7, left_upper), (8, np.fliplr(left_lower)), (9, np.fliplr(left_upper))]:
        owner[region & wood] = part
    owner[poly([(25, 232), (93, 216), (118, 250), (103, 296), (39, 289)])] = 10
    owner[(Y >= 353) & (Y < 385) & (X > 112) & (X < 399) & wood] = 11
    pale_hardware = np.uint8(np.isin(owner, [6, 7, 8, 9, 10, 11]) & (hsv[:, :, 1] < 60) & (hsv[:, :, 2] > 145))
    component_count, component_labels, component_stats, unused = cv2.connectedComponentsWithStats(pale_hardware, 8)
    bad = [i for i in range(1, component_count) if component_stats[i, 4] > 30]
    repaired = np.isin(component_labels, bad)
    owner[repaired & (Y < 366) & (X < 256)] = 1
    owner[repaired & (Y < 366) & (X >= 256)] = 2
    owner[repaired & (Y >= 366)] = 0
    owner[(owner == 0) & (Y < 379)] = 12
    fills = {
        1: normalize(cell(tribe, 2, 3, 0), (111, 180, 258, 368)),
        2: normalize(cell(tribe, 2, 3, 1), (254, 180, 401, 368)),
        5: normalize(cell(tribe, 2, 3, 2), (160, 139, 353, 361)),
        0: normalize(cell(tribe, 2, 3, 3), (27, 304, 484, 448)),
        6: normalize(cell(tribe, 2, 3, 4), (88, 283, 164, 373)),
        8: normalize(cell(tribe, 2, 3, 5), (348, 283, 424, 373))
    }
    layers = {part: source * (owner == part)[:, :, None] for part in [0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12]}
    for part in [1, 2, 5, 6, 8]:
        occluders = [6, 7, 8, 9, 10, 11] if part in [1, 2] else [1, 2, 6, 7, 8, 9, 10, 11]
        layers[part] = complete(source, owner, part, fills[part], occluders)
    for part in [1, 2]:
        layers[part] = clean_surface(layers[part], padded_material(fills[part]))
    leaf_left = poly([(119, 400), (134, 377), (164, 361), (191, 359), (219, 369), (248, 388), (253, 399), (232, 414), (207, 428), (172, 433), (136, 422), (118, 410)])
    leaf_right = np.fliplr(leaf_left)
    heart = poly([(229, 410), (244, 395), (256, 392), (274, 402), (286, 421), (273, 440), (254, 449), (235, 438)])
    natural_base = over(layers[0], layers[12])
    base_masks = {13: leaf_left & ~heart, 14: leaf_right & ~heart, 15: heart}
    base_extras = natural_base.copy()
    for part, mask in base_masks.items():
        leaf = natural_base * mask[:, :, None]
        leaf = clean_surface(leaf, padded_material(fills[0]))
        layers[part] = leaf
        base_extras *= (~mask)[:, :, None]
    old_leaves = {13: premul(Image.open(OLD / tribe / 'Parts/2-1.png')), 14: premul(Image.open(OLD / tribe / 'Parts/2-2.png')), 15: premul(Image.open(OLD / tribe / 'Parts/2-3.png'))}
    base_old_anchors = {13: [(253, 400), (180, 363), (119, 415), (169, 431)], 14: [(259, 400), (332, 363), (393, 415), (343, 431)], 15: [(256, 451), (230, 428), (256, 402), (284, 428)]}
    base_new_anchors = {13: [(250, 394), (184, 365), (126, 404), (172, 425)], 14: [(262, 394), (328, 365), (386, 404), (340, 425)], 15: [(256, 447), (230, 420), (256, 395), (284, 420)]}
    base_old_points = {part: controls(old_leaves[part], base_old_anchors[part]) for part in base_masks}
    base_new_points = {part: controls(layers[part], base_new_anchors[part]) for part in base_masks}
    closed = old_frame(tribe, 33)
    bud_shape = [(256, 159), (290, 187), (323, 225), (352, 270), (375, 311), (380, 344), (364, 374), (328, 394), (282, 405), (256, 405), (213, 399), (174, 384), (143, 363), (130, 337), (138, 298), (156, 263), (184, 231), (215, 198)]
    bud_mask = poly(bud_shape)
    seam = [(256, 159), (252, 196), (263, 234), (261, 258), (251, 291), (246, 326), (250, 366), (256, 406)]
    left = poly([(0, 0)] + seam + [(0, 512)])
    old_parts = {0: closed * (~bud_mask)[:, :, None], 1: closed * (bud_mask & left)[:, :, None], 2: closed * (bud_mask & ~left)[:, :, None]}
    anchors_old = {1: [(254, 401), (256, 162), (136, 313), (181, 389)], 2: [(258, 401), (258, 163), (376, 313), (331, 389)], 0: [(256, 448), (105, 410), (256, 384), (432, 410)]}
    anchors_new = {1: [(254, 361), (201, 190), (117, 277), (178, 351)], 2: [(258, 361), (311, 190), (395, 277), (334, 351)], 0: [(256, 448), (64, 400), (256, 379), (448, 400)]}
    points_old = {i: controls(old_parts[i], anchors_old[i]) for i in [0, 1, 2]}
    points_new = {i: controls(layers[i], anchors_new[i]) for i in [0, 1, 2]}
    petal_keys = {}
    for part in [1, 2]:
        petal_keys[part] = [(old_parts[part], points_old[part])]
        for fraction in [1 / 3, 2 / 3]:
            key = opening_texture(folder / 'petal-keys.png', part, fraction, points_old[part], points_new[part], anchors_old[part], anchors_new[part])
            petal_keys[part].append(key)
            rgba(key[0]).save(parts_path / ('key-' + str(part) + '-' + str(round(fraction * 3)) + '.png'))
        petal_keys[part].append((layers[part], points_new[part]))
    pivots = {6: (145, 355), 7: (109, 301), 8: (367, 355), 9: (403, 301), 10: (65, 260), 11: (256, 370)}
    draw_order = [5, 7, 9, 10, 1, 2, 0, 11, 6, 8]
    for part, layer in layers.items():
        rgba(layer).save(parts_path / ('end-' + str(part) + '.png'))
    for part, layer in old_parts.items():
        rgba(layer).save(parts_path / ('closed-' + str(part) + '.png'))
    frames = []
    for index in range(81):
        if DRAFT and index not in DRAFT_FRAMES:
            frames.append(None)
            continue
        if index <= 18:
            value = old_frame(tribe, round(60 - 27 * smooth(index / 18)))
        elif index <= 23:
            value = closed.copy()
        else:
            build = smooth((index - 23) / 20)
            opened = smooth((index - 43) / 25)
            value = np.zeros_like(source)
            core = affine(layers[5], (256, 360), (1, 1), 0, (0, 80 * (1 - opened)))
            reveal = cv2.dilate(np.uint8(bud_mask), np.ones((max(1, int(opened * 250) + 1), max(1, int(opened * 250) + 1)), np.uint8))
            value = over(core * reveal[:, :, None], value)
            scale = max(.001, build)
            value = over(affine(base_extras, (256, 448), (scale, scale), 0, (0, 0)), value)
            for part in [7, 9, 10]:
                if part in [7, 9]:
                    direction = 1 if part == 7 else -1
                    rendered = arm(layers[part], pivots[part], pivots[6 if part == 7 else 8], direction * 14 * (1 - opened), -direction * 2 * (1 - opened), opened)
                else:
                    rendered = growing_rigid(layers[part], pivots[part], opened, 0, opened)
                value = over(rendered, value)
            for part in [1, 2]:
                span = min(2, int(opened * 3))
                first, last = petal_keys[part][span], petal_keys[part][span + 1]
                petal = solid_morph(first[0], last[0], first[1], last[1], opened * 3 - span, (256, 400), (200 if part == 1 else 312, 290), 0)
                value = over(petal, value)
            for part in [13, 14, 15]:
                base = solid_morph(old_leaves[part], layers[part], base_old_points[part], base_new_points[part], build, (256, 448), (256, 403), 0)
                value = over(base, value)
            for part in [11, 6, 8]:
                value = over(growing_rigid(layers[part], pivots[part], opened, 0 if part == 11 else 14 if part == 6 else -14, opened), value)
            if index >= 68:
                value = source.copy()
                wheel_mask = ((X - 64) / 18) ** 2 + ((Y - 260) / 25) ** 2 <= 1
                theta = 360 * smooth((index - 68) / 12)
                wheel = turn_wheel(source * wheel_mask[:, :, None], (64, 260), (18, 25), theta)
                value = over(wheel, source * (~wheel_mask)[:, :, None])
                if index == 80:
                    value = source.copy()
        frames.append(value)
    rig = {'root': [256, 448], 'drawOrder': draw_order, 'bones': [{'name': 'root', 'parent': None, 'pivot': [256, 448]}] + [{'name': 'part-' + str(i), 'parent': 'root', 'pivot': p, 'rigid': True} for i, p in pivots.items()], 'surfaceControls': {'closed': {i: v.tolist() for i, v in points_old.items()}, 'end': {i: v.tolist() for i, v in points_new.items()}}, 'keys': [0, 18, 23, 43, 68, 80], 'assemblyFrames': [23, 43], 'openFrames': [43, 68], 'closingSource': 'Growth01To02-v3/reverse-frames-60-to-33'}
    for bone in rig['bones']:
        if bone['name'] == 'part-7':
            bone['parent'] = 'part-6'
        if bone['name'] == 'part-9':
            bone['parent'] = 'part-8'
    rig['petalKeys'] = {part: [{'image': 'closed-' + str(part) + '.png' if index == 0 else 'end-' + str(part) + '.png' if index == 3 else 'key-' + str(part) + '-' + str(index) + '.png', 'controls': key[1].tolist()} for index, key in enumerate(keys)] for part, keys in petal_keys.items()}
    rig['baseControls'] = {'closed': {part: value.tolist() for part, value in base_old_points.items()}, 'end': {part: value.tolist() for part, value in base_new_points.items()}}
    rig['deformation'] = 'Registered drawn petal keys with local TPS surface meshes; rigid articulated support arms use FK.'
    finish(tribe, frames, rig)

def red_cap(image, limit_y):
    pixels = np.array(image)
    rgb = pixels[:, :, :3].astype(float)
    candidate = np.uint8((rgb[:, :, 0] > rgb[:, :, 1] * 1.12) & (rgb[:, :, 0] > rgb[:, :, 2] * 1.1) & (pixels[:, :, 3] > 100) & (Y < limit_y))
    candidate = cv2.morphologyEx(candidate, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
    contours, unused = cv2.findContours(candidate, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    mask = np.zeros((512, 512), np.uint8)
    cv2.drawContours(mask, [max(contours, key=cv2.contourArea)], -1, 1, -1)
    return cv2.dilate(mask, np.ones((3, 3), np.uint8)) > 0

def save_layers(folder, layers):
    destination = folder / 'Parts'
    destination.mkdir(511, True, True)
    for key, layer in layers.items():
        rgba(layer).save(destination / (str(key) + '.png'))

def spore():
    tribe = 'spore'
    folder = WORK / tribe
    source = premul(Image.open(folder / 'end.png'))
    closed = old_frame(tribe, 33)
    old_image = rgba(closed)
    old_mask = red_cap(old_image, 480)
    old_front = closed * old_mask[:, :, None]
    old_body = premul(Image.open(OLD / tribe / 'Parts/2-0.png'))
    owner = np.zeros((512, 512), np.uint8)
    cap_mask = red_cap(Image.open(folder / 'end.png'), 330)
    owner[cap_mask] = 1
    secondary = poly([(335, 280), (366, 278), (408, 291), (456, 311), (469, 325), (439, 337), (400, 321), (367, 304)])
    owner[secondary] = 7
    owner[poly([(44, 239), (67, 221), (132, 223), (158, 241), (159, 279), (130, 300), (60, 300), (43, 280)])] = 2
    owner[poly([(344, 237), (371, 220), (431, 223), (460, 246), (461, 285), (431, 306), (367, 302), (345, 281)])] = 3
    collar = poly([(183, 229), (313, 229), (323, 290), (186, 294)])
    posts = poly([(158, 224), (183, 225), (184, 314), (157, 316)]) | poly([(305, 225), (330, 227), (329, 315), (307, 315)])
    owner[collar | posts] = 4
    owner[poly([(391, 313), (496, 314), (498, 420), (413, 427), (383, 397)])] = 5
    pixels = np.array(Image.open(folder / 'end.png'))
    hsv = cv2.cvtColor(pixels[:, :, :3], cv2.COLOR_RGB2HSV)
    red_pixels = ((hsv[:, :, 0] < 12) | (hsv[:, :, 0] > 173)) & (hsv[:, :, 1] > 50) & (pixels[:, :, 1].astype(float) < pixels[:, :, 2].astype(float) * 1.45) & (Y < 330)
    owner[red_pixels & ~secondary] = 1
    owner[red_pixels & secondary] = 7
    owner[poly([(190, 239), (313, 239), (320, 292), (187, 294)])] = 4
    owner[poly([(171, 223), (185, 231), (177, 307), (163, 315), (156, 309), (164, 236)])] = 4
    owner[poly([(310, 229), (325, 226), (331, 309), (317, 315), (308, 305)])] = 4
    fill = normalize(cell(tribe, 4, 2, 2), (91, 214, 430, 448))
    body = complete(source, owner, 0, fill, [1, 2, 3, 4, 5, 7])
    body = clean_surface(body, padded_material(fill))
    cap = source * (owner == 1)[:, :, None]
    material = normalize(cell(tribe, 4, 2, 0), (29, 114, 460, 303))
    cap = clean_surface(cap, padded_material(material))
    lip = np.interp(np.arange(512), [0, 32, 84, 142, 208, 256, 300, 358, 413, 458, 511], [238, 238, 216, 196, 221, 229, 219, 197, 221, 238, 238])
    front = cap * np.clip((lip[None, :] - Y + 2) / 2, 0, 1)[:, :, None]
    underside = cap * np.clip((Y - lip[None, :] + 2) / 2, 0, 1)[:, :, None]
    layers = {0: body, 1: front, 6: underside}
    for part in [2, 3, 4, 5, 7]:
        layers[part] = source * (owner == part)[:, :, None]
    pa = controls(old_front, [(256, 227), (51, 364), (256, 416), (456, 364)])
    pb = controls(front, [(251, 115), (32, 238), (256, 228), (459, 238)])
    ba = controls(old_body, [(256, 448), (92, 410), (256, 238), (430, 409)])
    bb = controls(body, [(256, 448), (92, 404), (256, 214), (430, 404)])
    pivots = {2: (139, 265), 3: (366, 265), 4: (256, 268), 5: (436, 414), 7: (390, 303)}
    save_layers(folder, layers)
    save_layers(folder, {'closed-cap': old_front, 'closed-body': old_body})
    frames = []
    for index in range(81):
        if DRAFT and index not in DRAFT_FRAMES:
            frames.append(None)
            continue
        if index <= 18:
            value = old_frame(tribe, round(60 - 27 * smooth(index / 18)))
        elif index <= 23:
            value = closed.copy()
        else:
            build = smooth((index - 23) / 20)
            opened = smooth((index - 43) / 25)
            value = growing_rigid(layers[7], pivots[7], opened, 0, opened)
            under = affine(underside, (256, 244), (1, max(.001, opened)), 0, (0, 170 * (1 - opened)))
            if opened < .05:
                under[:] = 0
            else:
                old_columns = np.where(old_front[:, :, 3].max(0) > .1)[0]
                new_columns = np.where(front[:, :, 3].max(0) > .1)[0]
                left_bound = old_columns[0] * (1 - opened) + new_columns[0] * opened
                right_bound = old_columns[-1] * (1 - opened) + new_columns[-1] * opened
                under *= ((X >= left_bound) & (X <= right_bound))[:, :, None]
            value = over(under, value)
            core = solid_morph(old_body, body, ba, bb, build, (256, 448), (256, 330), 0)
            core *= np.uint8(Y >= 240 - 80 * opened)[:, :, None]
            value = over(core, value)
            for part in [2, 3, 4, 5]:
                value = over(growing_rigid(layers[part], pivots[part], opened, 0, opened), value)
            canopy = solid_morph(old_front, front, pa, pb, opened, (256, 300), (256, 240), 0)
            value = over(canopy, value)
            if index >= 68:
                value = source.copy()
                amount = math.sin(math.pi * (index - 68) / 12) * .13
                bellows = layers[5]
                top_mask = poly([(392, 322), (438, 312), (496, 325), (496, 344), (394, 347)])
                fold_mask = (X > 409) & (Y >= 345) & (Y < 405)
                moving = top_mask | fold_mask
                background = over(body * (owner == 5)[:, :, None], source * (owner != 5)[:, :, None])
                value = over(bellows * (~moving)[:, :, None], background)
                value = over(affine(bellows * fold_mask[:, :, None], (450, 405), (1, 1 - amount), 0, (0, 0)), value)
                value = over(affine(bellows * top_mask[:, :, None], (450, 344), (1, 1), 0, (0, 60 * amount)), value)
                if index == 80:
                    value = source.copy()
        frames.append(value)
    finish(tribe, frames, {'root': [256, 448], 'bones': [{'name': 'root', 'parent': None, 'pivot': [256, 448]}] + [{'name': 'part-' + str(k), 'parent': 'root', 'pivot': v, 'rigid': True} for k, v in pivots.items()], 'surfaces': {'bodyClosed': ba.tolist(), 'bodyOpen': bb.tolist(), 'capClosed': pa.tolist(), 'capOpen': pb.tolist()}, 'drawOrder': [7, 6, 0, 2, 3, 4, 5, 1], 'keys': [0, 18, 23, 43, 68, 80], 'bellows': {'pivot': [450, 405], 'foldRows': [345, 405], 'topMovesRigidly': True}})

def pebble():
    tribe = 'pebble'
    folder = WORK / tribe
    source = premul(Image.open(folder / 'end.png'))
    closed = old_frame(tribe, 33)
    owner = np.zeros((512, 512), np.uint8)
    shapes = {
        1: [(38, 280), (61, 247), (122, 221), (188, 212), (249, 220), (330, 229), (400, 251), (431, 287), (430, 320), (319, 328), (147, 329), (48, 307)],
        2: [(47, 305), (98, 300), (154, 315), (184, 342), (174, 374), (110, 378), (38, 365), (30, 340)],
        3: [(349, 314), (412, 307), (455, 323), (466, 355), (441, 380), (371, 380), (339, 355)],
        4: [(28, 378), (88, 367), (147, 374), (183, 405), (175, 443), (107, 449), (28, 429)],
        5: [(338, 384), (391, 374), (446, 381), (465, 419), (449, 445), (378, 450), (322, 430)],
        6: [(168, 184), (199, 163), (246, 159), (296, 164), (345, 180), (376, 200), (377, 215), (342, 228), (256, 220), (190, 212), (170, 202)],
        8: [(319, 194), (451, 196), (460, 226), (457, 318), (422, 321), (415, 261), (365, 233), (320, 229)],
        9: [(313, 210), (332, 202), (356, 211), (364, 233), (356, 254), (335, 264), (310, 250), (305, 229)],
        10: [(143, 291), (187, 278), (303, 278), (332, 289), (339, 313), (319, 329), (179, 330), (142, 318)],
        11: [(433, 313), (460, 306), (482, 317), (487, 348), (475, 367), (444, 369), (427, 352)]
    }
    for part in [1, 4, 5, 2, 3, 6, 8, 9, 10, 11]:
        owner[poly(shapes[part])] = part
    portal = poly([(153, 321), (334, 321), (355, 438), (145, 438)])
    known = (owner != 0) & (source[:, :, 3] > .1)
    distance, nearest = cv2.distanceTransformWithLabels(np.uint8(~known), cv2.DIST_L2, 5, None, None, cv2.DIST_LABEL_PIXEL)
    ids = np.zeros(int(nearest.max()) + 1, np.uint8)
    ids[nearest[known]] = owner[known]
    missing = (owner == 0) & ~portal & (source[:, :, 3] > .01)
    owner[missing] = ids[nearest[missing]]
    layers = {part: source * (owner == part)[:, :, None] for part in [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11]}
    for part, cell_index, box in [(1, 0, (38, 210, 439, 331)), (2, 1, (30, 300, 188, 381)), (3, 2, (337, 304, 468, 384)), (4, 3, (27, 366, 187, 450)), (5, 4, (319, 373, 469, 451)), (6, 5, (168, 160, 380, 229)), (8, 7, (319, 195, 459, 323)), (9, 8, (305, 201, 364, 264)), (10, 9, (141, 278, 341, 331)), (11, 10, (426, 305, 488, 371))]:
        fill = normalize(cell(tribe, 4, 3, cell_index), box)
        priority = [1, 6, 4, 5, 2, 3, 8, 9, 11, 10]
        occluders = priority[priority.index(part) + 1:]
        layers[part] = complete(source, owner, part, fill, occluders)
    floor = normalize(cell(tribe, 4, 3, 6), (150, 301, 355, 438))
    floor *= poly([(162, 320), (331, 320), (355, 438), (146, 438)])[:, :, None]
    layers[0] = over(layers[0], floor)
    pivots = {1: (256, 276), 2: (107, 342), 3: (402, 345), 4: (107, 420), 5: (396, 420), 6: (267, 200), 8: (438, 307), 9: (335, 233), 10: (244, 305), 11: (457, 338)}
    previous_rig = json.loads((OLD / tribe / 'rig.json').read_text('utf-8'))
    previous_layers = {}
    for part in range(1, 8):
        pivot = previous_rig['pivots'][str(part)]
        position, scale, angle = previous_rig['keyPoses']['grown'][str(part)]
        texture = premul(Image.open(OLD / tribe / 'Parts' / (str(part) + '.png')))
        previous_layers[part] = affine(texture, pivot, (scale, scale), angle, (position[0] - pivot[0], position[1] - pivot[1]))
    front_left = over(previous_layers[2], previous_layers[4])
    front_right = over(previous_layers[3], previous_layers[5])
    back = over(previous_layers[7], over(previous_layers[6], previous_layers[1]))
    save_layers(folder, layers)
    save_layers(folder, {'old-left-closure': front_left, 'old-right-closure': front_right})
    frames = []
    for index in range(81):
        if DRAFT and index not in DRAFT_FRAMES:
            frames.append(None)
            continue
        if index <= 18:
            value = old_frame(tribe, round(60 - 27 * smooth(index / 18)))
        elif index <= 23:
            value = closed.copy()
        else:
            build = smooth((index - 23) / 20)
            opened = smooth((index - 43) / 25)
            core = back.copy()
            if build >= 1:
                core *= (source[:, :, 3] > .1)[:, :, None]
            value = core
            if opened > 0:
                value = over(growing_rigid(layers[0], (256, 448), opened, 0, opened), value)
            for part in [1, 6, 8, 9, 11]:
                delay = .12 if part in [6, 8, 9, 11] else 0
                born = smooth((opened - delay) / (1 - delay))
                value = over(growing_rigid(layers[part], pivots[part], born, 0, opened), value)
            gate = affine(layers[10], pivots[10], (1, 1), 0, ((256 - pivots[10][0]) * (1 - opened), 100 * (1 - opened)))
            gate *= np.uint8(Y <= 448)[:, :, None]
            value = over(gate, value)
            value = over(front_right if opened <= 0 else affine(front_right, (300, 390), (1, 1), 0, (80 * opened, -5 * opened)), value)
            value = over(front_left if opened <= 0 else affine(front_left, (202, 390), (1, 1), 0, (-94 * opened, 0)), value)
            for part in [4, 5, 2, 3]:
                value = over(growing_rigid(layers[part], pivots[part], opened, 0, opened), value)
            if opened > .6:
                value = over(gate, value)
            if index >= 68:
                value = source.copy()
                theta = 360 * smooth((index - 68) / 12)
                mask = ((X - 335) / 25) ** 2 + ((Y - 233) / 28) ** 2 <= 1
                wheel = turn_wheel(source * mask[:, :, None], pivots[9], (25, 28), theta) * mask[:, :, None]
                value = over(wheel, source * (~mask)[:, :, None])
                if index == 80:
                    value = source.copy()
        frames.append(value)
    finish(tribe, frames, {'root': [256, 448], 'bones': [{'name': 'root', 'parent': None, 'pivot': [256, 448]}] + [{'name': 'part-' + str(k), 'parent': 'root', 'pivot': v, 'rigid': True} for k, v in pivots.items()], 'drawOrder': [0, 1, 6, 4, 5, 2, 3, 8, 9, 11, 10], 'keys': [0, 18, 23, 43, 68, 80], 'oldClosureSlides': {'left': [-106, 0], 'right': [106, 0]}, 'gateTravel': [0, 90], 'wheelTurns': 1})

def spring():
    tribe = 'spring'
    folder = WORK / tribe
    source = premul(Image.open(folder / 'end.png'))
    closed = old_frame(tribe, 33)
    owner = np.zeros((512, 512), np.uint8)
    owner[Y >= 335] = 1
    wheel_region = poly([(75, 243), (117, 240), (164, 255), (172, 322), (150, 351), (90, 352), (73, 316)])
    pixels = np.array(Image.open(folder / 'end.png'))
    hsv = cv2.cvtColor(pixels[:, :, :3], cv2.COLOR_RGB2HSV)
    wood = np.uint8((hsv[:, :, 0] < 42) & (hsv[:, :, 1] > 75) & (pixels[:, :, 3] > 100))
    wood = cv2.morphologyEx(wood, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    wood = cv2.dilate(wood, np.ones((3, 3), np.uint8)) > 0
    owner[wheel_region & wood] = 3
    gate_region = poly([(264, 272), (340, 272), (342, 334), (265, 334)])
    owner[gate_region & wood] = 4
    owner[poly([(329, 249), (364, 245), (379, 263), (357, 292), (333, 297)]) & wood] = 5
    layers = {part: source * (owner == part)[:, :, None] for part in [0, 1, 3, 4, 5]}
    wheel_fill = normalize(cell(tribe, 3, 2, 3), (72, 242, 172, 352))
    layers[3] = complete(source, owner, 3, wheel_fill, [0, 1])
    backfill = normalize(cell(tribe, 3, 2, 1), (73, 210, 289, 334))
    layers[0] = complete(source, owner, 0, backfill, [3, 4, 5])
    layers[6] = layers[0] * (X < 74)[:, :, None]
    layers[7] = layers[0] * (X > 380)[:, :, None]
    layers[0] *= ((X >= 74) & (X <= 380))[:, :, None]
    surface = layers[1]
    old_controls = controls(closed, [(256, 448), (92, 395), (256, 328), (433, 399)])
    new_controls = controls(surface, [(256, 448), (29, 379), (256, 335), (483, 381)])
    save_layers(folder, layers)
    save_layers(folder, {'closed-water': closed})
    frames = []
    for index in range(81):
        if DRAFT and index not in DRAFT_FRAMES:
            frames.append(None)
            continue
        if index <= 18:
            value = old_frame(tribe, round(60 - 27 * smooth(index / 18)))
        elif index <= 23:
            value = closed.copy()
        else:
            build = smooth((index - 23) / 20)
            opened = smooth((index - 43) / 25)
            rise = smooth((opened - .35) / .65)
            full_back = over(layers[0], over(layers[6], layers[7]))
            core = affine(full_back, (256, 335), (1, 1), 0, (0, 125 * (1 - rise)))
            core *= np.uint8(Y <= 448)[:, :, None]
            value = core if rise > 0 else np.zeros_like(core)
            value = over(growing_rigid(layers[3], (104, 298), opened, 0, opened), value)
            occluder = affine(source * (owner == 0)[:, :, None], (256, 335), (1, 1), 0, (0, 125 * (1 - rise)))
            occluder *= np.uint8(Y <= 448)[:, :, None]
            if rise > 0:
                value = over(occluder, value)
            gate = affine(layers[4], (303, 301), (1, 1), 0, (-47 * (1 - opened), 104 * (1 - opened)))
            gate *= np.uint8(Y <= 448)[:, :, None]
            value = over(gate, value)
            value = over(growing_rigid(layers[5], (346, 281), opened, -28, opened), value)
            water = solid_morph(closed, surface, old_controls, new_controls, opened, (256, 448), (256, 385), 0)
            value = over(water, value)
            if index >= 68:
                theta = 360 * smooth((index - 68) / 12)
                mask = (((X - 106) / 24) ** 2 + ((Y - 297) / 44) ** 2 <= 1) & (owner == 3)
                material = padded_material(layers[3])
                wheel = turn_wheel(material, (106, 297), (24, 44), theta) * mask[:, :, None]
                value = over(wheel, source * (~mask)[:, :, None])
                if index == 80:
                    value = source.copy()
        frames.append(value)
    finish(tribe, frames, {'root': [256, 448], 'bones': [{'name': 'root', 'parent': None, 'pivot': [256, 448]}, {'name': 'channel-and-basin', 'parent': 'root', 'rigid': True}, {'name': 'wheel', 'parent': 'root', 'pivot': [106, 297], 'rigid': True}, {'name': 'gate', 'parent': 'root', 'pivot': [303, 301], 'rigid': True}, {'name': 'handle', 'parent': 'gate', 'pivot': [346, 281], 'rigid': True}], 'surfaceControls': {'closed': old_controls.tolist(), 'open': new_controls.tolist()}, 'drawOrder': [3, 0, 4, 5, 1], 'keys': [0, 18, 23, 43, 68, 80], 'wheelTurns': 1, 'gateTravel': [0, 36]})

if __name__ == '__main__':
    methods = {'sprout': sprout, 'spore': spore, 'pebble': pebble, 'spring': spring}
    for name in [value for value in sys.argv[1:] if not value.startswith('--')] or list(methods):
        methods[name]()
