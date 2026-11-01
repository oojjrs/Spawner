export function outpostIdlePose(rig, phase) {
  const time=phase*Math.PI*2;
  return rig.parts.map(part=>({...part,rotation:part.angle?part.angle*(Math.sin(time+part.phase)-Math.sin(part.phase)):0,lightAmount:part.light?part.light*(1-Math.cos(time))*.5:0}));
}
export function drawOutpostIdle(context, rig, parts, phase) {
  context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,432,432);
  for(const part of outpostIdlePose(rig,phase)){
    context.save();
    if(part.pivot){context.translate(...part.pivot);context.rotate(part.rotation);context.translate(-part.pivot[0],-part.pivot[1]);}
    context.drawImage(parts[part.name],0,0);
    if(part.lightAmount>0){context.globalCompositeOperation='screen';context.globalAlpha=part.lightAmount;context.drawImage(parts[part.name],0,0);}
    context.restore();
  }
}