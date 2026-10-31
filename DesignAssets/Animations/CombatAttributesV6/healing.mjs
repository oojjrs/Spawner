import {healingPose as approvedPose} from '../CombatHealingStudyV1/healing.mjs';
export {HEALING_TIMING,healingFlight,drawReceivingEffect} from '../CombatHealingStudyV1/healing.mjs';
export function healingPose(rig,track,time,mode,target){
 const state=approvedPose(rig,track,time,mode,target);
 if(rig.tribe==='spore'&&mode==='ally'){
  const start=state.pose.start,length=rig.parts['healing-tube'].height*state.pose.tubeScale,dx=target[0]-start[0],dy=target[1]-start[1],distance=Math.hypot(dx,dy)||1,direction=[dx/distance,dy/distance],amount=state.aim*length*(.70-.48);
  for(const i of [2,3]){state.pose.points[i][0]-=direction[0]*amount;state.pose.points[i][1]-=direction[1]*amount}
 }
 return state;
}
