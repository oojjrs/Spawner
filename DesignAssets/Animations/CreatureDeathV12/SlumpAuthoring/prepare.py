from pathlib import Path
import json
import shutil
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT=Path(__file__).resolve().parents[1]


def save_json(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))


def polygon_mask(polygons):
    image=Image.new('L',(2048,2048))
    draw=ImageDraw.Draw(image)
    for points in polygons:
        draw.polygon([(x*4,y*4) for x,y in points],255)
    image=image.resize((512,512),Image.Resampling.LANCZOS)
    return np.array(image.filter(ImageFilter.MaxFilter(5)))>80


def layer(image,mask):
    pixels=np.array(image)
    pixels[~mask]=0
    return Image.fromarray(pixels)


def mesh(image,part_name,settings):
    pixels=np.array(image)
    yy,xx=np.where(pixels[:,:,3]>0)
    bounds=[max(0,int(xx.min())-2),max(0,int(yy.min())-2),min(512,int(xx.max())+3),min(512,int(yy.max())+3)]
    x0,y0,x1,y1=bounds
    columns,rows=21,21
    vertices=np.array([[x,y] for y in np.linspace(y0,y1-1,rows) for x in np.linspace(x0,x1-1,columns)])
    triangles=[]
    for y in range(rows-1):
        for x in range(columns-1):
            k=y*columns+x
            triangles.extend([[k,k+1,k+columns],[k+1,k+columns+1,k+columns]])
    if part_name=='head':
        left,right=settings['head']['neckX']
        head_weight=np.clip((right-vertices[:,0])/(right-left),0,1)
        weights=np.column_stack([1-head_weight,head_weight])
        controls=[{'id':'neck','parent':'body','bind':[right,380],'startOffset':[0,0],'bodyInfluence':1,'startScaleX':1},
                  {'id':'skull','parent':'neck','bind':[140,375],'startOffset':settings['head']['offsetStart'],'bodyInfluence':1,'startScaleX':1}]
    elif part_name=='tail':
        weights=np.ones((len(vertices),1))
        controls=[{'id':'tail','parent':'body','bind':[450,370],'startOffset':[0,0],'bodyInfluence':1,'startScaleX':1}]
    else:
        config=settings['legs'][part_name]
        curve=[]
        for first,last in zip(config['rootCurve'],config['rootCurve'][1:]):
            curve.extend(np.linspace(first,last,20))
        curve=np.array(curve)
        distance=np.sqrt(((vertices[:,None,:]-curve[None,:,:])**2).sum(2).min(1))
        root_distance=np.maximum(0,distance-5)
        foot_distance=np.maximum(0,config['footLockY']-vertices[:,1])
        body=foot_distance/(foot_distance+root_distance+0.000001)
        body[root_distance==0]=1
        foot_ramp=np.clip((config['footLockY']-vertices[:,1])/12,0,1)
        body*=foot_ramp*foot_ramp*(3-2*foot_ramp)
        weights=np.column_stack([body,1-body])
        controls=[{'id':'hip','parent':'body','bind':config['points'][0],'startOffset':[0,0],'bodyInfluence':1,'startScaleX':1},
                  {'id':'paw','parent':'canvas','bind':config['points'][2],'startOffset':[0,0],'bodyInfluence':0,'startScaleX':1}]
    return {'id':part_name,'image':'Parts/'+part_name+'.png','bounds':bounds,'vertices':vertices.tolist(),
            'sourceVertices':(vertices-np.array([x0,y0])).tolist(),'triangles':triangles,'weights':weights.tolist(),'controls':controls}


def prepare(name,settings):
    folder=ROOT/name
    parts=folder/'Parts'
    masks_folder=folder/'Masks'
    source_folder=folder/'Source/SlumpRig'
    for path in [parts,masks_folder,source_folder]: path.mkdir(511,True,True)
    original=Image.open(folder/'Source/Keyframes/key-01-slump.png').convert('RGBA')
    pixels=np.array(original)
    pixels[pixels[:,:,3]>=240,3]=255
    original=Image.fromarray(pixels)
    masks={part:polygon_mask(polygons) for part,polygons in settings['polygons'].items()}
    head_guard=np.array(Image.fromarray(masks['head'].astype(np.uint8)*255).filter(ImageFilter.MaxFilter(9)))>0
    masks['fore-far']&=~head_guard
    orange=pixels[:,:,0].astype(int)-pixels[:,:,1].astype(int)>35
    for part in ['fore-far','fore-near','hind-near']: masks[part]&=~orange
    masks['hind-near']&=~masks['tail']
    masks['head']&=~masks['fore-near']
    owned=np.zeros((512,512),bool)
    for part in ['fore-near','head','tail','hind-near','fore-far']:
        masks[part]&=~owned
        owned|=masks[part]
    body_visible=layer(original,~owned)
    body_visible.save(parts/'body-visible.png')
    hidden_source=ROOT.parent/'CreatureDeathV11'/name/'Source/Keyframes/key-03-rest.png'
    shutil.copyfile(hidden_source,source_folder/'hidden-body-source.png')
    hidden=Image.new('RGBA',(512,512))
    hidden.paste(Image.open(hidden_source).convert('RGBA'),tuple(settings['hiddenShift']))
    hidden_pixels=np.array(hidden)
    hidden_pixels[hidden_pixels[:,:,3]>=240,3]=255
    envelope=polygon_mask([settings['bodyEnvelope']])
    solid=np.array(Image.fromarray((pixels[:,:,3]>=240).astype(np.uint8)*255).filter(ImageFilter.MinFilter(3)))>0
    allowed=envelope&solid&owned
    hidden_pixels[~allowed]=0
    hidden=Image.fromarray(hidden_pixels)
    hidden.save(parts/'body-fill.png')
    attachments=[]
    for part in ['fore-far','hind-near','tail','head','fore-near']:
        image=layer(original,masks[part])
        masks_image=Image.fromarray(masks[part].astype(np.uint8)*255)
        masks_image.save(masks_folder/(part+'.png'))
        data=mesh(image,part,settings)
        image.crop(tuple(data['bounds'])).save(parts/(part+'.png'))
        attachments.append(data)
    neutral=Image.open(folder/'Source/Keyframes/key-00-neutral.png').convert('RGBA')
    eyes=[]
    for index,eye in enumerate(settings['eyes']):
        patch=neutral.crop(tuple(eye['source'])).resize((eye['target'][2]-eye['target'][0],eye['target'][3]-eye['target'][1]),Image.Resampling.LANCZOS)
        patch.save(parts/f'eye-open-{index}.png')
        eyes.append({'image':f'Parts/eye-open-{index}.png','target':eye['target'],'closedLineY':eye['lineY']})
    rig={'name':name,'construction':'local-layer-and-skin-mesh','coordinateSpace':'image-uv-y-down','frameSize':512,'pivot':[256,448],
         'fps':30,'drop':settings['drop'],'endMs':settings['endMs'],'holdMs':settings['holdMs'],'blinkMs':settings['blinkMs'],
         'bodyVisible':'Parts/body-visible.png','bodyFill':'Parts/body-fill.png','drawOrder':[a['id'] for a in attachments],
         'attachments':attachments,'eyes':eyes,'approvedKeyframes':'../keyframes.json','hiddenBodySource':'Source/SlumpRig/hidden-body-source.png',
         'appearanceAuthority':'Source/Keyframes/key-01-slump.png','contactReference':'Source/Keyframes/key-00-neutral.png'}
    save_json(folder/'rig.json',rig)
    preview=hidden.copy()
    for data in attachments:
        preview.alpha_composite(Image.open(parts/(data['id']+'.png')),(data['bounds'][0],data['bounds'][1]))
    preview.alpha_composite(body_visible)
    preview.save(source_folder/'bind-pose.png')
    board=Image.new('RGBA',(2048,1024),'#26352f')
    for index,part in enumerate(['body-fill','body-visible','head','fore-near','fore-far','hind-near','tail']):
        image=Image.open(parts/(part+'.png')).convert('RGBA')
        if part not in ['body-fill','body-visible']:
            bounds=next(a['bounds'] for a in attachments if a['id']==part)
            full=Image.new('RGBA',(512,512));full.alpha_composite(image,(bounds[0],bounds[1]));image=full
        board.alpha_composite(image,(index%4*512,index//4*512))
    board.alpha_composite(preview,(1536,512))
    board.convert('RGB').save(source_folder/'layers-contact.png')
    print(name,'prepared',len(attachments),'parts')


if __name__=='__main__':
    config=json.loads((Path(__file__).parent/'config.json').read_text('utf-8'))
    for name,settings in config.items(): prepare(name,settings)
