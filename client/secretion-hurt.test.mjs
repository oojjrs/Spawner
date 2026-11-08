import { unitPresentationTestSource } from "./unit-presentation-fixture.mjs";
import { SPECIES_HELD_HURT_SOURCES } from "./species-held-hurt-assets.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {unitRangedPose,unitRangedDisplaySize,UNIT_RANGED_FORMS,UNIT_RANGED_HURT_ANIMATIONS,UNIT_RANGED_IMAGE_ASSETS} from './unit-ranged.mjs';
import {unitAnimationPose} from './unit-animation.mjs';
import {unitAppearanceInventory} from './unit-appearance.mjs';
import {createCombatStage} from './combat-stage.mjs';
import {createSimulationTrial} from './combat-simulation.mjs';
const agent=(patch={})=>({id:'test',tribe:'spore',health:10,facing:1,attributes:{secretion:1,carapace:1,antenna:1,feet:1},hurtStartedAt:1,...patch});





test('observing secretion hurt cannot alter real simulation outcomes, events or hidden mechanics',()=>{
 const settings={left:{key:'spore',organs:{ranged:1},counts:{vitality:3}},right:{key:'bean',organs:{attack:1},counts:{vitality:3}},distance:1,random:false};
 const a=createSimulationTrial(settings),b=createSimulationTrial(settings);
 for(let i=0;i<100;i++){a.advance(.05);b.advance(.05);for(const unit of a.agents)unitRangedPose(unit,a.time);}
 assert.deepEqual(a.agents,b.agents);assert.deepEqual(a.history,b.history);assert.deepEqual(a.result(),b.result());
 assert.deepEqual(JSON.parse(JSON.stringify(a.vfx).replaceAll(a.vfx.streamId,'stream')),JSON.parse(JSON.stringify(b.vfx).replaceAll(b.vfx.streamId,'stream')));
});
