import json
import runpy
from pathlib import Path
import numpy as np
from PIL import Image
from stabilize_rear import load_rear,apply_rear

folder=Path(__file__).resolve().parent.parent

def kernel(a,b):
    distances=np.sum((a[:,None]-b[None,:])**2,2)
    return distances*np.log(np.maximum(distances,1e-12))

def register(image,source,target):
    source=np.asarray(source,float)
    target=np.asarray(target,float)
    basis=np.c_[np.ones(len(target)),target]
    matrix=np.block([[kernel(target,target),basis],[basis.T,np.zeros((3,3))]])
    coefficients=np.linalg.solve(matrix,np.r_[source-target,np.zeros((3,2))])
    axis=np.arange(0,513,4)
    xx,yy=np.meshgrid(axis,axis)
    grid=np.c_[xx.ravel(),yy.ravel()]
    offsets=kernel(grid,target)@coefficients[:len(target)]+np.c_[np.ones(len(grid)),grid]@coefficients[len(target):]
    coordinates=(grid+offsets).reshape(len(axis),len(axis),2)
    mesh=[]
    for row in range(len(axis)-1):
        for column in range(len(axis)-1):
            bounds=(int(axis[column]),int(axis[row]),int(axis[column+1]),int(axis[row+1]))
            quad=np.array([coordinates[row,column],coordinates[row+1,column],coordinates[row+1,column+1],coordinates[row,column+1]]).ravel()
            mesh.append((bounds,tuple(quad)))
    return image.convert('RGBa').transform(image.size,Image.Transform.MESH,mesh,Image.Resampling.BICUBIC).convert('RGBA')

def main():
    states=json.loads((folder/'Source/registration.json').read_text('utf-8'))
    frames=[]
    rear=load_rear(folder/'Source/StableRear')
    for index,state in enumerate(states):
        image=Image.open(folder/'Source/MouthlessFrames'/str(str(state['inputFrame']).zfill(3)+'.png')).convert('RGBA')
        frame=image.copy() if index==0 else register(image,state['source'],state['target'])
        frame=apply_rear(frame,index,rear)
        frame.save(folder/'Source/Frames'/str(str(index).zfill(3)+'.png'))
        frames.append(frame)
    frames[-1].save(folder/'Source/Frames/007.png')
    runpy.run_path(str(folder/'Source/pack.py'))

if __name__=='__main__':main()
