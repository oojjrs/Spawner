from riglib import *

def center_of(im):
    a=im[:,:,3];total=max(float(a.sum()),1);return np.array([(X*a).sum()/total,(Y*a).sum()/total],float)

def split_regions(source,labels,ids):
    selected=np.isin(labels,ids)
    dist,nearest=cv2.distanceTransformWithLabels(np.uint8(~selected),cv2.DIST_L2,5,None,None,cv2.DIST_LABEL_CCOMP)
    lookup=np.zeros(int(nearest.max())+1,np.int32)
    for label in ids:
        values=nearest[labels==label]
        if len(values):lookup[int(np.argmax(np.bincount(values)))]=label
    assigned=lookup[nearest]
    return {label:source*(assigned==label)[:,:,None] for label in ids}
