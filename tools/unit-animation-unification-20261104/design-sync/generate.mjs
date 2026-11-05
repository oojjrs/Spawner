import {UNIT_RANGED_ANIMATIONS,unitRangedDisplaySize,unitRangedProjectile} from '../../../client/unit-ranged.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {UNIT_ANIMATIONS,CREATURE_IDLE_ANIMATIONS,CREATURE_WALK_ANIMATIONS,CREATURE_ATTACK_ANIMATIONS,CREATURE_HURT_ANIMATIONS,CREATURE_DEATH_ANIMATIONS} from '../../../client/unit-animation.mjs';
import {AGENT_DEATH_ANIMATION} from '../../../client/agent-death.mjs';
import {TALON_OWL_IDLE} from '../../../client/talon-owl-idle.mjs';
import {BEETLE_SPRITE,BEETLE_ATTACK_SPRITE,BEETLE_ANIMATIONS} from '../../../server/beetle-animation.mjs';
import {UNIT_DISPLAY_SIZES} from '../../../client/unit-size.mjs';
import {UNIT_IMAGE_BOUNDS} from '../../../client/unit-image-bounds.mjs';
import {COMBAT_EVOLUTION_CATALOG} from '../../../client/combat-evolution-assets.mjs';
import {UNIT_COMBAT_DEATH_ANIMATIONS} from '../../../client/combat-death.mjs';
import {SPORE_BIRTH_ANIMATION,SPRING_BIRTH_ANIMATION,PEBBLE_BIRTH_ANIMATION} from '../../../client/birth.mjs';
import {imageScale,imageAnimation} from '../../../client/image-geometry.mjs';
const units={},bases=JSON.parse(readFileSync('$Trash/unit-animation-unification-20261104/design-sync/base-geometry.json','utf8'));
const aliases={'sprout-bean':'bean','spore-tribe':'spore','pebble-tribe':'pebble','spring-tribe':'spring'};
for(const key of Object.keys(UNIT_DISPLAY_SIZES)){
 const idle=UNIT_ANIMATIONS[key]?.idle||CREATURE_IDLE_ANIMATIONS[key]||(key==='talon-owl'?TALON_OWL_IDLE:BEETLE_SPRITE);
 const animations={idle,walk:UNIT_ANIMATIONS[key]?.walk||CREATURE_WALK_ANIMATIONS[key],attack:UNIT_ANIMATIONS[key]?.attack||CREATURE_ATTACK_ANIMATIONS[key],hurt:UNIT_ANIMATIONS[key]?.hurt||CREATURE_HURT_ANIMATIONS[key],jump:UNIT_ANIMATIONS[key]?.jump,death:key==='bean'?AGENT_DEATH_ANIMATION:UNIT_ANIMATIONS[key]?.death||CREATURE_DEATH_ANIMATIONS[key]};
 if(key==='spiny-back-beetle')for(const [action,clip] of Object.entries(BEETLE_ANIMATIONS))animations[action]={...(action==='attack'?BEETLE_ATTACK_SPRITE:BEETLE_SPRITE),...clip,durationsMs:clip.durations};
 const b=UNIT_IMAGE_BOUNDS[idle.image],idleScale=100*UNIT_DISPLAY_SIZES[key]/(Math.max(b.width,b.height)*idle.frameSize/b.frameSize);
 units[key]={tribe:!!UNIT_ANIMATIONS[key],idleScale,idle,animations,displaySize:UNIT_DISPLAY_SIZES[key]};
}
for(const [raw,base] of Object.entries(bases)){const key=aliases[raw]||raw,g=base.geometry;units[key].base={image:base.image,frameSize:g[0],frameHeight:g[1],pivotX:g[2]+g[4]/2,pivotY:g[3]+g[5],columns:1,durationsMs:[1000],loop:true,sourceScale:100*units[key].displaySize/Math.max(g[4],g[5]),native:true};}
for(const [key,birth] of Object.entries({spore:SPORE_BIRTH_ANIMATION,spring:SPRING_BIRTH_ANIMATION,pebble:PEBBLE_BIRTH_ANIMATION})){ const u=units[key],b=UNIT_IMAGE_BOUNDS[u.idle.image];u.animations.birth={...birth,sourceScale:u.idleScale*b.height*u.idle.frameSize/b.frameSize/(birth.unitHeight?birth.unitHeight*imageScale(birth.image):birth.height),loop:true};}
for(const [key,reference] of Object.entries(JSON.parse(readFileSync('$Trash/unit-animation-unification-20261104/design-sync/resource-geometry.json','utf8'))))units[key].resourceReference=reference;
units.bean.movementReference=JSON.parse(readFileSync('$Trash/unit-animation-unification-20261104/design-sync/bean-movement-geometry.json','utf8'));
for(const [key,scene] of Object.entries(JSON.parse(readFileSync('DesignAssets/Planning/UnitPreviews/birth-scenes.json','utf8')).scenes))units[key].birthScene=scene;
const attributes=Object.fromEntries(Object.entries(COMBAT_EVOLUTION_CATALOG).map(([key,value])=>[key,Object.fromEntries(Object.entries({...value.animations,death:UNIT_COMBAT_DEATH_ANIMATIONS[key]||value.animations.death}).map(([action,animation])=>[action,imageAnimation({...animation,pivotX:animation.pivotX??animation.pivot[0],pivotY:animation.pivotY??animation.pivot[1]})]))]));
const faceReferences=JSON.parse(readFileSync('$Trash/unit-animation-unification-20261104/design-sync/base-face-reference.json','utf8'));
for(const [key,definition] of Object.entries(COMBAT_EVOLUTION_CATALOG)){
 const rig=JSON.parse(readFileSync(definition.rig,'utf8')),hull=rig.parts.find(part=>part.id==='body').contactHull;
 const cuts=[];for(let i=0;i<hull.length;i++){const a=hull[i],b=hull[(i+1)%hull.length];if((a[1]<=rig.face[1]&&b[1]>rig.face[1])||(b[1]<=rig.face[1]&&a[1]>rig.face[1]))cuts.push(a[0]+(rig.face[1]-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
 const tribe=rig.tribe==='sprout'?'bean':rig.tribe,reference=faceReferences[tribe],width=(Math.max(...cuts)-Math.min(...cuts))*rig.scale;
 for(const animation of Object.values(attributes[key])) animation.sourceScale=100*UNIT_DISPLAY_SIZES[tribe]*reference.width/reference.sourceMax/(width*animation.frameSize/256);
}
for(const [tribe,animation] of Object.entries(UNIT_RANGED_ANIMATIONS)){
 const rangedAgent={tribe,health:10,stats:{ranged:true},attributes:{}};
 units[tribe].animations['ranged-attack']={...animation,sourceScale:unitRangedDisplaySize(rangedAgent)/animation.frameSize,projectile:{...unitRangedProjectile(rangedAgent),launchAtMs:animation.launchAtMs,flightMs:Math.min(350,animation.durationMs-animation.launchAtMs),travel:90}};
}
writeFileSync('client/unit-matrix-data.js','globalThis.SpawnerUnitMatrixData='+JSON.stringify({units,attributes,bounds:UNIT_IMAGE_BOUNDS})+';\r\n');
