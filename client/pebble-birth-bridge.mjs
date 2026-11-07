import {createNativeNestFrames,createNativeBirthLayer,nativeBodyFrameBounds} from './pebble-birth-native-layer.mjs';
import {createFirstDrawChoices} from './pebble-birth-choice.mjs';
import {createRoomMaskBank} from './pebble-birth-mask-bank.mjs';
import {unitActionArtPose} from './unit-action-art.mjs';
import {unitDisplaySize,unitFrameMirror} from './unit-size.mjs';
const birthId=a=>JSON.stringify([a.id,a.birth?.colonyId,a.birth?.startedAt]);
export function createNativeBirthBridge(adapter,createCanvas){const frames=createNativeNestFrames(),bank=createRoomMaskBank(createCanvas),choices=createFirstDrawChoices();let world=null,serial=0,activeNest=null;const layer=createNativeBirthLayer(createCanvas,(level,index)=>bank.mask(activeNest,level,index));return {
 beginWorld(identity){if(world===identity)return;world=identity;frames.begin();bank.leave();layer.release();choices.reset();},
 beginFrame(){frames.begin();bank.beginFrame(++serial);},
 recordNative(entry,descriptor){frames.record(entry.id,{...descriptor,nestId:entry.id});},
 draw(ctx,agent,time,x,floor,cell,mirror,{scopeVerified=false,presentationVerified=false,outlinePadding=0,beforeDraw=null,originalDraw}={}){if(!agent.birth||agent.health<=0||time<agent.birth.startedAt||time>=agent.birth.startedAt+2.62)return false;let choice=choices.peek(agent,time);if(!choice){const handle=adapter.readyHandle(agent);const eligible=adapter.ownsHandleFor(agent,handle)&&scopeVerified&&presentationVerified;const reserved=eligible&&bank.reserve(agent.birth?.colonyId,birthId(agent));choice=choices.select(agent,time,{scopeVerified:!!reserved,presentationVerified,handle});}if(!choice)return false;if(choice.source==='original')return originalDraw?.(ctx)??false;const pose=unitActionArtPose(agent,time);if(!pose||pose.action!=='birth')return false;const scale=cell*unitDisplaySize(agent)/pose.animation.referenceLength,flip=unitFrameMirror(pose.animation.sourceFacing,mirror?-1:1),bounds=nativeBodyFrameBounds(ctx,pose,x,floor,scale,flip,outlinePadding+2),environment=frames.get(agent.birth.colonyId);activeNest=agent.birth.colonyId;
 return layer(ctx,environment,bounds,target=>adapter.draw(target,choice.handle,agent,time,x,floor,cell,mirror,beforeDraw));},
 pruneDisplayed(agents,time){choices.pruneDisplayed(agents,time);bank.pruneDisplayedBirths(agents.filter(a=>a.health>0&&a.birth&&time>=a.birth.startedAt&&time<a.birth.startedAt+2.62).map(birthId));},
 leave(){frames.begin();bank.leave();layer.release();choices.reset();world=null;},bank,frames,stats:layer.stats
};}
