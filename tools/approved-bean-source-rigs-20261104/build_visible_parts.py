#!/usr/bin/env python3
"""Source-only visible-part rigs and conservative grounded idle/hurt drafts.

These are review drafts, not approved action registrations. Occluded art is never
filled. Parts share a continuous visible-surface displacement, so an isolated eye
or leaf is never slid away to reveal an invented backing surface.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import math
import zlib
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import binary_dilation, distance_transform_edt, gaussian_filter, label, map_coordinates

from build import FAMILY, HERE, ROOT, relative, sha, spans_for, write_json

PART_ORDER = ['body', 'eye-left', 'eye-right', 'foot-left', 'foot-right', 'leaf-left', 'leaf-right',
              'blade-leaf', 'antenna-stalk', 'antenna-cap', 'armor-left', 'armor-right', 'secretion']
COLORS = ['#e4e0a7','#ec6986','#b480e4','#db9c50','#d0ba6a','#71b754','#4c9254',
          '#b3db4d','#6dbcb6','#80ded8','#5688c7','#87a7df','#c479bb']
HARD = {'leaf-left','leaf-right','blade-leaf','antenna-stalk','antenna-cap','armor-left','armor-right','secretion'}
YY, XX = np.mgrid[:512,:512]


def bbox(mask):
    y,x=np.where(mask)
    return [int(x.min()),int(y.min()),int(x.max()-x.min()+1),int(y.max()-y.min()+1)] if len(x) else None


def source_parts(source, rgba):
    """Annotate only observed pixels, using this source's registered face.

    The boundaries are conservative source-space draft cuts, not inferred hidden
    anatomy. Some visible junctions intentionally stay in the body connection.
    """
    lm=source['coreReference']['landmarks']; cx,ey=lm['faceMidpoint']; floor=lm['supportPoint'][1]
    present=rgba[:,:,3]>0
    cream=present & (rgba[:,:,2] > rgba[:,:,1]*.72) & (rgba[:,:,0] > rgba[:,:,1]*.84)
    components,_=label(cream)
    seed=components[int(ey+14),int(cx)]
    assert seed
    observed_skin=components==seed
    skin=binary_dilation(observed_skin,iterations=2)&present
    skin|=present&(YY>ey+45)&(XX>lm['leftEye'][0]+15)&(XX<lm['rightEye'][0]-15)
    result=np.zeros((512,512),dtype=np.uint8)
    regions={}
    def assign(name,mask):
        regions[name]=mask & present & (result==0)
        result[regions[name]]=PART_ORDER.index(name)+1
    # Eye patches include the observed dark eye and a narrow cream rim. They
    # remain rigid and never blink away to expose an absent face backing.
    eye_radius=math.dist(lm['leftEye'],lm['rightEye'])*.165
    for side in ['left','right']:
        ex,yy=lm[side+'Eye']
        assign('eye-'+side,(XX-ex)**2+(YY-yy)**2<=eye_radius**2)
    foot_cut=floor-(26 if source['mask']&8 else 18)
    for side in ['left','right']:
        ex,_=lm[side+'Eye']
        half=33 if source['mask']&8 else 22
        foot=(YY>=foot_cut)&(np.abs(XX-ex)<=half)&((XX<cx) if side=='left' else (XX>=cx))
        if not source['mask']&8:foot&=((XX-ex)/16)**2+((YY-(floor-9))/12)**2<=1
        assign('foot-'+side,foot)
    # Source-observed crown cut. This is a *visible* junction cut, not the top
    # of a presumed round body behind the carapace.
    crown_cut=ey-(84 if source['mask']&2 else 72)
    cap_bounds=None
    if source['mask']&4:
        central=present&(np.abs(XX-cx)<=25)&(YY<crown_cut-18)
        top=int(np.where(central)[0].min())
        widths=np.count_nonzero(present[:,max(0,int(cx-48)):min(512,int(cx+48))],axis=1)
        end=min(int(crown_cut-12),top+54)
        peak=top+int(np.argmax(widths[top:min(top+25,end)]))
        # The cap is an oval, not a rectangular crop that can steal adjoining
        # leaf corners. The first local neck valley terminates that oval.
        valleys=[y for y in range(peak+2,end-1) if widths[y]<=widths[y-1] and widths[y]<widths[y+1]]
        valley=valleys[0] if valleys else min(peak+18,end)
        bottom=valley+(10 if widths[valley]>widths[peak]*.7 else 2)
        ry=(bottom-top)/2;rx=widths[peak]/2+2;cap_y=(bottom+top)/2
        cap_bounds=[cx-rx,top,cx+rx,bottom]
        assign('antenna-cap',((XX-cx)/rx)**2+((YY-cap_y)/ry)**2<=1)
        assign('antenna-stalk',(YY>=bottom)&(YY<crown_cut+3)&(np.abs(XX-cx)<8))
    # Above the visible crown junction, blade and innate leaves are drawn as
    # complete visible surfaces. The blade replaces the right crown leaf.
    assign('leaf-left',(YY<crown_cut)&(XX<cx))
    assign('blade-leaf' if source['mask']&1 else 'leaf-right',(YY<crown_cut)&(XX>=cx))
    if source['mask']&16:
        # The secretion plate and visible nozzle occupy the right forehead.
        # Cream face pixels are retained by the body, including visible dots.
        gland=((XX-(cx+45))/77)**2+((YY-(ey-62))/32)**2<=1
        assign('secretion',gland&~skin)
    if source['mask']&2:
        assign('armor-left',~skin&(XX<cx))
        assign('armor-right',~skin&(XX>=cx))
    # Non-armored sources have a short green stem below the crown cut. Keep it
    # in the visible crown attachment, not in a fabricated concealed body.
    else:
        assign('leaf-left',(~skin)&(YY<ey-35)&(XX<cx))
        assign('blade-leaf' if source['mask']&1 else 'leaf-right',(~skin)&(YY<ey-35)&(XX>=cx))
    assign('body',present)
    # Earlier repeated assign calls are merged rather than replacing regions.
    regions={name:result==i+1 for i,name in enumerate(PART_ORDER)}
    assert np.all(result[present]>0)
    return regions,{'eyePatchRadius':eye_radius,'visibleCrownCutY':crown_cut,'visibleFootCutY':foot_cut,
                    'antennaCapBounds':cap_bounds,'observedSkinBounds':bbox(observed_skin),
                    'method':'source-landmarks, observed face-color component, source-space visible junction cuts',
                    'confidence':'draft-needs-part-boundary-review; no occluded extent inferred'}


def weight_map(regions, source):
    fixed=regions['foot-left']|regions['foot-right']
    for name in HARD: fixed|=regions[name]
    sx,sy,sw,sh=source['coreReference']['landmarks']['supportPixelBounds']
    fixed|=(YY>=sy)&(XX>=sx)&(XX<sx+sw)
    cx,cy=source['coreReference']['landmarks']['faceMidpoint']
    moving=(((XX-cx)/29)**2+((YY-(cy+13))/21)**2<=1)&regions['body']
    moving|=regions['eye-left']|regions['eye-right']
    assert not np.any(fixed&moving)
    d0=distance_transform_edt(~fixed); d1=distance_transform_edt(~moving)
    field=d0/np.maximum(1e-8,d0+d1)
    field=gaussian_filter(field,1)
    field[fixed]=0;field[moving]=1
    encoded=np.round(field*255).astype(np.uint8)
    field=encoded.astype(np.float64)/255
    gx=np.diff(field,axis=1);gy=np.diff(field,axis=0)
    # Rank-one displacement determinant = 1 + dot(delta, grad(weight)).
    # Bound over the full raster, including seams and transparent margins.
    worst=4*np.max(np.abs(gx))+2*np.max(np.abs(gy))
    scale=min(1,.42/max(worst,1e-9))
    return encoded,field,scale,fixed,moving


def part_mesh(mask, field, rigid_weight):
    positions=[];triangles=[];lookup={}
    def vertex(x,y):
        key=(x,y)
        if key not in lookup:
            lookup[key]=len(positions)
            w=float(field[min(511,y),min(511,x)]) if rigid_weight is None else rigid_weight
            positions.append([x,y,round(w,7)])
        return lookup[key]
    # Every triangle is bounded by the *owned* visible raster spans. No complete
    # rectangular body is fabricated underneath the separated patches.
    for y,left,right in spans_for(mask):
        axes=[left,*range(((left//12)+1)*12,right,12),right]
        for a,b in zip(axes,axes[1:]):
            p,q,r,s=vertex(a,y),vertex(b,y),vertex(b,y+1),vertex(a,y+1)
            triangles.extend([[p,q,r],[p,r,s]])
    return {'positionsXYBodyWeight':positions,'triangles':triangles,
            'uvRule':'[x/512,y/512]','scope':'this own visible part only; no hidden pixels',
            'evaluation':'rigid vertex weight for hard/eye/foot; body draft uses authoritative continuous data field'}


def action_delta(action,t,scale):
    if action=='idle': return np.array([1.4*math.sin(2*math.pi*t),-1.8*(1-math.cos(2*math.pi*t))/2])*scale
    if action=='hurt':
        impulse=math.sin(math.pi*t)*math.exp(-.8*t)
        return np.array([-4*impulse,2*impulse])*scale
    return np.zeros(2)


def render(rgba,field,delta):
    if np.max(np.abs(delta))<1e-12:return rgba.copy()
    by,bx=np.where(rgba[:,:,3]>0)
    left=max(0,int(bx.min())-5);right=min(512,int(bx.max())+6)
    top=max(0,int(by.min())-5);bottom=min(512,int(by.max())+6)
    yy,xx=np.mgrid[top:bottom,left:right]
    qx=xx.astype(float);qy=yy.astype(float)
    # Invert the continuous source-surface deformation. A single mapping is
    # shared at all part boundaries, so no hidden backing or new pixels appear.
    for _ in range(12):
        w=map_coordinates(field,[qy,qx],order=1,mode='nearest',prefilter=False)
        qx=xx-delta[0]*w;qy=yy-delta[1]*w
    src=rgba.astype(float)/255
    src[:,:,:3]*=src[:,:,3,None]
    out=np.stack([map_coordinates(src[:,:,c],[qy,qx],order=1,mode='constant',cval=0,prefilter=False) for c in range(4)],axis=2)
    out[:,:,:3]/=np.maximum(out[:,:,3,None],1e-12)
    out=np.round(np.clip(out,0,1)*255).astype(np.uint8)
    out[out[:,:,3]==0,:3]=0
    result=np.zeros_like(rgba);result[top:bottom,left:right]=out
    return result


def validate(source,rgba,regions,field,scale,fixed):
    reconstructed=np.zeros_like(rgba);owners=np.zeros((512,512),np.uint8)
    for mask in regions.values(): reconstructed[mask]=rgba[mask];owners[mask]+=1
    assert np.array_equal(rgba,reconstructed)
    assert owners.max()==1
    assert np.all(owners[rgba[:,:,3]>0]==1)
    # Exact extrema of the derivative of each bilinear cell occur at its four
    # corners. Central differences could understate a sharp constraint seam.
    gx_top=field[:-1,1:]-field[:-1,:-1];gx_bottom=field[1:,1:]-field[1:,:-1]
    gy_left=field[1:,:-1]-field[:-1,:-1];gy_right=field[1:,1:]-field[:-1,1:]
    contact=regions['foot-left']|regions['foot-right']
    hard=np.zeros((512,512),bool)
    for name in HARD:hard|=regions[name]
    eyes=regions['eye-left']|regions['eye-right']
    assert np.all(field[contact]==0) and np.all(field[hard]==0) and np.all(field[eyes]==1)
    actions={}
    for action in ['idle','hurt']:
        min_det=math.inf; max_disp=0;frames=0;max_fixed_error=0;max_edge_alpha=0
        for t in np.linspace(0,1,17):
            delta=action_delta(action,float(t),scale)
            min_det=min(min_det,*[float(np.min(1+delta[0]*gx+delta[1]*gy))
                                  for gx in [gx_top,gx_bottom] for gy in [gy_left,gy_right]])
            max_disp=max(max_disp,float(np.linalg.norm(delta)))
            # Actual raster frames, not just transform formula checks.
            frame=render(rgba,field,delta)
            error=np.abs(frame.astype(np.int16)-rgba.astype(np.int16))
            max_fixed_error=max(max_fixed_error,int(error[fixed].max()))
            max_edge_alpha=max(max_edge_alpha,int(max(frame[0,:,3].max(),frame[-1,:,3].max(),frame[:,0,3].max(),frame[:,-1,3].max())))
            frames+=1
        assert min_det>.57 and max_fixed_error==0 and max_edge_alpha==0
        assert np.max(np.abs(action_delta(action,0,scale)))<1e-12
        assert np.max(np.abs(action_delta(action,1,scale)))<1e-12
        actions[action]={'evaluatedRasterFrames':frames,'minimumJacobianDeterminant':min_det,
                         'maximumFaceDisplacementPixels':max_disp,'pinnedFeetAndHardPixelsMaxRgbaError':max_fixed_error,
                         'canvasEdgeAlphaMax':max_edge_alpha,'eyePatchMotion':'uniform rigid translation; no eye scaling',
                         'hiddenPixelsAdded':0,'qualityState':'draft-pending-human-motion-and-boundary-review'}
    return {'neutralMaxRgbaError':0,'ownedVisiblePixels':int(np.count_nonzero(owners)),
            'overlapPixels':int(np.count_nonzero(owners>1)),'actions':actions}


def make_annotation_sheet(entries):
    sheet=Image.new('RGB',(8*256,4*286),'#18251e');draw=ImageDraw.Draw(sheet)
    for entry in entries:
        mask=entry['mask'];rig=json.loads((ROOT/entry['rig']).read_text());rgba=np.array(Image.open(ROOT/rig['sourceImage']).convert('RGBA'))
        overlay=rgba.copy()
        for part in rig['parts']:
            color=tuple(int(part['reviewColor'][i:i+2],16) for i in [1,3,5])
            for y,a,b in part['coverageRuns']:
                overlay[y,a:b,:3]=(rgba[y,a:b,:3].astype(float)*.48+np.array(color)*.52).astype(np.uint8)
        x,y=mask%8*256,mask//8*286
        image=Image.fromarray(overlay).resize((256,256),Image.Resampling.LANCZOS)
        sheet.paste(image,(x,y),image);draw.text((x+6,y+260),f"{mask:02x} | {len(rig['parts'])} visible parts | draft",fill='#d8e5d8')
    sheet.save(HERE/'visible-parts-contact-31.png',optimize=True)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check',action='store_true')
    parser.add_argument('--skip-raster-qa',action='store_true',help='Development rebuild only; final report requires full QA')
    args=parser.parse_args()
    rep=FAMILY/'1f/Rig/rig.json';rep_hash=sha(rep.read_bytes());reference=json.loads(rep.read_text())
    assert len(reference['parts'])>=10
    entries=[];reports=[]
    for mask in range(31):
        folder=FAMILY/f'{mask:02x}'/'Rig';meta=FAMILY/f'{mask:02x}'/'source.json';metadata=meta.read_bytes();source=json.loads(metadata)
        image=(ROOT/source['image']).read_bytes();assert sha(image)==source['sourceHash'] and source['approvalState']=='approved'
        rgba=np.array(Image.open(ROOT/source['image']).convert('RGBA'))
        regions,annotation=source_parts(source,rgba)
        encoded,field,scale,fixed,moving=weight_map(regions,source)
        parts=[]
        for index,name in enumerate(PART_ORDER):
            part_mask=regions[name]
            if not part_mask.any():continue
            bounds=bbox(part_mask);x,y,w,h=bounds
            rigid_weight=1 if name.startswith('eye-') else None if name=='body' else 0
            pivot=list(source['coreReference']['landmarks'][name.split('-')[1]+'Eye']) if name.startswith('eye-') else [x+w/2,y+h/2]
            parts.append({'id':name,'sourceImage':source['image'],'sourceHash':source['sourceHash'],
                          'coverageRuns':spans_for(part_mask),'sourceBounds':bounds,'visiblePixels':int(np.count_nonzero(part_mask)),
                          'reviewColor':COLORS[index],'bone':name,'pivot':pivot,
                          'kind':'soft-body' if name=='body' else 'rigid-visible-part',
                          'draftBinding':'continuous-body-weight' if name=='body' else 'rigid-body-translation' if rigid_weight==1 else 'pinned-source-transform',
                          'canSeparateToExposeUnderlyingSurface':False,
                          'mesh':part_mesh(part_mask,field,rigid_weight)})
        qa=validate(source,rgba,regions,field,scale,fixed) if not args.skip_raster_qa else {'developmentOnly':True}
        rig={'schema':'spawner.visible-source-parts-draft.v1','tribe':'bean','mask':mask,
             'sourceId':source['sourceId'],'sourceHash':source['sourceHash'],'sourceImage':source['image'],
             'sourceMetadataSha256':sha(metadata),'approvalRef':source['approvalRef'],'provenance':source['provenance'],
             'frameSize':[512,512],'pivot':source['pivot'],'camera':source['camera'],
             'landmarks':source['coreReference']['landmarks'],'annotation':annotation,
             'referenceRig':{'path':relative(rep),'sha256':rep_hash,'usage':'bone/part vocabulary only; no source pixels or hidden backing reused'},
             'parts':parts,
             'bones':[{'id':'root','parent':None,'pivot':source['coreReference']['landmarks']['supportPoint'],'pinned':True}]+
                     [{'id':p['id'],'parent':'root' if p['draftBinding']=='pinned-source-transform' else 'body' if p['id']!='body' else 'root',
                       'pivot':p['pivot'],'rigid':p['kind']!='soft-body','draftBinding':p['draftBinding']} for p in parts],
             'bodyWeightMap':{'image':relative(folder/'body-weight.png'),'encoding':'uint8-gray-png; value/255',
                              'kind':'deformation-data-not-artwork','sha256OfDecodedU8':sha(encoded.tobytes()),
                              'fixedValue':0,'rigidFaceValue':1,'sampling':'bilinear continuous shared source-surface field'},
             'draftActions':{'amplitudeScale':scale,
                            'idle':{'durationMs':3600,'loop':True,'curve':'dx=1.4*sin(2*pi*t);dy=-1.8*(1-cos(2*pi*t))/2; both multiplied by amplitudeScale'},
                            'hurt':{'durationMs':760,'loop':False,'curve':'impulse=sin(pi*t)*exp(-.8*t);dx=-4*impulse;dy=2*impulse; both multiplied by amplitudeScale'},
                            'evaluation':'source(x,y)+bodyWeight(x,y)*delta(t); inverse sampled with premultiplied-alpha bilinear source colors',
                            'contacts':'all annotated foot pixels and registered support band remain unchanged throughout'},
             'readiness':{'worldReady':False,'actionState':'review-draft-only','productionActionClipsAdded':0,
                          'pending':['human review of each visible-part boundary','source-specific independent leaf/antenna/armor motion',
                                     'larger hurt poses if they need absent occluded art','walk and other required actions','game-scale action quality approval']},
             'qa':qa}
        out=folder/'visible-parts.json'
        if args.check:
            assert json.loads(out.read_text())==rig,relative(out)+' stale'
            assert np.array_equal(np.array(Image.open(folder/'body-weight.png')),encoded),'weight map changed'
        else:
            write_json(out,rig);Image.fromarray(encoded).save(folder/'body-weight.png',optimize=True)
        assert meta.read_bytes()==metadata and (ROOT/source['image']).read_bytes()==image
        entries.append({'mask':mask,'rig':relative(out),'sourceId':source['sourceId'],'sourceHash':source['sourceHash']})
        reports.append({'mask':mask,'sourceHash':source['sourceHash'],'partCount':len(parts),'visibleParts':[p['id'] for p in parts],
                        'amplitudeScale':scale,'annotationState':'draft-pending-boundary-review',**qa})
        print(f"bean {mask:02x}: {len(parts)} parts; idle/hurt draft QA {'skipped' if args.skip_raster_qa else 'passed'}",flush=True)
    assert sha(rep.read_bytes())==rep_hash
    manifest={'schema':'spawner.visible-source-parts-family-draft.v1','entries':entries,'preservedRepresentative':relative(rep)}
    report={'schema':manifest['schema'],'sourceCount':31,'existingRepresentativePreserved':True,'existingRepresentativeHash':rep_hash,
            'sourceOnly':True,'hiddenPixelsAdded':0,'borrowedBodyOrPartSources':0,'productionActionClipsAdded':0,'worldReadyAdded':0,
            'validationScope':'visible part coverage plus actual raster idle/hurt frames; draft, not human art/action approval',
            'sources':reports}
    if args.check:
        assert json.loads((HERE/'visible-parts-manifest.json').read_text())==manifest
        assert json.loads((HERE/'visible-parts-report.json').read_text())==report
    else:
        write_json(HERE/'visible-parts-manifest.json',manifest);write_json(HERE/'visible-parts-report.json',report)
        make_annotation_sheet(entries)
    compact=[]
    for entry in entries:
        rig=json.loads((ROOT/entry['rig']).read_text())
        weights=np.array(Image.open(ROOT/rig['bodyWeightMap']['image']),dtype=np.uint8)
        compact.append({key:rig[key] for key in ['mask','sourceId','sourceHash','sourceImage','frameSize','pivot','camera','landmarks','annotation','draftActions','readiness','qa']})
        compact[-1]['parts']=[{key:p[key] for key in ['id','coverageRuns','sourceBounds','visiblePixels','reviewColor','pivot','draftBinding']} for p in rig['parts']]
        compact[-1]['bodyWeightDeflateBase64']=base64.b64encode(zlib.compress(weights.tobytes(),9)).decode()
    data='globalThis.SpawnerBeanRigPreviewData=Object.freeze('+json.dumps({'schema':manifest['schema'],'entries':compact,'preservedRepresentative':'bean/1f'},separators=(',',':'),ensure_ascii=False)+');\n'
    destination=ROOT/'client/bean-rig-preview-data.js'
    if args.check:assert destination.read_text()==data,'hosted review data is stale'
    else:destination.write_text(data)
    print(json.dumps({'mode':'check' if args.check else 'build','sources':31,'parts':sum(x['partCount'] for x in reports),'hiddenPixelsAdded':0,'productionActionClipsAdded':0}))


if __name__=='__main__':main()
