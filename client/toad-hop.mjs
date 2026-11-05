// Approved original-cel v5 hop. All timing is normalized to a server cell move;
// no accumulated animation clock, new artwork, gameplay speed, or hitbox changes.
export const TOAD_HOP = Object.freeze({ cycleMs:880, takeoffMs:200, airborneMs:260, apex:.44, height:100 });
const CENTERS = [[127.3,165.7],[128.3,169.2],[121.2,91],[127.9,93.2],[127.9,86.4],[127.5,115],[129.7,173.1],[128.1,168.3]];
function clamp01(value) { return Math.max(0,Math.min(1,value)); }
function smooth(value) { const p=clamp01(value); return p*p*(3-2*p); }
export function toadHopMotion(progress) {
  const time=clamp01(progress)*TOAD_HOP.cycleMs;
  const phase=clamp01((time-TOAD_HOP.takeoffMs)/TOAD_HOP.airborneMs);
  let travel,height;
  if(phase<=TOAD_HOP.apex) {
    const u=phase/TOAD_HOP.apex;
    travel=.5*smooth(u); height=TOAD_HOP.height*(1-(1-u)**3);
  } else {
    const u=(phase-TOAD_HOP.apex)/(1-TOAD_HOP.apex);
    travel=.5+.5*smooth(u); height=TOAD_HOP.height*(1-u**3);
  }
  const airborne=time>=200&&time<460;
  const frame=time<110?0:time<200?1:airborne?
    phase<.16?1:phase<.48?3:phase<.56?4:phase<.84?5:6:time<560?6:7;
  let degrees=0;
  if(airborne) {
    if(phase<.25) degrees=40*smooth((phase-.08)/.17);
    else if(phase<.40) degrees=40;
    else if(phase<.60) degrees=40-80*smooth((phase-.40)/.20);
    else if(phase<.74) degrees=-40;
    else degrees=-40*(1-smooth((phase-.74)/.18));
  }
  // Blend the body registration into/out of the airborne pose, so takeoff and
  // landing meet the unmodified grounded cel exactly rather than snapping 3-7px.
  const blend=airborne ? smooth(phase/.16)*(1-smooth((phase-.84)/.16)) : 0;
  const [sourceX,sourceY]=CENTERS[frame], [restX,restY]=CENTERS[0];
  return { frame, travel, phase, height, rotation:degrees*Math.PI/180,
    sourceX,sourceY,targetX:sourceX+(restX-sourceX)*blend,
    targetY:sourceY+(restY-sourceY)*blend-height };
}
