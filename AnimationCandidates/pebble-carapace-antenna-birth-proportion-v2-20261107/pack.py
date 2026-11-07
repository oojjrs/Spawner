from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np,json,hashlib,shutil,copy
R=Path('/workspace/scratch/cdf786db13f9/Spawner');oldp=R/'AnimationCandidates/pebble-carapace-antenna-fullbody-v1-20261107';out=R/'AnimationCandidates/pebble-carapace-antenna-birth-proportion-v2-20261107';out.mkdir(exist_ok=True);(out/'Sources').mkdir(exist_ok=True)
j=json.load(open('/workspace/shared/pebble-ca-birth-atlas-size-job.json'));src=Path(j['path']);shutil.copy2(src,out/'Sources'/'edited-last-two-scene-atlas.png');oldman=json.load(open(oldp/'publication-manifest.json'));a0=oldman['actions']['birth'];old=Image.open(R/a0['sheet']).convert('RGBA');edited=Image.open(src).convert('RGBA');frames=[]
for i in range(8):
 f=old.crop((i%4*512,i//4*512,i%4*512+512,i//4*512+512)) if i<6 else edited.crop((round(i%4*edited.width/4),round(i//4*edited.height/2),round((i%4+1)*edited.width/4),round((i//4+1)*edited.height/2))).resize((512,512),Image.Resampling.LANCZOS)
 if i>=6:
  # Trim the entire scene outermost1px: alpha is <=1 there, all visible art is inside.
  framed=Image.new('RGBA',(512,512));framed.paste(f.crop((1,1,511,511)),(1,1));f=framed
 frames.append(f)
POLYS={6:[(312,382),(318,354),(341,332),(373,317),(391,316),(416,326),(440,347),(457,373),(464,398),(451,422),(435,440),(351,440),(325,426)],7:[(315,380),(322,350),(345,329),(370,314),(395,309),(422,320),(450,342),(468,369),(474,398),(457,424),(437,440),(349,440),(324,423)]}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def alpha_box(im,poly=None):
 ar=np.asarray(im);mask=ar[:,:,3]>=16
 if poly:
  q=Image.new('L',im.size);ImageDraw.Draw(q).polygon(poly,fill=255);mask&=np.asarray(q)>0
 y,x=np.where(mask);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
body={i:alpha_box(frames[i],POLYS[i]) for i in [6,7]};bb=body[7];ref=max(bb[2]-bb[0],bb[3]-bb[1]);pivot=[(bb[0]+bb[2])/2,bb[3]];D=a0['durationsMs'];prefix='pebble-carapace-antenna-birth-proportion-v2'
files={k:out/f'{prefix}-{ext}' for k,ext in [('sheet','sheet.png'),('preview','preview.webp'),('gif','preview.gif'),('cover','cover.png')]};sheet=Image.new('RGBA',(2048,1024))
for i,f in enumerate(frames):sheet.paste(f,(i%4*512,i//4*512))
sheet.save(files['sheet']);frames[0].save(files['preview'],save_all=True,append_images=frames[1:],duration=D,loop=0,lossless=True,method=6);frames[7].save(files['cover']);gs=[]
for f in frames:
 g=f.convert('RGB').quantize(colors=255,method=Image.Quantize.MEDIANCUT);g.paste(255,mask=f.getchannel('A').point(lambda a:255 if a<128 else 0));g.info['transparency']=255;gs.append(g)
gs[0].save(files['gif'],save_all=True,append_images=gs[1:],duration=D,loop=0,transparency=255,disposal=2,optimize=False)
a=copy.deepcopy(a0);a.update({k:str(p.relative_to(R)) for k,p in files.items()});a.update({k+'SHA256':sha(p) for k,p in files.items()});a.update(sourceSHA256=sha(src),pivotX=pivot[0],pivotY=pivot[1],referenceLength=ref,viewSize=ref,finalBodyBounds=bb,finalBodyMeasurementRegion=POLYS[7],finalBodyAnchorPending=False,finalBodyMeasurement='Alpha >= 16 within manually traced complete-character outline; nest-contact pixels excluded for measurement only. No artwork masking/compositing.',bodyBounds=[alpha_box(f) for f in frames])
for k in ['packScale','packCrop','packTranslationX','packTranslationY','sourceBodyBounds']:a.pop(k,None)
m={'tribe':'pebble','form':'carapace-antenna','status':'completed-under-user-delegated-correction','sourceAppearance':oldman['sourceAppearance'],'sourceAppearanceSHA256':sha(R/oldman['sourceAppearance']),'sourceBirth':a0['sheet'],'sourceBirthSHA256':sha(R/a0['sheet']),'sourceFacing':'right','method':'Built-in imagegen edited the final two complete scenes. Frames0-5 are exact original full-frame copies; frames6-7 are complete edited scene cells uniformly resized. No body-part or body/nest compositing.','actions':{'birth':a},'emptySceneOuterBorderTrimPixels':1,'replacedFrames':[6,7],'unchangedFrames':[0,1,2,3,4,5],'otherActionsChanged':False}
(out/'publication-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');(out/'generation-prompt.json').write_text(json.dumps(j,ensure_ascii=False,indent=2)+'\n')
idle=Image.open(R/oldman['sourceAppearance']).convert('RGBA');ib=alpha_box(idle);idleRatio=(ib[3]-ib[1])/(ib[2]-ib[0]);ratios={i:(b[3]-b[1])/(b[2]-b[0]) for i,b in body.items()}
contact=Image.new('RGB',(1440,204),(28,34,42));dr=ImageDraw.Draw(contact)
for i,f in enumerate(frames):
 c=f.copy();c.thumbnail((180,180));contact.paste(c,(i*180,24),c);dr.text((i*180+5,5),str(i)+(' corrected' if i>=6 else ' original'),fill='white')
contact.save(out/'qa-contact.png')
compare=Image.new('RGB',(960,350),(28,34,42));dr=ImageDraw.Draw(compare)
for col,(name,im,b) in enumerate([('old final',old.crop((1536,512,2048,1024)),a0['finalBodyBounds']),('corrected final',frames[7],bb),('approved idle',idle,ib)]):
 x,y,x2,y2=b;crop=im.crop(b);scale=230/max(x2-x,y2-y);crop=crop.resize((round(crop.width*scale),round(crop.height*scale)),Image.Resampling.LANCZOS);compare.paste(crop,(col*320+(320-crop.width)//2,300-crop.height),crop);dr.text((col*320+20,20),name+f' H/W={(y2-y)/(x2-x):.3f}',fill='white');dr.line((col*320,300,(col+1)*320,300),fill=(100,110,120))
compare.save(out/'body-proportion-comparison.png')
checks={}
for k in ['preview','gif']:
 im=Image.open(files[k]);dur=[]
 for i in range(im.n_frames):im.seek(i);im.load();dur.append(im.info['duration'])
 assert im.n_frames==8 and im.info['loop']==0 and dur==D;checks[k]={'frames':im.n_frames,'loop':im.info['loop'],'durationsMs':dur}
oldFrames=[old.crop((i%4*512,i//4*512,i%4*512+512,i//4*512+512)) for i in range(8)];same=[frames[i].tobytes()==oldFrames[i].tobytes() for i in range(8)];assert same[:6]==[True]*6
edges=[]
for f in frames:
 al=np.asarray(f)[:,:,3];edges.append(int((al[0]>0).sum()+(al[-1]>0).sum()+(al[:,0]>0).sum()+(al[:,-1]>0).sum()))
assert not any(edges)
# Compare the nest-only left zone, far from the touching character.
ious={}
for i in [6,7]:
 aa=np.asarray(oldFrames[i])[:,:300,3]>=16;bbm=np.asarray(frames[i])[:,:300,3]>=16;ious[i]=float((aa&bbm).sum()/(aa|bbm).sum())
q={'technicalChecksPassed':True,'firstSixOriginalPixelIdentical':same[:6],'allEightFramePixelHashesUnique':len({hashlib.sha256(f.tobytes()).hexdigest() for f in frames})==8,'finalExactBorderPixels':edges,'previewChecks':checks,'finalBodies':{i:{'bounds':b,'heightWidthRatio':ratios[i],'ratioRelativeToIdle':ratios[i]/idleRatio,'measurementRegion':POLYS[i]} for i,b in body.items()},'idleBounds':ib,'idleHeightWidthRatio':idleRatio,'oldFinalHeightWidthRatio':150/161,'nestLeftRegionAlphaIoU':ious,'nestNote':'The first6scenes are byte-identical. Imagegen preserved the nest design/location in the final2scenes; those complete scene pixels are not byte-identical. No code splicing of creature/nest pixels.','bodyPartsComposited':False,'browserPlaybackVerified':False,'packedContactReviewed':False};(out/'qa-report.json').write_text(json.dumps(q,ensure_ascii=False,indent=2)+'\n');shutil.copy2(__file__,out/'pack.py')
(out/'README.md').write_text('# 몽돌 갑각+안테나 탄생 끝포즈 비율 교정\n\n8프레임 중 앞6프레임은 기존 픽셀을 그대로 보존했다. 마지막2프레임만 이미지 편집으로 전신 비율을 승인 대기에 맞췄다. 둥지의 외형·위치와 출구 방향은 유지했고 각 수정 프레임은 둥지를 포함한 완전한 장면이다. 신체 파츠나 몸체/둥지를 코드로 합성하지 않았다. 다른 동작과 기존 후보 폴더는 변경하지 않았다.\n\npublication-manifest.json에 최종 몸체 기준점·길이·프레임 시간·파일 해시를 기록했다. qa-report.json에 몸체/대기 비율과 앞6프레임 보존, 둥지 왼쪽 영역 비교를 기록했다. 원본과 달리 마지막2장면 픽셀은 재작화 결과이며 바이트 동일하다는 뜻은 아니다. 브라우저 실재생 검수는 별도다.\n');print(json.dumps({'path':str(out),'bodies':body,'ratios':ratios,'idle':idleRatio,'pivot':pivot,'ref':ref,'nestIoU':ious},indent=2))
