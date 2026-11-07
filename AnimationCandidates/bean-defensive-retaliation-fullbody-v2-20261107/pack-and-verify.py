from pathlib import Path
from PIL import Image, ImageDraw
from scipy.ndimage import label
import numpy as np, json, hashlib, math, shutil
D=Path(__file__).resolve().parent; R=D.parents[1]/'Spawner'; OUT=R/'AnimationCandidates/bean-defensive-retaliation-fullbody-v2-20261107'; OUT.mkdir(exist_ok=True)
forms=json.loads((D/'forms.json').read_text()); layouts=json.loads((D/'source-layouts.json').read_text())
posemap=[0,1,2,2,3,4,4,4,4,4,5,5,6,7,0,0]; durations=[60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60]
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def bounds(im,threshold=16):
 a=np.array(im)[:,:,3];y,x=np.where(a>=threshold);return [int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1)]
def support(im):
 a=np.array(im)[:,:,3];b=bounds(im);y,x=np.where((a>=16)&(np.indices(a.shape)[0]>=b[3]-max(3,round(im.height/64))));return float(x.mean()),b[3]
def rootrel(p):return str(p.relative_to(R))
entries=[]; checks=[]
for form,f in forms.items():
 F=D/form;P=OUT/form;P.mkdir(exist_ok=True);(P/'Sources').mkdir(exist_ok=True);(P/'attack-poses').mkdir(exist_ok=True)
 neutral=Image.open(F/'Sources/approved-idle-frame0.png').convert('RGBA'); S=f['size']; b=bounds(neutral,32); bx=b[2]-b[0];by=b[3]-b[1]; ax,ay=support(neutral)
 src=Image.open(F/'Sources/attack-wholebody-generated.png').convert('RGBA');boxes=layouts[form]['attack']['boxes'];gb=boxes[0];scale=math.sqrt(bx/(gb[2]-gb[0])*by/(gb[3]-gb[1]));poses=[];records=[]
 offsets=[0,-.025,-.035,.035,.085,.05,.02,0];sgn=1 if f['sourceFacing']=='right' else -1
 for i,bb in enumerate(boxes):
  if i in [0,7]:im=neutral.copy();records.append({'pose':i,'exactRegisteredIdleFrame0':True})
  else:
   l,t,r,bt=bb;l=max(0,l-4);t=max(0,t-4);r=min(src.width,r+4);bt=min(src.height,bt+4)
   whole=src.crop((l,t,r,bt));whole=whole.resize((round(whole.width*scale),round(whole.height*scale)),Image.Resampling.LANCZOS)
   sx,sy=support(whole);dx=round(ax-sx+sgn*offsets[i]*f['referenceLength']);dy=round(ay-sy)
   assert dx>=0 and dy>=0 and dx+whole.width<=S and dy+whole.height<=S,(form,i,dx,dy,whole.size)
   im=Image.new('RGBA',(S,S));im.paste(whole,(dx,dy));records.append({'pose':i,'sourceRect':[l,t,r,bt],'uniformWholeCelScale':scale,'wholeCelTranslation':[dx,dy]})
  poses.append(im);im.save(P/'attack-poses'/f'{i:03d}.png')
 frames=[poses[i] for i in posemap];stem=f'bean-{form}-attack-v2';sheet=Image.new('RGBA',(S*8,S*2))
 for i,im in enumerate(frames):sheet.paste(im,(i%8*S,i//8*S))
 sheetpath=P/(stem+'-sheet.png');sheet.save(sheetpath)
 webppath=P/(stem+'-transparent-preview.webp');frames[0].save(webppath,save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True)
 gifpath=P/(stem+'-preview.gif');bg=[]
 for im in frames:
  z=Image.new('RGBA',im.size,(238,240,229,255));z.alpha_composite(im);bg.append(z.convert('RGB'))
 bg[0].save(gifpath,save_all=True,append_images=bg[1:],duration=durations,loop=0,disposal=2,optimize=False)
 decoded=Image.open(webppath);decoded_frames=[];time=0
 for i in range(decoded.n_frames):
  decoded.seek(i);a=np.array(decoded.convert('RGBA'));dur=decoded.info['duration'];decoded_frames.append((time,time+dur,a));time+=dur
 assert time==1000;at=0
 for i,im in enumerate(frames):
  a=np.array(im);o=next(v for start,end,v in decoded_frames if start<=at<end);visible=a[:,:,3]>0
  assert np.array_equal(a[:,:,3],o[:,:,3]) and np.array_equal(a[:,:,:3][visible],o[:,:,:3][visible]),(form,i)
  at+=durations[i]
 assert np.array_equal(np.array(frames[0]),np.array(neutral)) and np.array_equal(np.array(frames[-1]),np.array(neutral))
 bb=[bounds(x) for x in poses];areas=[int((np.array(x)[:,:,3]>=16).sum()) for x in poses]
 contact=Image.new('RGB',(4*280,2*310),(238,240,229));draw=ImageDraw.Draw(contact)
 for i,im in enumerate(poses):
  # Identical world display scaling to compare actual idle with all action poses.
  display=200/f['referenceLength'];z=im.resize((round(S*display),round(S*display)),Image.Resampling.LANCZOS);tile=Image.new('RGBA',(280,280),(238,240,229,255));tile.alpha_composite(z,(round(140-f['pivotX']*display),round(245-f['pivotY']*display)));contact.paste(tile.convert('RGB'),(i%4*280,i//4*310));draw.text((i%4*280+8,i//4*310+285),('ACTUAL IDLE' if i in [0,7] else f'attack pose {i}')+(' HIT 300ms' if i==4 else ''),fill=(20,50,30))
 contactpath=P/'idle-to-attack-contact.jpg';contact.save(contactpath,quality=95)
 for name in ['approved-idle-frame0.png','attack-wholebody-generated.png']:shutil.copy2(F/'Sources'/name,P/'Sources'/name)
 geometry={k:f[k] for k in ['pivotX','pivotY','referenceLength','sourceFacing']};geometry.update({'sourceFacingSign':sgn,'sourceScale':40/f['referenceLength']})
 a={'tribe':'bean','form':form,'mask':f['mask'],'action':'attack','sheet':rootrel(sheetpath),'preview':rootrel(webppath),'gif':rootrel(gifpath),'frameSize':S,'columns':8,'frameCount':16,'framePoseIndices':posemap,'durationsMs':durations,'durationMs':1000,'loop':False,**geometry,'hitTimeMs':300,'hitAtMs':300,'contactMs':300,'hitFrameIndex':5,'hitPoseIndex':4,'sheetSHA256':sha(sheetpath),'previewSHA256':sha(webppath),'gifSHA256':sha(gifpath),'previewLoop':True,'previewLoopCount':0,'fullScene':False,'defensiveRetaliation':True,'meleeBodyOnly':True,'rangedBody':False,'referenceGeometry':{'basis':'Exact current registered idle frame 0 and runtime reference geometry, not UnitAppearanceV1 neutral. All poses use a single uniform whole-cel scale. First and last time samples are exact source RGBA pixels.','alphaThreshold':16,'neutralBounds':bounds(neutral),**geometry}}
 manifest={**a,'records':records,'method':'Imagegen whole-body redraw from actual registered idle. Code only crops complete cels, uniformly scales each entire cel by one fixed atlas scale, translates whole cels and packs. No body-part assembly, mirroring, warping, interpolation, or anatomy edits.'};mp=P/(stem+'.json');mp.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');a['manifest']=rootrel(mp)
 check={'form':form,'frameCount':16,'durationMs':1000,'hitTimeMs':300,'hitFrameIndex':5,'firstAndLastExactRegisteredIdle':True,'webpEveryTimelineSampleVisibleRGBAExactSheet':True,'fixedSingleScale':scale,'neutralSupport':[ax,ay],'referenceGeometry':geometry,'alpha16Areas':areas,'areaRatioToActualIdle':[round(x/areas[0],4) for x in areas],'poseBounds':bb,'clippedFrames':sum(b[0]<=0 or b[1]<=0 or b[2]>=S or b[3]>=S for b in bb),'forbiddenAddedOrgans':False,'visualAnatomyReview':'Actual registered identity directly compared: antenna has zero crown leaves; carapace keeps compact original crown and overlapping leaf armor.','sheetSHA256':sha(sheetpath),'previewSHA256':sha(webppath)}
 pub={'tribe':'bean','form':form,'mask':f['mask'],'status':'completed-under-user-delegated-correction','sourceAppearance':f['idle'],'sourceAppearanceFrame':0,'sourceAppearanceSHA256':sha(R/f['idle']),'sourceExtractSHA256':sha(P/'Sources/approved-idle-frame0.png'),'sourceBaseAttack':'DesignAssets/Animations/UnitAttack/attack.png','sourceBaseAttackTiming':'DesignAssets/Animations/UnitAttack/attack.json','actions':{'attack':a},'geometry':geometry,'defensiveRetaliation':True,'rangedBodyOnly':False,'projectileBakedIntoBodySheet':False,'gameIntegration':False,'deployment':False,'verification':check,'supersedes':f'AnimationCandidates/bean-defensive-retaliation-fullbody-v1-20261107/{form}/publication-manifest.json'}
 (P/'publication-manifest.json').write_text(json.dumps(pub,ensure_ascii=False,indent=2)+'\n');(P/'validation.json').write_text(json.dumps(check,ensure_ascii=False,indent=2)+'\n');entries.append(a);checks.append(check);print(form,json.dumps(check))
 del sheet,src,frames,poses,bg,decoded_frames
(OUT/'planning-entries.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2)+'\n');(OUT/'final-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
for n in ['pack-and-verify.py','generation-plan.json','forms.json','source-layouts.json']:shutil.copy2(D/n,OUT/n)
(OUT/'README.md').write_text('# 새싹콩 반격 공격 연속성 수정 v2\n\n실제 게임에 등록된 대기 프레임을 직접 기준으로 갑각·안테나 공격만 다시 제작했습니다. 갑각+안테나 v1은 이번 수정 대상이 아닙니다.\n\n- 첫/마지막 시간 샘플은 실제 idle frame 0의 RGBA 픽셀과 일치합니다.\n- 안테나: 768셀, pivot 383.5/654, referenceLength 333, 오른쪽. 접시 외에 머리잎이 없습니다.\n- 갑각: 256셀, pivot 128/230, referenceLength 145, 왼쪽. 기존 작은 머리잎과 몸 비율을 따릅니다.\n- 각 16샘플, 총 1000ms, 타격 300ms(frame index 5, pose 4) 유지. 원거리/발사체 없음.\n- 완성 전신 그림만 사용하고 코드 파츠 조립은 없습니다. 공유 등록/전투 규칙/기획서/git은 변경하지 않았습니다.\n')
print('DONE',OUT)
