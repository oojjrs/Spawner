import {PEBBLE_GROWTH_OCCLUSION} from "./pebble-growth-occlusion-data.mjs";
export const PEBBLE_BIRTH_DOORWAYS = Object.freeze({
  1: { front: 451, points: [[202,400],[230,403],[278,407],[317,410],[304,452],[304,512],[210,512],[210,451]] },
  2: { front: 433, points: [[181,324],[230,331],[286,338],[342,339],[331,382],[320,433],[320,512],[194,512],[194,426],[185,380]] },
  3: { front: 434, points: [[174,326],[323,329],[328,364],[312,434],[312,512],[185,512],[185,432],[177,373]] },
  4: { front: 349, points: [[199,305],[216,272],[246,255],[277,256],[306,276],[321,306],[318,348],[318,512],[202,512],[202,349]] }
});
export function createNativeNestFrames(){
 const frames=new Map();
 return {begin:()=>frames.clear(),record(id,descriptor){frames.set(String(id),Object.freeze(descriptor));},get:id=>frames.get(String(id))||null};
}
function box(matrix,x,y,w,h,pad=0){const points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>({x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}));return {left:Math.floor(Math.min(...points.map(p=>p.x))-pad),top:Math.floor(Math.min(...points.map(p=>p.y))-pad),right:Math.ceil(Math.max(...points.map(p=>p.x))+pad),bottom:Math.ceil(Math.max(...points.map(p=>p.y))+pad)};}
export function nativeBodyFrameBounds(ctx,pose,x,floor,scale,mirror,pad){const a=pose.animation,w=a.frameSize,h=a.frameHeight||w;return box(ctx.getTransform(),x+(mirror?-1:1)*(-a.pivotX)*scale,floor-a.pivotY*scale,(mirror?-1:1)*w*scale,h*scale,pad);}
export function createNativeBirthLayer(createCanvas,growthMask){
 let surface,maskSurface;const stats={direct:0,masked:0,maxPixels:0,maxMaskPixels:0,unsupported:0};
 function draw(ctx,environment,bounds,body){
  if(!environment){stats.direct++;return body(ctx);}
  const e=environment,envBox=box(e.transform,e.x,e.y,e.width,e.height,2);
  if(bounds.right<=envBox.left||bounds.left>=envBox.right||bounds.bottom<=envBox.top||bounds.top>=envBox.bottom){stats.direct++;return body(ctx);}
  const left=Math.max(0,bounds.left),top=Math.max(0,bounds.top),right=Math.min(ctx.canvas.width,bounds.right),bottom=Math.min(ctx.canvas.height,bounds.bottom),w=right-left,h=bottom-top;
  if(w<=0||h<=0){stats.direct++;return body(ctx);}
  const maskLeft=Math.max(0,envBox.left),maskTop=Math.max(0,envBox.top),maskWidth=Math.min(ctx.canvas.width,envBox.right)-maskLeft,maskHeight=Math.min(ctx.canvas.height,envBox.bottom)-maskTop;
  if(maskWidth<=0||maskHeight<=0){stats.direct++;return body(ctx);}
  if(!surface)surface=createCanvas(w,h);if(surface.width!==w)surface.width=w;if(surface.height!==h)surface.height=h;
  const layer=surface.getContext('2d'),m=ctx.getTransform();layer.resetTransform();layer.clearRect(0,0,w,h);layer.save();layer.setTransform(m.a,m.b,m.c,m.d,m.e-left,m.f-top);layer.globalAlpha=ctx.globalAlpha;layer.filter=ctx.filter;layer.imageSmoothingEnabled=ctx.imageSmoothingEnabled;layer.imageSmoothingQuality=ctx.imageSmoothingQuality;
  const result=body(layer);layer.restore();

  if(!maskSurface)maskSurface=createCanvas(maskWidth,maskHeight);if(maskSurface.width!==maskWidth)maskSurface.width=maskWidth;if(maskSurface.height!==maskHeight)maskSurface.height=maskHeight;
  const paint=maskSurface.getContext('2d');paint.resetTransform();paint.clearRect(0,0,maskWidth,maskHeight);paint.save();const t=e.transform;paint.setTransform(t.a,t.b,t.c,t.d,t.e-maskLeft,t.f-maskTop);paint.globalAlpha=e.alpha??1;paint.filter='none';paint.globalCompositeOperation='source-over';
  const mask=e.kind==='growth'?growthMask?.(e.level,e.frame.index):null;
  if(mask)paint.drawImage(mask,e.x,e.y,e.width,e.height);
  else {
   const door=e.kind==='growth'?null:PEBBLE_BIRTH_DOORWAYS[e.level];
   if(door){
    // Quantize once in global device space before subtracting the integer ROI
    // origin. This keeps aperture rasterization independent of scratch size.
    const project=(x,y)=>[Math.round((t.a*x+t.c*y+t.e)*256)/256-maskLeft,Math.round((t.b*x+t.d*y+t.f)*256)/256-maskTop];
    paint.resetTransform();paint.beginPath();
    [[e.x,e.y],[e.x+e.width,e.y],[e.x+e.width,e.y+e.height],[e.x,e.y+e.height]].forEach(([x,y],i)=>paint[i?'lineTo':'moveTo'](...project(x,y)));paint.closePath();
    door.points.forEach(([px,py],i)=>paint[i?'lineTo':'moveTo'](...project(e.x+px/512*e.width,e.y+py/512*e.height)));paint.closePath();paint.clip('evenodd');
    paint.setTransform(t.a,t.b,t.c,t.d,t.e-maskLeft,t.f-maskTop);
   }
   else stats.unsupported++;
   // Unknown visible geometry remains visible-native occlusion, never absence.
   const f=e.frame;if(f)paint.drawImage(e.sprite,f.x,f.y,f.size,f.size,e.x,e.y,e.width,e.height);else paint.drawImage(e.sprite,e.x,e.y,e.width,e.height);
  }
  paint.restore();layer.save();layer.resetTransform();layer.globalAlpha=1;layer.filter="none";layer.globalCompositeOperation="destination-out";layer.drawImage(maskSurface,maskLeft-left,maskTop-top);layer.restore();ctx.save();ctx.resetTransform();ctx.globalAlpha=1;ctx.filter='none';ctx.drawImage(surface,left,top);ctx.restore();stats.masked++;stats.maxMaskPixels=Math.max(stats.maxMaskPixels,maskWidth*maskHeight);stats.maxPixels=Math.max(stats.maxPixels,w*h);return result;
 }
 draw.release=()=>{for(const c of [surface,maskSurface])if(c)c.width=c.height=1;surface=maskSurface=undefined;};
 draw.stats=stats;return draw;
}
