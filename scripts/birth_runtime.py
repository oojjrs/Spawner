"""Runtime-only trim of the reviewed bean combo birth's duplicate review hold.

The 4,500 ms publication/preview and source atlas stay intact. Runtime keeps
all 116 motion samples (3,850 ms), not the extra 650 ms review-only sample.
Fail closed if a future publication no longer has this verified contract.
"""
from PIL import Image


def trim_bean_birth_review_hold(clip, source):
    assert clip['fullScene'] is True and clip['loop'] is False
    assert clip['frameCount'] == len(clip['durationsMs']) == 117
    assert clip['durationMs'] == sum(clip['durationsMs']) == 4500
    assert clip['durationsMs'][-1] == 650
    assert sum(clip['durationsMs'][:-1]) == 3850
    frames = clip.get('frames', list(range(clip['frameCount'])))
    assert len(frames) == clip['frameCount']
    width, height, columns = clip['frameSize'], clip['frameHeight'], clip['columns']
    with Image.open(source) as image:
        cells = []
        for frame in frames[-2:]:
            x, y = frame % columns * width, frame // columns * height
            cells.append(image.crop((x, y, x + width, y + height)).convert('RGBA').tobytes())
        assert cells[0] == cells[1], (source, 'review hold must duplicate final full-body pixels')
    layers = clip.get('sceneLayers', {}).get('layers', [])
    for layer in layers:
        assert len(layer['samples']) == 117
        assert layer['samples'][-2] == layer['samples'][-1], (source, layer['role'], 'review hold sample')
    clip['frameCount'] -= 1
    clip['durationsMs'] = clip['durationsMs'][:-1]
    clip['durationMs'] = sum(clip['durationsMs'])
    if 'frames' in clip:
        clip['frames'] = clip['frames'][:-1]
    for layer in layers:
        layer['samples'] = layer['samples'][:-1]
