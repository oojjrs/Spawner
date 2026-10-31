from pathlib import Path
from PIL import Image
import numpy as np
import cv2
import math
import json

ROOT = Path(__file__).resolve().parent
Y, X = np.mgrid[0:512, 0:512].astype(np.float32)
REST = np.array([[168, 343], [120, 289], [181, 174], [348, 343], [394, 289], [335, 174], [256, 363], [82, 258]], float)
ATTACHMENTS = [(0, 1), (1, 2), (3, 4), (4, 5), (6, 6), (7, 7)]
NAMES = ['left-arm', 'left-strut', 'right-arm', 'right-strut', 'collar', 'winch']


def read(path):
    a = np.array(Image.open(path).convert('RGBA')).astype(np.float32) / 255
    a[:, :, :3] *= a[:, :, 3:4]
    return a


def rgba(a):
    alpha = np.clip(a[:, :, 3:4], 0, 1)
    rgb = a[:, :, :3] / np.maximum(alpha, 1e-7)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb, alpha], 2) * 255 + 0.5, 0, 255)))


def over(front, back):
    return front + back * (1 - front[:, :, 3:4])


def segment_distance(a, b):
    direction = b - a
    t = np.clip(((X - a[0]) * direction[0] + (Y - a[1]) * direction[1]) / max(float(direction @ direction), 1), 0, 1)
    return np.sqrt((X - a[0] - direction[0] * t) ** 2 + (Y - a[1] - direction[1] * t) ** 2)


class Assembly:
    def __init__(self):
        image = read(ROOT / 'Sources/GrowthSupport/mechanism.png')
        count, labels, stats, centers = cv2.connectedComponentsWithStats(np.uint8(image[:, :, 3] > 0.2), 8)
        keep = np.zeros((512, 512), np.uint8)
        for i in range(1, count):
            if stats[i, 4] > 24:
                keep[labels == i] = 1
        image *= cv2.dilate(keep, np.ones((3, 3), np.uint8))[:, :, None]
        distances = [segment_distance(REST[a], REST[b]) for a, b in ATTACHMENTS]
        distances[4] = np.sqrt(((X - REST[6, 0]) * 0.35) ** 2 + (Y - REST[6, 1]) ** 2)
        distances[5] = np.sqrt(((X - REST[7, 0]) * 0.7) ** 2 + (Y - REST[7, 1]) ** 2)
        owner = np.argmin(np.stack(distances), 0)
        self.images = []
        folder = ROOT / 'Sources/GrowthSupport/Attachments'
        folder.mkdir(511, True, True)
        for part in range(6):
            mask = np.uint8((owner == part) & (image[:, :, 3] > 0.1))
            mask = cv2.dilate(mask, np.ones((5, 5), np.uint8))
            values = image * mask[:, :, None]
            self.images.append(values)
            rgba(values).save(folder / (NAMES[part] + '.png'))

    def render(self, t):
        if t <= 0:
            return Image.new('RGBA', (512, 512))
        matrices = {}
        root_shift = np.array([0, 52 * (1 - t)])
        for root, joint, tip, sign, arm, strut in [(0, 1, 2, 1, 0, 1), (3, 4, 5, -1, 2, 3)]:
            rest_arm = REST[joint] - REST[root]
            rest_strut = REST[tip] - REST[joint]
            arm_angle = math.atan2(rest_arm[1], rest_arm[0])
            strut_angle = math.atan2(rest_strut[1], rest_strut[0])
            folded_arm = math.radians(-55 if sign == 1 else -125)
            folded_strut = math.radians(-75 if sign == 1 else -105)
            current_arm = folded_arm * (1 - t) + arm_angle * t
            current_relative = (folded_strut - folded_arm) * (1 - t) + (strut_angle - arm_angle) * t
            current_strut = current_arm + current_relative
            root_position = REST[root] + root_shift
            joint_position = root_position + np.linalg.norm(rest_arm) * np.array([math.cos(current_arm), math.sin(current_arm)])
            for part, point, position, angle in [(arm, REST[root], root_position, current_arm - arm_angle), (strut, REST[joint], joint_position, current_strut - strut_angle)]:
                c, s = math.cos(angle), math.sin(angle)
                matrices[part] = np.array([[c, -s, position[0] - c * point[0] + s * point[1]], [s, c, position[1] - s * point[0] - c * point[1]]], np.float32)
        matrices[4] = np.array([[1, 0, 0], [0, 1, root_shift[1]]], np.float32)
        matrices[5] = matrices[1]
        result = np.zeros((512, 512, 4), np.float32)
        for part in [1, 3, 5, 4, 0, 2]:
            values = cv2.warpAffine(self.images[part], matrices[part], (512, 512), None, cv2.INTER_LINEAR, cv2.BORDER_CONSTANT, (0, 0, 0, 0))
            values[Y >= 448] = 0
            result = over(values, result)
        return rgba(result)

    def save(self):
        data = {'format': 'local-rigid-fk-attachment-rig-v1', 'frameSize': [512, 512], 'pivot': [256, 448], 'intervalMs': [1400, 2100], 'restWorldPoints': REST.tolist(), 'foldedRootTranslation': [0, 52], 'foldedArmAnglesDegrees': [-55, -125], 'foldedStrutAnglesDegrees': [-75, -105], 'attachmentParents': ['collar', 'left-arm', 'collar', 'right-arm', None, 'left-strut'], 'attachmentPointIndices': ATTACHMENTS, 'attachmentNames': NAMES, 'drawOrder': [NAMES[i] for i in [1, 3, 5, 4, 0, 2]], 'images': ['Sources/GrowthSupport/Attachments/' + name + '.png' for name in NAMES], 'scaleAnimated': False, 'opacityAnimated': False, 'occluders': ['closed-bud', 'foreground-base'], 'spineCompatibilityVerified': False}
        (ROOT / 'assembly-rig.json').write_bytes((json.dumps(data) + '\r\n').encode('utf-8'))
