import math
import numpy as np
from ribbon import rasterize

def make_pouch(image,rig):
    alpha=np.asarray(image)[:,:,3];yy,xx=np.where(alpha>96)
    left=int(xx.min())-3;right=int(xx.max())+3;top=int(yy.min())-3;bottom=int(yy.max())+3
    xs=np.linspace(left,right,max(3,math.ceil((right-left)/13)+1));ys=np.linspace(top,bottom,max(3,math.ceil((bottom-top)/13)+1))
    vertices=np.array([[x,y] for y in ys for x in xs]);triangles=[];columns=len(xs)
    for row in range(len(ys)-1):
        for col in range(columns-1):
            a=row*columns+col;indices=[a,a+1,a+columns,a+columns+1]
            region=alpha[max(0,int(ys[row])):min(512,math.ceil(ys[row+1])+1),max(0,int(xs[col])):min(512,math.ceil(xs[col+1])+1)]
            if not region.size or region.max()<2: continue
            triangles.extend([[a,a+1,a+columns],[a+1,a+columns+1,a+columns]])
    used=np.unique(np.array(triangles).ravel());lookup={int(old):new for new,old in enumerate(used)}
    vertices=vertices[used];triangles=np.array([[lookup[int(index)] for index in face] for face in triangles])
    center=np.array([(left+right)/2,(top+bottom)/2]);radius=np.array([(right-left)/2,(bottom-top)/2])
    local=(vertices-center)/radius;depth=rig['pouchDepth']*np.sqrt(np.maximum(0,1-(local*local).sum(1)))
    positions=np.column_stack([vertices,depth])
    edge_set=set()
    for a,b,c in triangles:
        for x,y in [(a,b),(b,c),(c,a)]: edge_set.add(tuple(sorted([int(x),int(y)])))
    edges=np.array(sorted(edge_set));lengths=np.linalg.norm(positions[edges[:,1]]-positions[edges[:,0]],**{'axis':1})
    fixed=vertices[:,1]<250+.23*(vertices[:,0]-138)+8
    return {'vertices':vertices.tolist(),'positions':positions.tolist(),'triangles':triangles.tolist(),'edges':edges.tolist(),'lengths':lengths.tolist(),'fixed':fixed.tolist()}

def simulate_pouch(mesh,states,rig):
    bind=np.array(mesh['positions'],float);positions=bind.copy();previous=positions.copy();vertices=np.array(mesh['vertices']);edges=np.array(mesh['edges']);lengths=np.array(mesh['lengths']);fixed=np.array(mesh['fixed'])
    free=(~fixed).astype(float);weights=free[edges[:,0]]+free[edges[:,1]];degree=np.bincount(edges.ravel(),**{'minlength':len(positions)}).astype(float)
    triangles=np.array(mesh['triangles']);homogeneous=np.column_stack([vertices,np.ones(len(vertices))]);output=[];dt=1/120
    last_time=0
    for state in states:
        goal_xy=(homogeneous@state['body'].T)[:,:2];goal=np.column_stack([goal_xy,bind[:,2]])
        steps=max(1,round((state['timeMs']-last_time)/1000/dt));last_time=state['timeMs']
        for substep in range(steps):
            time=state['timeMs']-(steps-substep-1)*dt*1000
            start,end=rig['pouchPressureRelease'];u=np.clip((time-start)/(end-start),0,1);support=1-u*u*(3-2*u)
            old=positions.copy();positions+=(positions-previous)*.975+np.array([4,rig['pouchGravity'],-80])*dt*dt*(1-support)
            for iteration in range(10):
                positions+=(goal-positions)*(support*.72)
                positions[fixed]=goal[fixed]
                a=edges[:,0];b=edges[:,1];delta=positions[b]-positions[a];distance=np.maximum(.0001,np.linalg.norm(delta,**{'axis':1}))
                relaxed_lengths=lengths*(.98+.02*support)
                amount=(distance-relaxed_lengths)/distance*.8/np.maximum(1,weights)
                error=delta*amount[:,None];correction=np.zeros_like(positions)
                np.add.at(correction,a,error*free[a,None]);np.add.at(correction,b,-error*free[b,None]);positions+=correction/np.maximum(1,degree[:,None])
                floor=rig['groundY']+rig.get('groundSlope',0)*(positions[:,0]-rig.get('groundX',0))
                positions[:,1]=np.minimum(positions[:,1],floor)
                positions[:,2]=np.maximum(positions[:,2],0)
                positions[:,0]=np.clip(positions[:,0],20,492)
            previous=old;positions[fixed]=goal[fixed];previous[fixed]=goal[fixed]
            floor=rig['groundY']+rig.get('groundSlope',0)*(positions[:,0]-rig.get('groundX',0));contact=positions[:,1]>=floor-.01
            previous[contact,1]=positions[contact,1];previous[contact,0]=positions[contact,0]-(positions[contact,0]-old[contact,0])*.6
        output.append(positions.copy())
    return output

def render_pouch(image,mesh,positions):
    triangles=np.array(mesh['triangles']);depth=positions[triangles,2].mean(1);order=np.argsort(depth)
    return rasterize(image,np.array(mesh['vertices']),positions[:,:2],triangles[order].tolist())
