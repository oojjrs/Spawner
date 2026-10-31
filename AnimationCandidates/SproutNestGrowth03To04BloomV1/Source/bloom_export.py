from pathlib import Path
import json,struct
import numpy as np
from PIL import Image,ImageDraw
from bloom_assets import write,rgba,read
from bloom_render import Scene,save_animation
ROOT=Path(__file__).resolve().parent.parent

def gif(images,path):
    import PIL.GifImagePlugin
    sample=Image.new('RGB',(512,512),'#edf0e7')
    for j,i in enumerate(range(0,84,6)):
        bg=Image.new('RGBA',(512,512),'#edf0e7');bg.alpha_composite(images[i],(0,0));sample.paste(bg.convert('RGB').resize((128,128),Image.Resampling.LANCZOS),((j%4)*128,(j//4)*128))
    palette=sample.quantize(256,Image.Quantize.MEDIANCUT);frames=[]
    for im in images:
        bg=Image.new('RGBA',(512,512),'#edf0e7');bg.alpha_composite(im,(0,0));frames.append(bg.convert('RGB').quantize(256,Image.Quantize.MEDIANCUT,0,palette,Image.Dither.NONE))
    first=frames[0];first.encoderinfo={'append_images':frames[1:],'duration':[50]*84,'loop':0,'disposal':2,'optimize':False}
    with open(path,'wb') as f:PIL.GifImagePlugin._save_all(first,f,str(path))

def loop_copy(source,target):
    data=bytearray(source.read_bytes());offset=12
    while offset<len(data):
        size=struct.unpack_from('<I',data,offset+4)[0]
        if data[offset:offset+4]==b'ANIM':struct.pack_into('<H',data,offset+12,0);target.write_bytes(data);return
        offset+=8+size+(size%2)
    raise RuntimeError('Missing WebP animation chunk')

def export():
    folder=ROOT/'Output';folder.mkdir(511,True,True);(folder/'Frames').mkdir(511,True,True);scene=Scene();images=[];records=[];sheet=Image.new('RGBA',(4096,5632));review=Image.new('RGBA',(1792,3072),'#edf0e7');d=ImageDraw.Draw(review)
    for i in range(84):
        im=rgba(scene.render(i));im.save(folder/'Frames'/('frame-%03d.png'%i));images.append(im);record=scene.last.copy();record['file']='Frames/frame-%03d.png'%i;record['durationMs']=50;record['rect']=[i%8*512,i//8*512,512,512];records.append(record);sheet.alpha_composite(im,(i%8*512,i//8*512));x=i%7*256;y=i//7*256;review.alpha_composite(im.resize((256,256),Image.Resampling.LANCZOS),(x,y));d.text((x+7,y+7),'%.2f'%(i/20),(40,70,50,255))
    sheet.save(folder/'growth.png');review.convert('RGB').save(folder/'review.png');write(folder/'animation.json',{'name':'SproutNestGrowth03To04BloomV1','frameSize':[512,512],'frameCount':84,'fps':20,'durationMs':4200,'durationsMs':[50]*84,'pivot':[256,448],'sheet':'growth.png','sheetSize':[4096,5632],'sheetColumns':8,'sheetRows':11,'coordinateSystem':'image-top-left','loop':False,'constructionChangesSeconds':[1.35,2.05,2.7],'temporalPoseAlphaBlending':False,'frames':records});rig=scene.rig.data();rig['keySeconds']=scene.times;rig['keyPoses']=scene.poses;rig['opacityKeys']=[];write(folder/'rig.json',rig);save_animation(images,folder/'growth.webp',1);loop_copy(folder/'growth.webp',folder/'preview.webp');gif(images,folder/'preview.gif');images[0].save(folder/'start.png');images[-1].save(folder/'final.png');print('Exported 84 frames, PNG sheet, WebP and GIF')

if __name__=='__main__':export()
