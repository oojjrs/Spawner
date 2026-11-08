#!/usr/bin/env python3
"""READ-ONLY source inspection. Writes planning JSON only; never changes art/code."""
from pathlib import Path
import json,hashlib,re,math,collections
from PIL import Image
ROOT=Path(__file__).absolute().parents[2];HERE=Path(__file__).absolute().parent
snapshot=json.loads((HERE/'bean-spore-plan-registry.json').read_text())
audit=json.loads((HERE/'bean-spore-facing-audit.json').read_text())
targets={e['key'] for e in audit['entries'] if e['category']=='coherent_right_mirror_candidate'}
protected={e['key'] for e in audit['entries'] if e['key'] not in targets}
refs=collections.defaultdict(list)
def add(image,owner,registry,route,clip,role='atlas',effective=True,condition=None):
 if not image or not isinstance(image,str):return
 refs[image].append({'owner':owner,'registry':registry,'route':route,'role':role,'effective':effective,'condition':condition,'clip':clip})
def clip(c,owner,registry,route,effective=True):
 if not isinstance(c,dict):return
 if c.get('image'):add(c['image'],owner,registry,route,c,effective=effective)
 for i,l in enumerate(c.get('sceneLayers',{}).get('layers',[])):
  add(l['image'],owner,registry,route+f'.sceneLayers[{i}]',{**l,'parentScene':{k:c[k] for k in ('image','frameSize','frameHeight','sourceFacing','pivotX','pivotY','scene','sceneAnchor') if k in c}},role='sceneLayer:'+l.get('role','unknown'),effective=effective,condition='Birth layer load succeeds; parent baked image remains load-failure fallback.')
for owner,d in snapshot['UNIT_ACTION_ART'].items():
 add(d.get('portrait'),owner,'UNIT_ACTION_ART','portrait',{},role='portrait')
 clip(d['reference'],owner,'UNIT_ACTION_ART','reference')
 for action,c in d['actions'].items():clip(c,owner,'UNIT_ACTION_ART','actions.'+action,effective=not(action=='birth' and owner in snapshot['UNIT_BIRTH_ART']))
for owner,c in snapshot['UNIT_BIRTH_ART'].items():clip(c,owner,'UNIT_BIRTH_ART','birthOverride')
for tribe,forms in {'bean':snapshot['BEAN_HELD_HURT_SOURCES'],**snapshot['SPECIES_HELD_HURT_SOURCES']}.items():
 for form,c in forms.items():
  registry='BEAN_HELD_HURT_SOURCES' if tribe=='bean' else 'SPECIES_HELD_HURT_SOURCES';owner=tribe+'/'+form
  cc={**c,'frameCount':len(c['times'])*2,'timeFrameCount':len(c['times']),'sideBlocks':2}
  add(c['image'],owner,registry,'hurtOverride',cc,role='heldHurtTwoSides',condition='Non-combination, no legacy visual attributes; active living non-birth hurt draws before appearanceWorld.')
  for field in ('sourceImage','sourceAnimation'):
   if c.get(field):add(c[field],owner,registry,'hurtOverride.'+field,{},role='sourceLineage',condition='Provenance source, not necessarily a direct runtime draw; geometry must be independently resolved.')
for tribe,form in snapshot['UNIT_RANGED_FORMS'].items():
 owner=tribe+'/secretion'
 def walk(obj,path):
  if not isinstance(obj,dict):return
  if obj.get('image'):clip(obj,owner,'UNIT_RANGED_FORMS',path)
  for k,v in obj.items():
   if isinstance(v,dict):walk(v,path+'.'+k)
 walk(form,'rangedFallback')
for tribe,c in snapshot['UNIT_SECRETION_IDLE_ANIMATIONS'].items():clip(c,tribe+'/secretion','UNIT_SECRETION_IDLE_ANIMATIONS','rangedFallback.idleAnimation')
# Include active published sheet aliases and source portraits for all forms,
# so ownership is preserved even when the runtime uses another canonical path.
for owner,d in snapshot['UNIT_ACTION_ART'].items():
 manifest=d.get('sourceManifest');mp=ROOT/manifest if manifest else None
 if not mp or not mp.is_file():continue
 try:doc=json.loads(mp.read_text())
 except (ValueError,OSError):continue
 rows=doc.get('actions',{})
 if not isinstance(rows,dict):continue
 for action,c in rows.items():
  if not isinstance(c,dict) or not isinstance(c.get('sheet'),str):continue
  name=c['sheet'];path=name if name.startswith(('DesignAssets/','AnimationCandidates/')) else str((mp.parent/name).relative_to(ROOT))
  runtime_action={'ranged-attack':'ranged','melee':'attack'}.get(action,action)
  inherited=d.get('actions',{}).get(runtime_action,{})
  cc={k:inherited[k] for k in ('frameSize','frameHeight','columns','frameCount') if k in inherited}
  cc.update({k:doc[k] for k in ('frameSize','frameHeight','columns','frameCount') if k in doc})
  cc.update(c)
  if isinstance(cc.get('frameSize'),list):cc['frameSize'],cc['frameHeight']=cc['frameSize']
  add(path,owner,'publicationManifest',manifest+':actions.'+action,cc,role='publishedAtlas',condition='Active published source sheet; metadata may differ from runtime geometry and must be checked.')
 if isinstance(doc.get('sourceAppearance'),str):
  name=doc['sourceAppearance'];path=name if name.startswith(('DesignAssets/','AnimationCandidates/')) else str((mp.parent/name).relative_to(ROOT))
  add(path,owner,'publicationManifest',manifest+':sourceAppearance',{},role='sourceLineage',condition='Appearance provenance; inspect whether full atlas or one portrait before processing.')

selected={name:users for name,users in refs.items() if any(u['owner'] in targets for u in users)}
files=[];issues=[];sha_groups=collections.defaultdict(list)
for name,users in sorted(selected.items()):
 p=ROOT/name;entry={'image':name,'exists':p.is_file(),'users':[],'selectedUsers':sorted({u['owner'] for u in users if u['owner'] in targets}),'protectedOrOtherUsers':sorted({u['owner'] for u in users if u['owner'] not in targets})}
 if not p.is_file():entry['status']='missing';files.append(entry);issues.append({'image':name,'kind':'missing'});continue
 entry['sha256']=hashlib.sha256(p.read_bytes()).hexdigest();entry['bytes']=p.stat().st_size;sha_groups[entry['sha256']].append(name)
 with Image.open(p) as im:width,height=im.size;entry.update(dimensions=[width,height],format=im.format,temporalFrames=getattr(im,'n_frames',1))
 specs=[];roles=set()
 for u in users:
  c=u['clip'];role=u['role'];roles.add(role);fw=c.get('frameWidth',c.get('frameSize'));fh=c.get('frameHeight',fw);columns=c.get('columns');count=c.get('frameCount')
  if role=='portrait' or ('projectile' in u['route'] and not fw) or (role=='sourceLineage' and (u['route'].endswith('sourceImage') or u['route'].endswith('sourceAppearance'))):fw,fh,columns,count=width,height,1,1
  spec={'frameWidth':fw,'frameHeight':fh,'columns':columns,'frameCount':count,'explicitFrames':c.get('frames')}
  known=all(isinstance(v,(int,float)) and v>0 for v in (fw,fh,columns))
  if known:
   spec.update(rows=height/fh,capacity=(width/fw)*(height/fh),dimensionsMatch=(width==fw*columns and height%fh==0),frameCountFits=count is None or count<=columns*height/fh)
  else:spec['dimensionsMatch']=None
  if spec not in specs:specs.append(spec)
  entry['users'].append({k:v for k,v in u.items() if k!='clip'}|{'sourceFacing':c.get('sourceFacing'),'grid':spec,'timing':{k:c[k] for k in ('times','durationsMs','durationMs','loop','frames','timeFrameCount','sideBlocks') if k in c},'sceneMetadata':{k:c[k] for k in ('fullScene','worldTravelIncludedInPixels','sceneIncludesNest','sceneAnchor','scene','pivotX','pivotY','referenceLength','samples','wholeBody','parentScene') if k in c}})
 entry['gridVariants']=specs;entry['roles']=sorted(roles)
 valid_grids={(s['frameWidth'],s['frameHeight'],s['columns']) for s in specs if s['dimensionsMatch'] is not None}
 specials=[]
 if len(valid_grids)>1:specials.append('CONFLICTING_GEOMETRY')
 if any(s['dimensionsMatch'] is False for s in specs):specials.append('NON_DIVISIBLE_OR_MISMATCHED_GRID')
 if not valid_grids:specials.append('GEOMETRY_UNRESOLVED')
 if entry['temporalFrames']>1:specials.append('TEMPORAL_IMAGE_NOT_STATIC_ATLAS')
 if any(r.startswith('sceneLayer:') for r in roles):specials.append('SCENE_LAYER_INDEPENDENT_GRID_AND_PARENT_DESTINATIONS')
 if 'heldHurtTwoSides' in roles:specials.append('MIRROR_CELLS_AND_SWAP_LEFT_RIGHT_SIDE_BLOCKS')
 if any(u['clip'].get('fullScene') or u['clip'].get('sceneLayers') for u in users):specials.append('BAKED_SCENE_OR_LAYERED_FALLBACK')
 addressed=bool(re.fullmatch('[0-9a-f]{64}',p.stem));outside=bool(entry['protectedOrOtherUsers'])
 if addressed:op='new_content_addressed_file_after_encoding';dest=p.with_name('<sha256-of-encoded-left-image>'+p.suffix)
 elif outside:op='copy_on_write_for_selected_users';dest=p.with_name(p.stem+'-bean-spore-left-v1'+p.suffix)
 else:op='in_place_only_after_visual_approval';dest=p
 entry['proposedOperation']=op;entry['proposedDestination']=str(dest.relative_to(ROOT));entry['specialHandling']=specials;entry['executionAuthorized']=False
 if outside:entry['copyReason']='Same path used by preserved/external form; original must remain unchanged. Retarget selected registry references only.'
 if specials:issues.append({'image':name,'kind':specials})
 files.append(entry)
# Source-manifest facts and raw packing evidence, without loading arbitrary code.
manifest_facts=[]
for owner in sorted(targets):
 d=snapshot['UNIT_ACTION_ART'][owner];name=d.get('sourceManifest');p=ROOT/name if name else None
 if not p or not p.is_file():continue
 doc=json.loads(p.read_text());rows=doc.get('actions',{});packed=[];raw=[]
 for action,c in rows.items():
  if not isinstance(c,dict):continue
  if any(k in c for k in ('packCrop','packScale','sceneLayers')):packed.append({'action':action,**{k:c[k] for k in ('sheet','image','sourceSHA256','frameSize','frameHeight','columns','frameCount','packCrop','packScale','packTranslationX','packTranslationY','sourceBodyBounds','sceneLayers') if k in c}})
 source_dir=p.parent/'Sources';packer=p.parent/'pack.py';packer_text=packer.read_text() if packer.is_file() else ''
 for q in sorted(list(source_dir.glob('*'))+list((p.parent/'sources').glob('*'))):
  if q.suffix.lower() not in ('.png','.webp') or not q.is_file():continue
  digest=hashlib.sha256(q.read_bytes()).hexdigest();actions=[a for a,c in rows.items() if isinstance(c,dict) and c.get('sourceSHA256')==digest]
  with Image.open(q) as im:w,h=im.size
  rounding=('round(i%4*im.width/4)' in packer_text and 'round(i//4*im.height/2)' in packer_text)
  raw.append({'image':str(q.relative_to(ROOT)),'sha256':digest,'dimensions':[w,h],'matchedActionsBySourceSha':actions,'gridEvidence':str(packer.relative_to(ROOT)) if rounding else None,'cellRectangles':[[round(i%4*w/4),round(i//4*h/2),round((i%4+1)*w/4),round((i//4+1)*h/2)] for i in range(8)] if rounding else None,'unevenCells':rounding and (w%4!=0 or h%2!=0),'operation':'plan_only_keep_until_action_visual_approval_and_packed_reproduction_test'})
 for record in raw:
  q=ROOT/record['image'];w,h=record['dimensions'];action=q.stem.replace('-wholebody-generated','').replace('-generated','')
  if q.name=='approved-neutral.png':
   record.update(cellRectangles=[[0,0,w,h]],gridEvidence='Approved neutral source is one complete appearance image.',unevenCells=False)
  layout_path=p.parent.parent/'source-layouts.json'
  if layout_path.exists():
   layouts=json.loads(layout_path.read_text());layout=layouts.get(owner.split('/')[1],{}).get(action)
   if layout and layout.get('size')==[w,h]:
    n=len(layout['boxes']);cols=4;rows_count=n//4
    record.update(cellRectangles=[[round(i%cols*w/cols),round(i//cols*h/rows_count),round((i%cols+1)*w/cols),round((i//cols+1)*h/rows_count)] for i in range(n)],gridEvidence=str(layout_path.relative_to(ROOT)),sourceExtractionRectangles=layout['boxes'],unevenCells=w%cols!=0 or h%rows_count!=0,specialHandling='Component-bounds extraction and eye-spacing registration; mirror extraction bounds and reproduce packed frames before changing source.')
  build=p.parent/'build_package.py';build_text=build.read_text() if build.exists() else ''
  if ('cells(src,4,4)' in build_text and action!='birth') or ('cells(src,4,2)' in build_text and action=='birth'):
   cols=4;rows_count=2 if action=='birth' else 4;n=cols*rows_count
   record.update(cellRectangles=[[round(i%cols*w/cols),round(i//cols*h/rows_count),round((i%cols+1)*w/cols),round((i//cols+1)*h/rows_count)] for i in range(n)],gridEvidence=str(build.relative_to(ROOT)),unevenCells=w%cols!=0 or h%rows_count!=0,specialHandling='Whole-cell source calibration uses opaque bounds and may rigidly rotate birth poses; verify packed and scene trajectory reconstruction.')
  for metadata_path in p.parent.glob('*.json'):
   try:md=json.loads(metadata_path.read_text())
   except (ValueError,OSError):continue
   if isinstance(md,dict) and md.get('sourceSHA256')==record['sha256']:
    record.setdefault('matchingMetadata',[]).append(str(metadata_path.relative_to(ROOT)))
    if isinstance(md.get('registration'),list):record['registrationBefore']=md['registration']
 manifest_facts.append({'owner':owner,'manifest':name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'packedActions':packed,'rawSources':raw})
# Reuse the completed read-only reference index, and add explicit manifest
# ownership for newly included published aliases. Runtime registry ownership
# above is authoritative; this ancillary list is not an exhaustive code graph.
external=collections.defaultdict(set)
prior=HERE/'bean-spore-technical-plan.json'
if prior.exists():
 for e in json.loads(prior.read_text()).get('files',[]):external[e['image']].update(e.get('sourceFilesReferencingPath',[]))
for name,users in selected.items():
 for u in users:
  if u['registry']=='publicationManifest':external[name].add(u['route'].split(':actions.')[0].split(':sourceAppearance')[0])
for e in files:e['sourceFilesReferencingPath']=sorted(external[e['image']])
summary={'candidateForms':len(targets),'preservedForms':len(protected),'deduplicatedFiles':len(files),'totalBytes':sum(e.get('bytes',0) for e in files),'copyOnWriteFiles':sum(e.get('proposedOperation')=='copy_on_write_for_selected_users' for e in files),'contentAddressedFiles':sum(e.get('proposedOperation')=='new_content_addressed_file_after_encoding' for e in files),'heldHurtFiles':sum('heldHurtTwoSides' in e.get('roles',[]) for e in files),'sceneLayerFiles':sum(any(r.startswith('sceneLayer:') for r in e.get('roles',[])) for e in files),'rangedFallbackFiles':sum(any(u['registry'].startswith('UNIT_RANGED') or u['registry'].startswith('UNIT_SECRETION') for u in e['users']) for e in files),'rawSourceFiles':sum(len(m['rawSources']) for m in manifest_facts),'rawUnevenGridFiles':sum(bool(q['unevenCells']) for m in manifest_facts for q in m['rawSources']),'rawUnresolvedGridFiles':sum(q['cellRectangles'] is None for m in manifest_facts for q in m['rawSources']),'missing':sum(not e['exists'] for e in files)}
result={'status':'PLAN_ONLY_DO_NOT_EXECUTE','scope':'28 forms: all action/reference/portrait, actual UNIT_BIRTH_ART overrides and fallback baked sources, scene layers, held-hurt priority, ranged fallback and raw provenance. Birth/death/hurt visual approval pending.','summary':summary,'candidateForms':sorted(targets),'preservedForms':sorted(protected),'registrySnapshot':'tools/spring-native-facing-20261108/bean-spore-plan-registry.json','runtimePrecedence':[{'source':'client/game.js:5040-5059','order':['heldHurtOverride','appearanceWorld','legacySurfaceFallback']},{'source':'client/combat-stage.mjs:246-253','order':['heldHurtOverride','appearanceWorld','representativeArt','legacyBody']},{'source':'client/unit-action-art.mjs:47-53','rule':'UNIT_BIRTH_ART[key] overrides authored actions.birth when agent.birth is active; scene layer failures retain baked atlas fallback.'},{'source':'client/bean-held-hurt.mjs:55-93; client/species-held-hurt.mjs:10-46','rule':'Combinations excluded; no legacy visual attributes; bilateral side index=pose.frame+(sourceSide>0?times.length:0). Flip each cell AND exchange side blocks to preserve actual struck side.'},{'source':'client/unit-ranged.mjs:20-46','rule':'Secretion-only/stat-only ranged fallback includes own attack, idle, walk, hurt, lifecycle, projectile. Higher-priority blade/carapace/antenna/feet/strength/arms excludes fallback.'}],'files':files,'byteIdenticalGroups':[{'sha256':h,'paths':paths} for h,paths in sha_groups.items() if len(paths)>1],'publicationPacking':manifest_facts,'specialHandling':issues,'safetyRules':['No mutation authorized. Visual family candidate is not approval for all actions.','Never overwrite a source used by preserved/noncandidate forms. Use proposed same-directory filename and change only selected references later.','SHA-filename scene layers require new content-addressed names, even if all users selected.','Mirror scene destinations in parent canvas coordinates as parentWidth-x-width; mirror scene anchors/pivots/polygons separately; layer cells retain independent dimensions.','Unknown grid or conflicting geometry blocks transformation. Raw source packing requires original exact crop/resize/translation reconstruction.','Preserve timing, frame order, transparency and dimensions. Bilateral hurt block permutation is an explicit semantic exception, not a whole-sheet flip.','External metadata references are inventoried but not all prove ownership; review before mutation.']}
raw_dedup={}
for manifest in manifest_facts:
 for raw in manifest['rawSources']:
  record=raw_dedup.setdefault(raw['image'],{**raw,'users':[]})
  record['users'].append({'owner':manifest['owner'],'manifest':manifest['manifest'],'actions':raw['matchedActionsBySourceSha']})
result['rawSourceFiles']=list(raw_dedup.values())
result['summary']['deduplicatedRawSourceFiles']=len(raw_dedup)
(HERE/'bean-spore-technical-plan.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(summary,indent=2))
