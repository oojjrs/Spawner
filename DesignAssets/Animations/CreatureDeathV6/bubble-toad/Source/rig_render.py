import json
import math
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SIZE = 512


def smooth(value):
    u = max(0.0, min(1.0, value))
    return u * u * (3 - 2 * u)


def rigid(pivot, angle, translation):
    radians = math.radians(angle)
    c, s = math.cos(radians), math.sin(radians)
    rotation = np.array([[c, -s], [s, c]])
    offset = np.array(pivot) + np.array(translation) - rotation @ np.array(pivot)
    matrix = np.eye(3)
    matrix[:2, :2], matrix[:2, 2] = rotation, offset
    return matrix


def affine(image, matrix):
    inverse = np.linalg.inv(matrix)
    return image.convert('RGBa').transform((SIZE, SIZE), Image.Transform.AFFINE, tuple(inverse[:2].ravel()), Image.Resampling.BICUBIC).convert('RGBA')


def rgba(pixels):
    alpha = np.clip(pixels[:, :, 3:4], 0, 1)
    rgb = pixels[:, :, :3] / np.maximum(alpha, 1 / 255)
    return Image.fromarray(np.uint8(np.clip(np.concatenate([rgb, alpha], 2) * 255 + 0.5, 0, 255)))


def premultiply(image):
    pixels = np.array(image).astype(np.float32) / 255
    pixels[:, :, :3] *= pixels[:, :, 3:4]
    return pixels


def solve_chain(joints, shoulder, hand):
    a, b, c = np.array(joints, float)
    upper, lower = np.linalg.norm(b-a), np.linalg.norm(c-b)
    vector = hand - shoulder
    distance = min(float(np.linalg.norm(vector)), upper + lower - 0.001)
    direction = vector / max(0.001, float(np.linalg.norm(vector)))
    along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
    perpendicular = np.array([-direction[1], direction[0]])
    sign = np.sign((c[0]-a[0])*(b[1]-a[1])-(c[1]-a[1])*(b[0]-a[0]))
    elbow = shoulder + direction * along + perpendicular * sign * math.sqrt(max(0.0, upper * upper - along * along))
    posed = [shoulder, elbow, hand]
    matrices = []
    for index in range(2):
        first, last = [a, b, c][index:index+2]
        target_a, target_b = posed[index:index+2]
        source_angle = math.atan2(*(last-first)[::-1])
        target_angle = math.atan2(*(target_b-target_a)[::-1])
        matrices.append(rigid(first, math.degrees(target_angle-source_angle), target_a-first))
    matrices.append(rigid(c, 0, hand-c))
    return posed, matrices


def blink_head(opened, closed, amount):
    if amount <= 0:
        return opened
    pixels, replacement = np.array(opened), np.array(closed)
    gy, gx = np.mgrid[:SIZE, :SIZE]
    near = np.clip((1-((gx-235)/34)**2-((gy-226)/33)**2)*6,0,1)
    far = np.clip((1-((gx-150)/24)**2-((gy-211)/26)**2)*6,0,1)
    lower = np.where(near>far,194+amount*66,184+amount*53)
    coverage = np.maximum(near,far)*np.clip((lower-gy)/1.5,0,1)
    coverage *= np.minimum(1,replacement[:,:,3]/255)
    pixels[:,:,:3] = np.rint(pixels[:,:,:3]*(1-coverage[:,:,None])+replacement[:,:,:3]*coverage[:,:,None]).astype(np.uint8)
    return Image.fromarray(pixels)


def render_pouch(image, drop, sideways):
    gy, gx = np.mgrid[:SIZE, :SIZE].astype(np.float32)
    horizontal = 1-0.22*max(0.0,min(1.0,drop/120))
    source_x = 300+(gx-sideways-300)/horizontal
    top = 240+0.20*(source_x-145)
    factor = np.maximum(0.1,(435-top-drop+2)/(435-top))
    source_y = top+(gy-top-drop+2)/factor
    sampled = cv2.remap(premultiply(image),source_x,source_y,cv2.INTER_LINEAR,None,cv2.BORDER_CONSTANT)
    sampled[:,:,:3] = np.clip(sampled[:,:,:3],0,np.maximum(0,sampled[:,:,3:4]))
    return rgba(sampled)


def hide_joint_outline(front, back, region):
    pixels=np.array(front)
    alpha=pixels[:,:,3].astype(np.float32)/255
    under=cv2.erode(np.array(back)[:,:,3],np.ones((3,3),np.uint8)).astype(np.float32)/255
    distance=cv2.distanceTransform(np.uint8(alpha>0.5),cv2.DIST_L2,3)
    edge=1-np.clip((distance-0.5)/2.5,0,1)
    ink=np.clip((140-pixels[:,:,1].astype(np.float32))/65,0,1)
    if region is not None:
        ink*=region
    pixels[:,:,3]=np.rint(pixels[:,:,3]*(1-under*edge*ink)).astype(np.uint8)
    return Image.fromarray(pixels)


def render_frame(rig, images, time):
    body_progress=smooth((time-130)/760)
    head_progress=smooth((time-100)/850)
    body_matrix=rigid(rig['bodyPivot'],0,[0,22*body_progress])
    head_matrix=rigid(rig['headPivot'],0,[-9*head_progress,120*head_progress])
    layers={'torso':affine(images['torso'],body_matrix),
            'pouch':render_pouch(images['pouch'],120*head_progress,-9*head_progress),
            'head':affine(blink_head(images['head'],images['head-closed'],smooth((time-45)/140)),head_matrix),
            'hind-near':images['hind-near'],'hind-far':images['hind-far']}
    gy,gx=np.mgrid[:SIZE,:SIZE]
    local_x=gx-head_matrix[0,2]
    local_y=gy-head_matrix[1,2]
    neck=np.clip((local_x-267)/5,0,1)*np.clip((local_y-260)/5,0,1)
    layers['head']=hide_joint_outline(layers['head'],layers['torso'],neck)
    contacts,attachments={},{}
    for side in ['near','far']:
        name='fore-'+side
        joints=rig['forelegs'][name]
        shoulder=(body_matrix@np.r_[joints[0],1])[:2]
        if side=='far':
            shoulder=np.array(joints[0])+np.array([10*body_progress,24*body_progress])
        hand=np.array(joints[2])
        posed,matrices=solve_chain(joints,shoulder,hand)
        for suffix,matrix in zip(['upper','lower','hand'],matrices):
            attachment=name+'-'+suffix
            layers[attachment]=affine(images[attachment],matrix)
            attachments[attachment]=matrix.tolist()
        lower=name+'-lower'
        hand_layer=name+'-hand'
        layers[lower]=hide_joint_outline(layers[lower],layers[name+'-upper'],None)
        layers[hand_layer]=hide_joint_outline(layers[hand_layer],layers[lower],None)
        contacts[name]=[point.tolist() for point in posed]
    frame=Image.new('RGBA',(SIZE,SIZE))
    for name in rig['drawOrder']:
        frame.alpha_composite(layers[name])
    return frame,{'timeMs':time,'bodyMatrix':body_matrix.tolist(),'headMatrix':head_matrix.tolist(),'forelegs':contacts,'attachments':attachments},layers


def render_frames(folder, meta):
    source=folder/'Source'
    rig=json.loads((source/'rig.json').read_text('utf-8'))
    images={name:Image.open(source/path).convert('RGBA') for name,path in rig['parts'].items()}
    timestamps=[0]
    for duration in meta['durationsMs'][:-1]:
        timestamps.append(timestamps[-1]+duration)
    records,frames=[],[]
    for index,time in enumerate(timestamps):
        frame,record,layers=render_frame(rig,images,time)
        frame.save(folder/meta['sourceFrames'][index])
        frames.append(frame)
        records.append(record)
    encoder=json.JSONEncoder()
    encoder.indent=2
    encoder.item_separator=','
    (source/'rig-samples.json').write_bytes((encoder.encode(records)+'\n').replace('\n','\r\n').encode('utf-8'))
    return frames
