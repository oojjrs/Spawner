from pathlib import Path
import json
import math
import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
data = json.loads((root / 'Source/parts-registration.json').read_text('utf-8'))
rig = json.loads((root / 'rig.json').read_text('utf-8'))
GROUND = rig['groundY']
parts = {name: Image.open(root / source).convert('RGBA') for name, source in rig['parts'].items()}
fields_file = np.load(root / rig['pouch']['fields'])
pouch_textures = fields_file['arr_0']
pouch_contours = fields_file['arr_1']
pouch_bounds = fields_file['arr_2']
pivot = np.array(rig['bodyPivot'], float)
head_pivot = np.array(rig['headPivot'], float)

def rotation(a):
    return np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])

def body_points(points, state):
    return (np.array(points) - pivot) @ rotation(state['angle']).T + pivot + np.array([state['x'], state['y']])

def head_points(points, state):
    local = (np.array(points) - head_pivot) @ rotation(state['head']).T + head_pivot
    return body_points(local, state)

def rigid(image, function, state):
    source = np.array([[0., 0.], [1., 0.], [0., 1.]])
    target = function(source, state)
    matrix = np.array([[target[1, 0] - target[0, 0], target[2, 0] - target[0, 0], target[0, 0]], [target[1, 1] - target[0, 1], target[2, 1] - target[0, 1], target[0, 1]], [0, 0, 1]])
    inv = tuple(np.linalg.inv(matrix)[:2].reshape(-1))
    return image.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, inv, Image.Resampling.BICUBIC, 1, (0, 0, 0, 0)).convert('RGBA')

def mesh(image, vertices, target, triangles):
    source = image.convert('RGBa')
    layer = Image.new('RGBa', (512, 512), (0, 0, 0, 0))
    for triangle in triangles:
        s = vertices[triangle]
        d = target[triangle]
        left = max(0, int(math.floor(d[:, 0].min())))
        top = max(0, int(math.floor(d[:, 1].min())))
        right = min(512, int(math.ceil(d[:, 0].max())) + 1)
        bottom = min(512, int(math.ceil(d[:, 1].max())) + 1)
        if left >= right or top >= bottom:
            continue
        system = np.column_stack([d, np.ones(3)])
        if abs(np.linalg.det(system)) < .001:
            continue
        affine = np.linalg.solve(system, s).T
        affine[:, 2] += affine[:, 0] * left + affine[:, 1] * top
        sample = source.transform((right - left, bottom - top), Image.Transform.AFFINE, tuple(affine.reshape(-1)), Image.Resampling.BICUBIC, 1, (0, 0, 0, 0))
        mask = Image.new('L', sample.size, 0)
        ImageDraw.Draw(mask).polygon([tuple(v - [left, top]) for v in d], 255)
        layer.paste(sample, (left, top), mask)
    return layer.convert('RGBA')

def grid(image, spacing):
    alpha = np.array(image)[:, :, 3]
    yy, xx = np.nonzero(alpha > 16)
    xs = np.arange(max(0, int(xx.min()) - 3), min(511, int(xx.max()) + spacing + 3), spacing)
    ys = np.arange(max(0, int(yy.min()) - 3), min(511, int(yy.max()) + spacing + 3), spacing)
    vertices = np.array([[x, y] for y in ys for x in xs], float)
    triangles = []
    for j in range(len(ys) - 1):
        for i in range(len(xs) - 1):
            x0, x1 = int(xs[i]), int(xs[i + 1])
            y0, y1 = int(ys[j]), int(ys[j + 1])
            if not np.any(alpha[y0:y1 + 1, x0:x1 + 1] > 0):
                continue
            k = j * len(xs) + i
            triangles.extend([[k, k + 1, k + len(xs)], [k + 1, k + len(xs) + 1, k + len(xs)]])
    return vertices, np.array(triangles)

def bone_weights(vertices, joints):
    distances = []
    projections = []
    lengths = np.linalg.norm(np.diff(joints, 1, 0), None, 1)
    cumulative = np.concatenate([[0.], np.cumsum(lengths)])
    for i in range(3):
        d = joints[i + 1] - joints[i]
        u = np.clip((vertices - joints[i]) @ d / (d @ d), 0, 1)
        distances.append(np.linalg.norm(vertices - joints[i] - u[:, None] * d, None, 1))
        projections.append(cumulative[i] + u * lengths[i])
    closest = np.argmin(np.array(distances), 0)
    arc = np.array(projections)[closest, np.arange(len(vertices))]
    weights = np.zeros((len(vertices), 3))
    weights[np.arange(len(vertices)), np.minimum(2, np.searchsorted(cumulative[1:], arc, 'left'))] = 1
    for i in range(2):
        distance = arc - cumulative[i + 1]
        blend = np.abs(distance) < 6
        weights[blend] = 0
        weights[blend, i] = .5 - distance[blend] / 12
        weights[blend, i + 1] = .5 + distance[blend] / 12
    return weights

def ik(root_joint, wrist, bind):
    l1 = np.linalg.norm(bind[1] - bind[0])
    l2 = np.linalg.norm(bind[2] - bind[1])
    difference = wrist - root_joint
    distance = np.linalg.norm(difference)
    reach = float(np.clip(distance, abs(l1 - l2) + .01, l1 + l2 - .01))
    direction = difference / max(distance, .001)
    a = (l1 * l1 - l2 * l2 + reach * reach) / (2 * reach)
    height = math.sqrt(max(0, l1 * l1 - a * a))
    a0 = bind[2] - bind[0]
    b0 = bind[1] - bind[0]
    cross = a0[0] * b0[1] - a0[1] * b0[0]
    sign = 1 if cross > 0 else -1
    elbow = root_joint + a * direction + sign * height * np.array([-direction[1], direction[0]])
    return elbow, distance - reach

rigs = {}
for name in rig['skinnedLimbs']:
    parent = 'hind-near' if name == 'hind-near-foreground' else name
    joints = np.array(rig['skinnedLimbs'][name]['joints'])
    if parent == 'fore-near':
        joints[2] = [315.5, 411.0]
    if parent == 'hind-near':
        joints[0] = [360., 327.]
        joints[1] = [450., 390.]
    vertices, triangles = grid(parts[name], rig['skinnedLimbs'][name]['gridSpacing'])
    weights = bone_weights(vertices, joints)
    rgba = np.array(parts[name])
    y, x = np.nonzero(rgba[:, :, 3] > 64)
    pixels = np.column_stack([x, y]).astype(float)
    pixel_weights = bone_weights(pixels, joints)
    if parent == 'fore-near':
        mix = np.clip((vertices[:, 1] - 409) / 10, 0, 1)
        missing = weights[:, :2].sum(1) < .001
        weights[missing, 1] = 1
        weights[:, :2] /= np.maximum(weights[:, :2].sum(1)[:, None], .001)
        weights[:, :2] *= (1 - mix[:, None])
        weights[:, 2] = mix
        sums = weights.sum(1)
        weights /= np.maximum(sums[:, None], .00001)
        pmix = np.clip((pixels[:, 1] - 409) / 10, 0, 1)
        pixel_weights[:, 2] = pmix
    if parent == 'hind-near':
        shin = np.clip((vertices[:, 1] - 402) / 14, 0, 1)
        paw = np.clip((vertices[:, 1] - 416) / 9, 0, 1)
        weights[:, 0] = 1 - shin
        weights[:, 1] = shin * (1 - paw)
        weights[:, 2] = shin * paw
        pshin = np.clip((pixels[:, 1] - 402) / 14, 0, 1)
        ppaw = np.clip((pixels[:, 1] - 416) / 9, 0, 1)
        pixel_weights[:, 2] = pshin * ppaw
    foot = pixels[pixel_weights[:, 2] > .5]
    rigs[name] = {'bind': joints, 'vertices': vertices, 'triangles': triangles, 'weights': weights, 'foot': foot, 'ground': float(foot[:, 1].max())}

def limb(name, state):
    rig = rigs[name]
    bind = rig['bind']
    root_joint = body_points([bind[0]], state)[0]
    hand_roll = state['roll'] if name.startswith('fore') else state['roll'] * .25
    foot = (rig['foot'] - bind[2]) @ rotation(hand_roll).T + bind[2]
    lift = rig['ground'] - foot[:, 1].max()
    slide = state['handSlide'] if name.startswith('fore') else state['spread']
    wrist = bind[2] + np.array([slide, lift])
    elbow, error = ik(root_joint, wrist, bind)
    end = (bind[3] - bind[2]) @ rotation(hand_roll).T + wrist
    current = np.array([root_joint, elbow, wrist, end])
    target = np.zeros_like(rig['vertices'])
    for i in range(3):
        old_angle = math.atan2(*(bind[i + 1] - bind[i])[::-1])
        new_angle = math.atan2(*(current[i + 1] - current[i])[::-1])
        pose = (rig['vertices'] - bind[i]) @ rotation(new_angle - old_angle).T + current[i]
        target += pose * rig['weights'][:, i:i + 1]
    return mesh(parts[name], rig['vertices'], target, rig['triangles']), current, error

bag_size = rig['pouch']['uvGrid']
bag_u = np.linspace(0, 1, bag_size)
bag_v = np.linspace(0, 1, bag_size)
bag_uv = np.array([[u, v] for v in bag_v for u in bag_u])
bag_vertices = bag_uv * (rig['pouch']['textureSize'] - 1)
bag_triangles = []
for j in range(bag_size - 1):
    for i in range(bag_size - 1):
        k = j * bag_size + i
        bag_triangles.extend([[k, k + 1, k + bag_size], [k + 1, k + bag_size + 1, k + bag_size]])
bag_triangles = np.array(bag_triangles)

def pouch(state):
    q = state['air'] * 2
    index = min(1, int(q))
    fraction = min(1., q - index)
    rgba = pouch_textures[index] * (1 - fraction) + pouch_textures[index + 1] * fraction
    image = Image.fromarray(np.clip(rgba, 0, 255).astype('uint8'))
    contour = pouch_contours[index] * (1 - fraction) + pouch_contours[index + 1] * fraction
    sample_v = np.linspace(0, 1, len(contour))
    u, v = bag_uv[:, 0], bag_uv[:, 1]
    left = np.interp(v, sample_v, contour[:, 0])
    right = np.interp(v, sample_v, contour[:, 1])
    x = left * (1 - u) + right * u
    upper = np.column_stack([x, np.full(len(x), rig['pouch']['attachmentRestY'])])
    lower = np.column_stack([x, np.full(len(x), rig['pouch']['bottomRestY'])])
    top = head_points(upper, state)
    bottom = body_points(lower, state)
    bottom[:, 1] -= (rig['pouch']['restCurve'][0] * (1 - state['air']) + rig['pouch']['restCurve'][1] * state['air']) * (x - rig['pouch']['neutralCenterX']) ** 2
    floor_curve = GROUND - (rig['pouch']['floorCurve'][0] * (1 - state['air']) + rig['pouch']['floorCurve'][1] * state['air']) * (x - rig['pouch']['neutralCenterX']) ** 2
    compression = np.maximum(0, bottom[:, 1] - floor_curve)
    bottom[:, 1] -= compression
    target = top * (1 - v[:, None]) + bottom * v[:, None]
    target[:, 0] += (x - rig['pouch']['neutralCenterX']) * compression / 880 * np.sin(v * math.pi)
    result = mesh(image, bag_vertices, target, bag_triangles)
    return result

head_base = np.array(parts['head-open'])
head_closed = np.array(parts['head-closed'])
yy, xx = np.indices((512, 512))
near_eye = ((xx - 225) / 34) ** 2 + ((yy - 188) / 29) ** 2 < 1
far_eye = ((xx - 135) / 17) ** 2 + ((yy - 171) / 24) ** 2 < 1
eye_mask = near_eye | far_eye

def head_image(state, foreground):
    image = head_base.copy()
    yy = np.indices((512, 512))[0]
    limit_near = 159 + 58 * state['blink']
    limit_far = 147 + 48 * state['blink']
    mask = eye_mask & (((yy < limit_near) & near_eye) | ((yy < limit_far) & far_eye))
    image[mask, :3] = head_closed[mask, :3]
    if foreground:
        image[:, :, 3] = np.minimum(image[:, :, 3], np.array(parts['head-open-foreground'])[:, :, 3])
    return rigid(Image.fromarray(image), head_points, state)

near_binds = {name: np.array(points, float) for name, points in rig['rigidLimbBinds'].items()}
near_feet = {}
for name in near_binds:
    a = np.array(parts[name + '-paw'])
    yy, xx = np.nonzero(a[:, :, 3] > 64)
    near_feet[name] = np.column_stack([xx, yy]).astype(float)

def near_chain(name, state):
    bind = near_binds[name]
    root_joint = body_points([bind[0]], state)[0]
    roll = .08 * state['air'] if name.startswith('fore') else state['roll'] * .25
    foot = (near_feet[name] - bind[2]) @ rotation(roll).T + bind[2]
    lift = near_feet[name][:, 1].max() - foot[:, 1].max()
    slide = 0 if name.startswith('fore') else state['spread']
    wrist = bind[2] + np.array([slide, lift])
    elbow, error = ik(root_joint, wrist, bind)
    if name.startswith('fore'):
        def surface(wrist_x):
            candidate_wrist = np.array([wrist_x, wrist[1]])
            candidate_elbow, candidate_error = ik(root_joint, candidate_wrist, bind)
            upper = segment_points(fore_limb_pixels[name][0], bind[0], bind[1], root_joint, candidate_elbow)
            lower = segment_points(fore_limb_pixels[name][1], bind[1], bind[2], candidate_elbow, candidate_wrist)
            return max(float(upper[:, 1].max()), float(lower[:, 1].max())), candidate_elbow, candidate_error
        if surface(wrist[0])[0] > GROUND:
            l1 = np.linalg.norm(bind[1] - bind[0])
            l2 = np.linalg.norm(bind[2] - bind[1])
            minimum_dx = math.sqrt(max(0, (abs(l1 - l2) + .2) ** 2 - (wrist[1] - root_joint[1]) ** 2))
            end_x = max(wrist[0], root_joint[0] - minimum_dx)
            if name == 'fore-far':
                maximum_dx = math.sqrt(max(0, (l1 + l2 - .2) ** 2 - (wrist[1] - root_joint[1]) ** 2))
                end_x = min(wrist[0], root_joint[0] - maximum_dx)
            low, high = wrist[0], end_x
            for _ in range(14):
                middle = (low + high) / 2
                if surface(middle)[0] > GROUND:
                    low = middle
                else:
                    high = middle
            wrist[0] = high
            _, elbow, error = surface(high)
    end = (bind[3] - bind[2]) @ rotation(roll).T + wrist
    return np.array([root_joint, elbow, wrist, end]), error

def segment_points(points, bind_a, bind_b, a, b):
    old = math.atan2(*(bind_b - bind_a)[::-1])
    new = math.atan2(*(b - a)[::-1])
    return (np.array(points) - bind_a) @ rotation(new - old).T + a

def segment_image(image, bind_a, bind_b, a, b):
    s = np.array([[0., 0.], [1., 0.], [0., 1.]])
    d = segment_points(s, bind_a, bind_b, a, b)
    matrix = np.array([[d[1, 0] - d[0, 0], d[2, 0] - d[0, 0], d[0, 0]], [d[1, 1] - d[0, 1], d[2, 1] - d[0, 1], d[0, 1]], [0, 0, 1]])
    inverse = tuple(np.linalg.inv(matrix)[:2].reshape(-1))
    return image.convert('RGBa').transform((512, 512), Image.Transform.AFFINE, inverse, Image.Resampling.BICUBIC, 1, (0, 0, 0, 0)).convert('RGBA')

thigh_a = np.array(parts['hind-thigh'])
yy, xx = np.nonzero(thigh_a[:, :, 3] > 64)
thigh_pixels = np.column_stack([xx, yy]).astype(float)
fore_limb_pixels = {}
for name in ['fore', 'fore-far']:
    fore_pixels = []
    for segment in ['upper', 'lower']:
        a = np.array(parts[name + '-' + segment])
        fy, fx = np.nonzero(a[:, :, 3] > 64)
        fore_pixels.append(np.column_stack([fx, fy]).astype(float))
    fore_limb_pixels[name] = fore_pixels

def thigh_ground(state):
    chain, _ = near_chain('hind', state)
    posed = segment_points(thigh_pixels, near_binds['hind'][0], near_binds['hind'][1], chain[0], chain[1])
    return float(posed[:, 1].max())

def fore_ground(state):
    maximum = 0.
    for name in ['fore', 'fore-far']:
        chain, _ = near_chain(name, state)
        bind = near_binds[name]
        for i in range(2):
            posed = segment_points(fore_limb_pixels[name][i], bind[i], bind[i + 1], chain[i], chain[i + 1])
            maximum = max(maximum, float(posed[:, 1].max()))
    return maximum

states = []
y = 0.
velocity = 0.
angle = 0.
angular_velocity = 0.
head_angle = 0.
head_velocity = 0.
contact_time = None
sleeping_y = None
sleeping_head = None
dt = 1 / rig['simulationHz']
torso_pixels = np.array(parts['torso'])[:, :, 3]
ty, tx = np.nonzero(torso_pixels > 64)
torso_opaque = np.column_stack([tx, ty])
for step in range(round(rig['durationMs'] / 1000 * rig['simulationHz']) + 1):
    time = step * dt
    loss = float(np.clip((time * 1000 - rig['physics']['supportLossMs'][0]) / (rig['physics']['supportLossMs'][1] - rig['physics']['supportLossMs'][0]), 0, 1))
    air = 0. if contact_time is None else float(np.clip(((time - contact_time) * 1000 - rig['physics']['airReleaseDelayMs']) / rig['physics']['airReleaseDurationMs'], 0, 1))
    target_angle = rig['physics']['bodyLeanRadians'] * loss
    angular_velocity += (rig['physics']['bodyLeanSpring'][0] * (target_angle - angle) - rig['physics']['bodyLeanSpring'][1] * angular_velocity) * dt
    angle += angular_velocity * dt
    target_head = rig['physics']['headRestRadians'] * air
    head_velocity += (rig['physics']['headSpring'][0] * (target_head - head_angle) - rig['physics']['headSpring'][1] * head_velocity) * dt
    head_angle += head_velocity * dt
    if sleeping_head is None and time * 1000 > rig['physics']['headSleep']['afterMs'] and air == 1 and abs(head_velocity) < rig['physics']['headSleep']['velocity'] and abs(target_head - head_angle) < rig['physics']['headSleep']['errorRadians']:
        sleeping_head = float(head_angle)
    if sleeping_head is not None:
        head_angle = sleeping_head
        head_velocity = 0.
    hand_slide = 0. if contact_time is None else float(np.clip((time - contact_time - .12) / .32, 0, 1))
    hand_slide = hand_slide * hand_slide * (3 - 2 * hand_slide)
    state = {'x': rig['physics']['bodyAdvancePx'] * loss, 'y': y, 'angle': angle, 'head': head_angle, 'air': air, 'blink': float(np.clip((time - .03) / .08, 0, 1)), 'roll': .54 * air, 'spread': 10 * air, 'handSlide': 43 * hand_slide}
    rest_bottom = body_points([[170, 415]], state)[0, 1] - rig['physics']['airSupportReductionPx'] * air
    penetration = max(0, rest_bottom - GROUND)
    if penetration > 0 and contact_time is None:
        contact_time = time
    acceleration = rig['physics']['gravity'] * loss
    if penetration > 0:
        acceleration -= max(0, rig['physics']['contactSpring'][0] * penetration + rig['physics']['contactSpring'][1] * velocity)
    velocity += acceleration * dt
    y += velocity * dt
    body_bottom = (torso_opaque - pivot) @ rotation(angle).T + pivot
    maximum_y = GROUND - body_bottom[:, 1].max()
    if y > maximum_y:
        y = float(maximum_y)
        velocity = min(0, velocity * -rig['physics']['contactRestitution'])
    state['y'] = y
    for _ in range(6):
        excess = max(0, max(thigh_ground(state), fore_ground(state)) - GROUND)
        if excess < .01:
            break
        y -= excess
        state['y'] = y
        velocity = min(0, velocity * -rig['physics']['contactRestitution'])
    if sleeping_y is None and time * 1000 > rig['physics']['bodySleep']['afterMs'] and air == 1 and abs(velocity) < rig['physics']['bodySleep']['velocity'] and abs(fore_ground(state) - GROUND) < rig['physics']['bodySleep']['contactTolerancePx']:
        sleeping_y = float(y)
    if sleeping_y is not None:
        y = sleeping_y
        velocity = 0.
        state['y'] = y
    state['time'] = time
    state['velocity'] = velocity
    state['headVelocity'] = head_velocity
    if step % rig['sampleEverySteps'] == 0:
        states.append(state.copy())

output = root / 'Frames'
output.mkdir(511, True, True)
frames = []
landmarks = []
for i, state in enumerate(states):
    layers = {}
    joints = {}
    errors = {}
    for name in rigs:
        layers[name], chain, errors[name] = limb(name, state)
        joints[name] = chain.tolist()
    for name, segment_names in [('fore', ['fore-upper', 'fore-lower', 'fore-paw']), ('fore-far', ['fore-far-upper', 'fore-far-lower', 'fore-far-paw']), ('hind', ['hind-thigh', 'hind-shin', 'hind-paw'])]:
        chain, errors[name + '-near'] = near_chain(name, state)
        joints[name + '-near'] = chain.tolist()
        bind = near_binds[name]
        for n, segment_name in enumerate(segment_names):
            layers[segment_name] = segment_image(parts[segment_name], bind[n], bind[n + 1], chain[n], chain[n + 1])
    layers['torso'] = rigid(parts['torso'], body_points, state)
    layers['head'] = head_image(state, False)
    layers['pouch'] = pouch(state)
    layers['head-foreground'] = head_image(state, True)
    canvas = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    for name in rig['renderOrder']:
        canvas.alpha_composite(layers[name])
    canvas.save(output / ('frame-' + str(i).zfill(3) + '.png'))
    frames.append(canvas)
    landmarks.append({'state': state, 'joints': joints, 'reachError': errors})
    print('frame', i, round(state['y'], 2), round(state['air'], 3))
ticks = [round(state['time'] * 1000) for state in states]
durations = [ticks[i + 1] - ticks[i] for i in range(len(ticks) - 1)] + [rig['holdMs']]
frames[0].save(root / 'preview.webp', **{'save_all': True, 'append_images': frames[1:], 'duration': durations, 'loop': 0, 'lossless': True})
small = [frame.resize((64, 64), Image.Resampling.LANCZOS) for frame in frames]
small[0].save(root / 'thumbnail.webp', **{'save_all': True, 'append_images': small[1:], 'duration': durations, 'loop': 0, 'lossless': True})
contact = Image.new('RGBA', (2048, 1024), (239, 237, 231, 255))
for n, index in enumerate([0, 4, 8, 11, 14, 18, 24, 45]):
    contact.alpha_composite(frames[index], (n % 4 * 512, n // 4 * 512))
    ImageDraw.Draw(contact).text((n % 4 * 512 + 12, n // 4 * 512 + 12), str(round(states[index]['time'] * 1000)) + ' ms', (25, 25, 25, 255))
contact.save(root / 'contact.png')
(root / 'motion-records.json').write_bytes((json.dumps({'contactTime': contact_time, 'landmarks': landmarks}, **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf-8'))
print('CONTACT', contact_time, 'FINAL', states[-1])

columns = rig['columns']
sheet = Image.new('RGBA', (512 * columns, 512 * math.ceil(len(frames) / columns)), (0, 0, 0, 0))
for i, frame in enumerate(frames):
    sheet.alpha_composite(frame, (i % columns * 512, i // columns * 512))
sheet.save(root / 'death.webp', **{'lossless': True})
registration = json.loads((root / 'Source/reference-registration.json').read_text('utf-8'))
base = 'DesignAssets/Animations/CreatureDeathV4/bubble-toad/'
metadata = {'name': 'bubble-toad', 'action': 'death', 'sourceImage': rig['sourceAuthority'], 'image': base + 'death.webp', 'frameSize': 512, 'columns': columns, 'frameCount': len(frames), 'pivotX': 256, 'pivotY': GROUND, 'durationsMs': durations, 'durationMs': sum(durations), 'loop': False, 'preview': base + 'preview.webp', 'thumbnail': base + 'thumbnail.webp', 'previewLoop': 0, 'rig': base + 'rig.json', 'renderer': base + 'render.py', 'sourceAuthoring': base + 'Source/authoring.json', 'prepare': base + 'Source/prepare.py', 'contact': base + 'contact.png', 'sourcePlacement': {'canvas': [512, 512], 'groundY': GROUND, 'runtimeScale': [1, 1], 'referenceNormalization': registration}, 'construction': 'Registered complete rigid parts, one far hind skin mesh, a continuously folded throat-sac surface, integrated support loss and surface contact constraints.'}
(root / 'death.json').write_bytes((json.dumps(metadata, **{'indent': 2}) + '\n').replace('\n', '\r\n').encode('utf-8'))
