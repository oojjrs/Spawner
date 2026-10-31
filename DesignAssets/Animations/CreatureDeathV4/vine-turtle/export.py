import json
from PIL import _webp

def write_json(path,data):
    encoder=json.JSONEncoder()
    encoder.indent=2
    encoder.ensure_ascii=False
    path.write_bytes((encoder.encode(data)+'\n').replace('\n','\r\n').encode('utf-8'))

def encode(path,frames,durations):
    encoder=_webp.WebPAnimEncoder(frames[0].size,0,0,False,9,17,False,False)
    timestamp=0
    for frame,duration in zip(frames,durations):
        encoder.add(frame.getim(),timestamp,True,100.0,100.0,3)
        timestamp+=duration
    encoder.add(None,timestamp,True,100.0,100.0,0)
    path.write_bytes(encoder.assemble('','',''))

def still(path,image):
    path.write_bytes(_webp.WebPEncode(image.getim(),True,100.0,100.0,'',4,1,b'',''))
