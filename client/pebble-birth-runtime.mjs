import {createPackedBirthAdapter} from './pebble-packed-birth.mjs';
import {PEBBLE_PACKED_BIRTH_CATALOG} from './pebble-packed-birth-catalog.mjs';
import {createFirstDrawChoices} from './pebble-birth-choice.mjs';
import {createNativeBirthBridge} from './pebble-birth-bridge.mjs';
// Candidate integration only. A timeout is failure fallback, not successful preparation.
export function createPebbleBirthRuntime({source,image,createCanvas,adapter:providedAdapter=null,preparationTimeoutMs=45000}){
 const adapter=providedAdapter||createPackedBirthAdapter({catalog:PEBBLE_PACKED_BIRTH_CATALOG,createCanvas,preparationTimeoutMs,loadImage:path=>{const result=image();result.src=source(path);return result;}});
 const bridge=createNativeBirthBridge(adapter,createCanvas),avatarChoices=createFirstDrawChoices();let generation=0,identity=null,lastTime=null,lastRevision=null,active=false,terrain=null;
 const stats={restoredFailures:0,preparationFailures:0};
 function reset(key){avatarChoices.reset();identity=key;bridge.beginWorld({key,generation:++generation});lastTime=lastRevision=null;}
 function identityOf(packet){return JSON.stringify([packet.roomId,packet.world?.seed,packet.world?.size]);}
 function terrainChanged(packet){const next=packet.world?.terrain;if(!next)return false;const changed=terrain!==null&&(terrain.length!==next.length||next.some((v,i)=>v!==terrain[i]));terrain=Uint8Array.from(next);return changed;}
 function observe(packet){const t=packet.state?.simSeconds,r=packet.revision;if((Number.isFinite(t)&&lastTime!==null&&t<lastTime)||(Number.isFinite(r)&&lastRevision!==null&&r<lastRevision))reset(identity);if(Number.isFinite(t))lastTime=t;if(Number.isFinite(r))lastRevision=r;}
 return {
 async enter(packet){const key=identityOf(packet);const changed=terrainChanged(packet);if(key!==identity||changed)reset(key);observe(packet);const token=++generation;active=false;const outcome=await adapter.prepareVerifiedRoomBirthCatalog();if(token!==generation)return {stale:true};active=true;stats.preparationFailures+=outcome.forms.filter(f=>f.status!=='ready').length;return {stale:false,outcome};},
 acceptSnapshot(packet){observe(packet);},
 beginFrame(displayedRoster,time){bridge.pruneDisplayed(displayedRoster,time);avatarChoices.pruneDisplayed(displayedRoster,time);bridge.beginFrame();},
 recordNative:(entry,descriptor)=>bridge.recordNative(entry,descriptor),
 draw(ctx,agent,time,x,floor,cell,mirror,{surface=null,reduced=false,outlinePadding=0,beforeDraw=null}={}){
  if(!active||agent?.tribe!=='pebble'||!agent.birth||agent.health<=0||time<agent.birth.startedAt||time>=agent.birth.startedAt+2.62)return null;
  // Reduced motion is already resolved by the native placement/scene and native nest draw.
  // The adapter keeps that exact pose/frame; it never substitutes a last cell.
  if(surface!=='world'&&surface!=='avatar')return null;
  if(surface==='avatar'){
   const handle=adapter.readyHandle(agent),choice=avatarChoices.select(agent,time,{scopeVerified:adapter.ownsHandleFor(agent,handle),presentationVerified:true,handle});
   if(choice.source==='original')return {handled:false,source:'original'};
   const drawn=adapter.draw(ctx,choice.handle,agent,time,x,floor,cell,mirror,beforeDraw);
   if(!drawn)stats.restoredFailures++;
   return {handled:true,source:'restored',drawn:!!drawn};
  }
  let original=false;
  const result=bridge.draw(ctx,agent,time,x,floor,cell,mirror,{scopeVerified:true,presentationVerified:true,outlinePadding,beforeDraw,originalDraw:()=>{original=true;return false;}});
  if(original)return {handled:false,source:'original'};
  // No source swap if an already selected restored body cannot be drawn.
  if(!result){stats.restoredFailures++;return {handled:true,source:'restored',drawn:false};}
  return {handled:true,source:'restored',drawn:true};
 },
 leave(){generation++;active=false;identity=null;terrain=null;lastTime=lastRevision=null;bridge.leave();avatarChoices.reset();},
 get active(){return active;},get generation(){return generation;},adapter,bridge,stats
 };
}
