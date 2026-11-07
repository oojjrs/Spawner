from pathlib import Path
from PIL import Image, ImageDraw
from scipy.ndimage import label
import numpy as np
import hashlib, json, math

ROOT=Path(__file__).resolve().parent
REPO=Path('/workspace/scratch/cdf786db13f9/Spawner')
FORMS={'carapace':'갑각'}
DURATIONS=[60,70,60,80,30,50,50,50,50,50,50,70,80,90,100,60]
BG='#ddd9cf'
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def bounds(im,threshold=128): return im.getchannel('A').point(lambda a:255 if a>=threshold else 0).getbbox()
def webp_times(path):
 data=path.read_bytes(); p=12; result=[]
 while p+8<=len(data):
  kind=data[p:p+4]; size=int.from_bytes(data[p+4:p+8],'little'); chunk=data[p+8:p+8+size]
  if kind==b'ANMF': result.append(int.from_bytes(chunk[12:15],'little'))
  p+=8+size+(size%2)
 return result

for form,name in FORMS.items():
 d=ROOT; src=d/'sources/attack-generated.png'; raw=Image.open(src).convert('RGBA'); cells=[]; source_records=[]
 for i in range(16):
  x=i%4; y=i//4; box=(round(x*raw.width/4),round(y*raw.height/4),round((x+1)*raw.width/4),round((y+1)*raw.height/4)); f=raw.crop(box); a=np.asarray(f)[:,:,3]
  edges=int((a[0]>=128).sum()+(a[-1]>=128).sum()+(a[:,0]>=128).sum()+(a[:,-1]>=128).sum()); assert edges==0,(form,i,edges)
  cells.append(f); source_records.append({'index':i,'sourceCell':box,'sourceOpaqueBounds':bounds(f),'opaqueEdgePixels':edges})
 b0=bounds(cells[0]); scale=295/(b0[2]-b0[0]); cx=(b0[0]+b0[2])/2; frames=[]; records=[]
 for i,whole in enumerate(cells):
  b=bounds(whole); z=whole.resize((round(whole.width*scale),round(whole.height*scale)),Image.Resampling.LANCZOS); offset=(round(256-cx*scale),round(416-b[3]*scale)); f=Image.new('RGBA',(512,512)); f.alpha_composite(z,offset); a=np.asarray(f)[:,:,3]; bb=bounds(f)
  assert bb and bb[0]>0 and bb[1]>0 and bb[2]<512 and bb[3]<512,(form,i,'clipped')
  lab,_=label(a>=128); areas=np.bincount(lab.ravel())[1:]; components=int((areas>32).sum()); assert components==1,(form,i,components)
  frames.append(f); records.append({'index':i,'boundsAlpha16':bounds(f,16),'boundsAlpha128':bb,'connectedBodies':components,'sha256':hashlib.sha256(f.tobytes()).hexdigest(),'uniformWholeFrameScale':scale,'wholeFrameOffset':offset})
 assert len(set(r['sha256'] for r in records))>1
 stem='spore-'+form+'-counterattack-v2'; sheet_path=d/(stem+'-sheet.png'); sheet=Image.new('RGBA',(2048,2048))
 for i,f in enumerate(frames): sheet.paste(f,(i%4*512,i//4*512))
 sheet.save(sheet_path); saved=Image.open(sheet_path).convert('RGBA'); views=[]; contact=Image.new('RGB',(1024,1024),BG); draw=ImageDraw.Draw(contact)
 for i,f in enumerate(frames):
  actual=saved.crop((i%4*512,i//4*512,i%4*512+512,i//4*512+512)); assert actual.tobytes()==f.tobytes(); bg=Image.new('RGBA',(512,512),BG); bg.alpha_composite(actual); views.append(bg.convert('RGB')); contact.paste(bg.convert('RGB').resize((256,256)),(i%4*256,i//4*256)); draw.text((i%4*256+8,i//4*256+8),str(i)+' | '+str(sum(DURATIONS[:i]))+'ms',fill='#293038')
 contact.save(d/'qa/attack-contact.jpg',quality=96)
 palette=contact.resize((512,512)).quantize(colors=256); quantized=[v.quantize(palette=palette,dither=Image.Dither.NONE) for v in views]
 gif_path=d/(stem+'-preview.gif'); quantized[0].save(gif_path,save_all=True,append_images=quantized[1:],duration=DURATIONS,loop=0,disposal=2,optimize=False)
 webp_path=d/(stem+'-preview.webp'); frames[0].save(webp_path,save_all=True,append_images=frames[1:],duration=DURATIONS,loop=0,lossless=True,quality=80,method=0)
 gif=Image.open(gif_path); gif_times=[]; gif_hashes=[]
 for i in range(gif.n_frames): gif.seek(i); gif_times.append(gif.info['duration']); gif_hashes.append(hashlib.sha256(gif.convert('RGBA').tobytes()).hexdigest())
 wtimes=webp_times(webp_path); assert sum(gif_times)==sum(wtimes)==sum(DURATIONS)==1000; assert len(set(gif_hashes))>1
 b=records[0]['boundsAlpha16']; base='AnimationCandidates/spore-carapace-counterattack-v2-20261107/'
 action={'sheet':base+sheet_path.name,'preview':base+webp_path.name,'gif':base+gif_path.name,'frameSize':[512,512],'columns':4,'frameCount':16,'durationsMs':DURATIONS,'durationMs':1000,'loop':False,'previewLoop':True,'previewLoopCount':0,'sheetSHA256':sha(sheet_path),'previewSHA256':sha(webp_path),'gifSHA256':sha(gif_path),'sourceFacing':'right','neutralBodyBounds':b,'geometryAlphaThreshold':16,'pivotX':(b[0]+b[2])/2,'pivotY':b[3],'referenceLength':max(b[2]-b[0],b[3]-b[1]),'hitFrameIndex':5,'hitTimeMs':300,'fullScene':False,'attackKind':'base-style blunt cap-and-body counterattack','bodyPartComposition':False,'projectileBakedIntoBodySheet':False}
 manifest={'title':'포자버섯 '+name+' 반격용 전신 공격','tribe':'spore','form':form,'status':'replacement-candidate-after-proportion-audit','sourceAppearance':base+'source.png','approvedIdleReference':'DesignAssets/Animations/CombatAttributesV7/spore/Sheets/carapace/idle.webp','supersedes':'AnimationCandidates/spore-defensive-attack-fullbody-v1-20261107/carapace/publication-manifest.json','sourceAppearanceSHA256':sha(d/'source.png'),'sourceFacing':'right','actions':{'attack':action},'excludedActions':['ranged-attack'],'additiveActionsOnly':True,'preserveExistingOtherActions':True,'bodyPartComposition':False,'combatRulesModified':False,'gameIntegration':False,'deployment':False,'baseMotionReference':'DesignAssets/Tribes/spore/AnimationStudies/attack-directions-v3/right/attack.json','method':'Built-in image_gen draws each complete body. Technical processing only extracts cells, applies a single uniform clip scale and positions complete frames. No body-part assembly or anatomical warping.','verification':{'allActionsMultiFrame':True,'sheetRoundtripExact':True,'gifAndWebpDurationExact':True,'noOpaqueEdgeClipping':True,'oneConnectedBodyEveryFrame':True,'hitCueMatchesBaseMotion':True},'note':'Replaces only the previously too-tall carapace defensive attack; preserves approved squat idle proportions. Does not add ranged attacks or change combat eligibility, retaliation logic, stats, or initiative rules.'}
 (d/'publication-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
 report={'form':form,'sourceGrid':[4,4],'sourceSHA256':sha(src),'sourceCells':source_records,'frames':records,'uniqueSheetFrames':len(set(r['sha256'] for r in records)),'gifFrames':gif.n_frames,'gifDurationMs':sum(gif_times),'webpFrames':len(wtimes),'webpDurationMs':sum(wtimes),'hitTimeMs':300,'hitFrameIndex':5,'allChecksPassed':True,'visualReview':'Review qa/attack-contact.jpg before publication.','browserRuntimeReview':'Not performed by asset worker.'}
 (d/'quality-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
 (d/'README.md').write_text('# 포자버섯 '+name+' 반격 공격\n\n기본형 공격의 몸·갓 들이받기를 참고한 새 전신 공격입니다. 기존 승인 원화를 유지합니다.\n\n- 16프레임, 4열, 512×512 셀, 1000ms, 비반복 동작. 검토용 GIF/WebP는 반복합니다.\n- 타격: 300ms, zero-based frame 5. 기본형 타이밍을 그대로 사용합니다.\n- 원거리, 새 기관, 신체 파츠 조립, 부위 워핑 없음.\n- 기존 대기·이동·피격·탄생·사망은 변경하지 않는 추가 공격 패키지입니다.\n- 전투 규칙·선제공격·반격 조건·능력치는 변경하지 않았습니다.\n- publication-manifest.json에 실제 alpha16 기준점·최대축 크기·타이밍·해시가 있습니다.\n- sources/는 이미지 생성 원본, prompt.json은 생성 프롬프트, qa/는 전 프레임 검토 자료입니다.\n')
 print(form,'PASS',len(set(r['sha256'] for r in records)), 'unique frames; GIF/WebP 1000ms; hit300ms',flush=True)
