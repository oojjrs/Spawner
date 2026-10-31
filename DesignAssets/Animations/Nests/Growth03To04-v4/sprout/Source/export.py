from pathlib import Path
import json,math,shutil,hashlib
import numpy as np
from PIL import Image,WebPImagePlugin,GifImagePlugin
ROOT=Path(__file__).resolve().parent.parent
TARGET=ROOT
def write(file,text):file.write_bytes((text.replace('\r\n','\n').replace('\n','\r\n').rstrip()+'\r\n').encode('utf-8'))
def save_json(file,value):write(file,json.dumps(value))
def webp(frames,file,durations,loop):
    frames[0].encoderinfo={'append_images':frames[1:],'duration':durations,'loop':loop,'lossless':True,'method':4}
    with file.open('wb') as output:WebPImagePlugin._save_all(frames[0],output,str(file))
def export():
    (ROOT/'Frames').mkdir(511,True,True)
    durations=[600]+[40]*100+[1000];times=[0]+[round(.6+.04*i,6) for i in range(100)]+[4.6];frames=[]
    for i in range(102):
        file=ROOT/'Renders'/('%03d.png'%i);shutil.copyfile(file,TARGET/'Frames'/('frame-%03d.png'%i));frames.append(Image.open(file).convert('RGBA'))
    sheet=Image.new('RGBA',(4096,6656))
    for i,im in enumerate(frames):sheet.paste(im,((i%8)*512,(i//8)*512))
    sheet.save(TARGET/'growth.png');webp(frames,TARGET/'growth.webp',durations,1)
    previews=[]
    for im in frames:
        bg=Image.new('RGBA',(512,512),'#182923');bg.alpha_composite(im);previews.append(bg.convert('RGB'))
    webp(previews,TARGET/'preview.webp',durations,0)
    master=Image.new('RGB',(2048,2048),'#182923')
    for j,i in enumerate(np.linspace(0,101,16).astype(int)):master.paste(previews[i],((j%4)*512,(j//4)*512))
    palette=master.quantize(256,Image.Quantize.MEDIANCUT)
    gif=[im.quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE) for im in previews]
    gif[0].encoderinfo={'append_images':gif[1:],'duration':durations,'loop':0,'disposal':1,'optimize':False}
    with (TARGET/'preview.gif').open('wb') as output:GifImagePlugin._save_all(gif[0],output,str(TARGET/'preview.gif'))
    animation=');metadata_end=source.index('
if __name__=='__main__':export()
