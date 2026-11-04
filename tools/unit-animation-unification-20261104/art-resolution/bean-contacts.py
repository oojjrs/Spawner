from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
root=Path('H:/Spawner');base=root/'$Trash/unit-animation-unification-20261104/art-resolution';dest=root/'DesignAssets/Animations/UnitAppearanceV1/bean';font=ImageFont.truetype('C:/Windows/Fonts/consola.ttf',18);sheet=Image.new('RGBA',(1024,2048),(238,238,238,255));draw=ImageDraw.Draw(sheet);records=[]
for mask in range(32):
 h=format(mask,'02x');j=json.loads((dest/h/'source.json').read_text('utf-8'));im=Image.open(root/j['image']).convert('RGBA').resize((256,256),Image.Resampling.LANCZOS);x=mask%4*256;y=mask//4*256;sheet.alpha_composite(im,(x,y));draw.text((x+12,y+10),h,(32,32,32,255),font);records.append({'mask':mask,'hex':h,'visualBits':j['visualBits'],'approvalState':j['approvalState'],'sourceId':j['sourceId'],'sourceHash':j['sourceHash']})
sheet.save(base/'bean-32-neutral-contact.png')
for group in [0,1,2,3,16,17,18,19]:
 page=Image.new('RGBA',(512,512),(238,238,238,255));d=ImageDraw.Draw(page)
 for i,mask in enumerate([group,group|4,group|8,group|12]):
  im=Image.open(dest/format(mask,'02x')/'Source/neutral.png').convert('RGBA').resize((256,256),Image.Resampling.LANCZOS);x=i%2*256;y=i//2*256;page.alpha_composite(im,(x,y));d.text((x+12,y+10),format(mask,'02x'),(32,32,32,255),font)
 page.save(base/('bean-batch-'+format(group,'02x')+'-contact.png'))
(base/'bean-32-mask-list.json').write_bytes(json.dumps(records,indent=2).encode('utf-8'));print('32 complete')
