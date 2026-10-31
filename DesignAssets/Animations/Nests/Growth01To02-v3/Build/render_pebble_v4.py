from riglib import *

BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'pebble'
PARTS=OUT/'Parts'
RIG=json.loads((OUT/'rig.json').read_text('utf-8'))
layers={part:premul(Image.open(PARTS/(str(part)+'.png'))) for part in range(8)}
pivots={int(key):tuple(value) for key,value in RIG['pivots'].items()}
start={int(key):value for key,value in RIG['keyPoses']['start'].items()}
end={int(key):value for key,value in RIG['keyPoses']['end'].items()}


def between(first,last,q):
    return (first[0]+(last[0]-first[0])*q,first[1]+(last[1]-first[1])*q)


def placed(part,position,scale,angle,opacity):
    pivot=pivots[part]
    return affine(layers[part],pivot,(scale,scale),angle,(position[0]-pivot[0],position[1]-pivot[1]))*opacity


def frame_at(index):
    lift=smooth((index-9)/30)
    widen=smooth((index-4)/35)
    value=affine(layers[0],(256,444),(.78+.22*widen,1),0,(0,0))
    for part in [4,5]:
        q=smooth((index-(3 if part==4 else 13))/22)
        if q<=0:
            continue
        origin=(82,425) if part==4 else (429,430)
        position=between(origin,end[part][0],q)
        angle=(-85 if part==4 else 85)*(1-q)
        position=(position[0],position[1]-6*math.sin(q*math.pi))
        value=over(placed(part,position,1,angle,smooth(q/.16)),value)
    for part in [1,2,3]:
        position=between(start[part][0],end[part][0],lift)
        scale=start[part][1]+(end[part][1]-start[part][1])*lift
        value=over(placed(part,position,scale,0,1),value)
    q=smooth((index-34)/20)
    if q>0:
        position=between((392,252),end[6][0],q)
        position=(position[0],position[1]-32*math.sin(q*math.pi))
        value=over(placed(6,position,1,70*(1-q),smooth(q/.15)),value)
    value=over(placed(7,(256,444),.78+.22*widen,0,1),value)
    return rgba(value)


frames=[frame_at(i) for i in range(61)]
markers={'rollLeft':620,'rollRight':1020,'supportLift':860,'capRoll':1860,'settled':2660}
RIG['phaseKeys']=[0,3,13,34,54,60]
RIG['keyFrames']=[0,3,13,34,54,60]
RIG['motion']='staggered-stone-roll-stack'
RIG['drawOrder']=[0,4,5,1,2,3,6,7]
RIG['partKeys']={'4':{'from':[82,425],'to':end[4][0],'frames':[3,25],'angle':[-85,0],'scale':1},'5':{'from':[429,430],'to':end[5][0],'frames':[13,35],'angle':[85,0],'scale':1},'6':{'from':[392,252],'to':end[6][0],'frames':[34,54],'angle':[70,0],'arcHeight':32,'scale':1},'existingSupports':{'frames':[9,39],'from':RIG['keyPoses']['start'],'to':RIG['keyPoses']['end']}}
json_write(OUT/'rig.json',RIG)
export(frames,OUT,{'source':'Parts','method':'rigid-stones-staggered-roll-stack','phaseMarkers':markers})
