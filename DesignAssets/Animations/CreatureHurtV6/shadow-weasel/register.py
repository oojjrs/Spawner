from pathlib import Path
from PIL import Image,ImageDraw
import json

FOLDER=Path(__file__).resolve().parent
CONTACTS={0:[225,248.5],1:[231,247.5],2:[235,249.5],3:[207,260.5],4:[211,259.5],5:[205,262.5],6:[193,261.5]}

def save_json(path,value):
    path.write_bytes((json.dumps(value,**{'indent':2})+'\n').replace('\n','\r\n').encode('utf8'))

def marker(image,point,label):
    result=Image.new('RGB',image.size,(35,43,39));result.paste(image,(0,0),image)
    draw=ImageDraw.Draw(result);x,y=point
    draw.line((x-7,y,x+7,y),(255,220,70),2);draw.line((x,y-7,x,y+7),(255,220,70),2)
    draw.text((5,5),label,(245,249,225))
    return result

def main():
    settings=json.loads((FOLDER/'settings.json').read_text('utf8'))
    size=settings['frameSize'];target=CONTACTS[0]
    (FOLDER/'Drawings').mkdir(**{'exist_ok':True})
    source_panel=Image.new('RGB',(size*4,(size+24)*2),(35,43,39))
    aligned_panel=source_panel.copy()
    crop_panel=Image.new('RGB',(600,180*7),(35,43,39))
    records=[]
    for cel,point in CONTACTS.items():
        source='Source/seed.png' if cel==0 else 'Source/V5Drawings/%02d.png'%cel
        image=Image.open(FOLDER/source).convert('RGBA')
        delta=[round(target[0]-point[0]),round(target[1]-point[1])]
        aligned=Image.new('RGBA',image.size);aligned.paste(image,tuple(delta))
        aligned.save(FOLDER/'Drawings'/('%02d.png'%cel))
        x,y=point;iy=int(y-.5);sample=image.getpixel((int(x),iy));below=image.getpixel((int(x),iy+1))
        records.append({'cel':cel,'source':source,'anatomicalContact':point,'contactIdentity':'Visible front toe sole of the near hind paw, underneath rear hock and ahead of the thick tail. Hand-identified in source drawing, not a box maximum or tail endpoint.','solePixel':[int(x),iy],'soleRgba':list(sample),'nextPixelAlpha':below[3],'translationPixels':delta,'registeredContact':[point[0]+delta[0],point[1]+delta[1]],'registeredDrawing':'Drawings/%02d.png'%cel})
        sx=cel%4*size;sy=cel//4*(size+24)
        before=marker(image,point,'cel %d source hind sole %s'%(cel,str(point)))
        after=marker(aligned,target,'cel %d aligned hind sole %s'%(cel,str(target)))
        source_panel.paste(before,(sx,sy+24));aligned_panel.paste(after,(sx,sy+24))
        for col,(original,contact,label) in enumerate([(image,point,'source'),(aligned,target,'registered')]):
            cx,cy=contact
            box=(int(cx)-35,int(cy)-40,int(cx)+40,int(cy)+5)
            crop=original.crop(box).resize((300,180),Image.Resampling.NEAREST)
            crop=marker(crop,((cx-box[0])*4,(cy-box[1])*4),'cel %d %s %s'%(cel,label,str(contact)))
            crop_panel.paste(crop,(col*300,cel*180))
    source_panel.save(FOLDER/'support-markers-source.png')
    aligned_panel.save(FOLDER/'support-markers-aligned.png')
    crop_panel.save(FOLDER/'support-contact-crops.png')
    save_json(FOLDER/'registration.json',{'species':'shadow-weasel','frameSize':size,'worldSpritePivot':[settings['pivotX'],settings['pivotY']],'worldPivotChanged':False,'artworkScale':1,'anchor':target,'anchorType':'near-hind-paw-visible-front-toe-sole','selection':'All seven contacts were identified from enlarged source anatomy. The source and registered marker sheets show the chosen toe below the rear hock; no automatic search or tail-tip anchor is used.','sourceVersion':'CreatureHurtV5','sourceDrawingsPreserved':True,'construction':'Only per-cel integer registration translation changes from V5. The accepted drawn spine curvature, chest/hip compression, face, joint flexion and tail shape are unchanged.','cells':records,'sourceMarkers':'support-markers-source.png','registeredMarkers':'support-markers-aligned.png','contactCrops':'support-contact-crops.png','registerer':'register.py'})
    print('shadow-weasel near-hind support',target,[(record['cel'],record['translationPixels'])for record in records])

if __name__=='__main__':main()
