import { unitDisplayAttributes } from "./unit-display-appearance.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createCombatEvolutionArt, combatEvolutionPose } from "./combat-evolution.mjs";
import { attributeAttackPose, renderAttributeAttack } from "../DesignAssets/Animations/CombatAttributesV7/attack.mjs";
import { evolutionBodyTransform, renderEvolutionFrame } from "../DesignAssets/Animations/CombatAttributesV7/renderer.mjs";

const multiply = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3],
  a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
function context() {
  let matrix = [1,0,0,1,0,0]; const stack = [];
  return { calls: [], globalAlpha: 1,
    save() { stack.push({ matrix: [...matrix], alpha: this.globalAlpha }); },
    restore() { const value = stack.pop(); matrix = value.matrix; this.globalAlpha = value.alpha; },
    transform(...value) { matrix = multiply(matrix, value); },
    translate(x,y) { this.transform(1,0,0,1,x,y); }, scale(x,y) { this.transform(x,0,0,y,0,0); },
    rotate(t) { this.transform(Math.cos(t),Math.sin(t),-Math.sin(t),Math.cos(t),0,0); },
    getTransform() { return Object.fromEntries(["a","b","c","d","e","f"].map((key,i) => [key,matrix[i]])); },
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {},
    getImageData() { return { data: new Uint8ClampedArray(512*512*4) }; },
    drawImage(image,...args) { this.calls.push({ image, args, matrix: [...matrix], alpha: this.globalAlpha }); }
  };
}
function surface(width,height) { const ctx = context(); return { width,height,getContext: () => ctx }; }
const source = readFileSync(new URL("./combat-evolution.mjs", import.meta.url), "utf8");
const scope = { attributeAttackPose, evolutionBodyTransform };
vm.createContext(scope);
vm.runInContext(source.slice(source.indexOf("  function drawReplacementFeet("), source.indexOf("  function drawSproutAttributes(")), scope);
const eq = (a,b) => a.forEach((value,i) => assert.ok(Math.abs(value-b[i])<1e-8, `${value} != ${b[i]}`));
const rigFile = (tribe, variant) => JSON.parse(readFileSync(new URL(`../DesignAssets/Animations/CombatAttributesV7/${tribe}/${variant}/rig.json`, import.meta.url)));

test("복합 유닛의 분리 발은 승인된 3종족 rig의 접지·웅크림·도약·피격 정책과 일치한다", () => {
  let count = 0, hidden = 0;
  for (const tribe of ["spore","pebble","spring"]) for (const variant of ["blade","piercing","carapace"]) {
    const rig = { ...rigFile(tribe,variant), opaque: true };
    rig.attackMotion = { ...rig.attackMotion, projectiles: [], impact: null };
    // Spring has no native foot artwork, but its approved motion still defines
    // the plant policy. A marker tests that same renderer branch explicitly.
    if (!rig.parts.some(part => part.id.startsWith("foot-"))) {
      rig.parts = [...rig.parts, { id: "foot-0", pivot: rig.root }];
      rig.slots = [...rig.slots, "foot-0"];
    }
    const images = Object.fromEntries(rig.parts.map(part => [part.id, part.id]));
    for (const id of Object.keys(rig.attackMotion.images)) images["attack-"+id] = id;
    for (const action of ["attack","hurt"]) for (const time of [0,160,240,300,380,520,720]) for (const facing of [-1,1]) {
      const native = context(); native.scale(facing,1);
      if (action === "attack") renderAttributeAttack(native,rig,images,time);
      else renderEvolutionFrame(native,rig,images,action,time);
      const original = native.calls.find(call => call.image === "foot-0"); assert.ok(original);
      const actual = context(); actual.scale(facing,1);
      scope.drawReplacementFeet(actual,rig,{action,sampleTime:time},(ctx,pose,layer) => {
        assert.equal(layer,"combat-feet"); ctx.drawImage("replacement");
      });
      // Source rig uses a 256px camera with ground y=230. The live composite
      // maps that camera to 512px with ground y=448, without fitting each pose.
      const camera = [2,0,0,2,0,-12];
      const neutral = [1/(2*rig.scale),0,0,1/(2*rig.scale),rig.root[0]-256/(2*rig.scale),rig.root[1]-448/(2*rig.scale)];
      eq(actual.calls[0].matrix,multiply(multiply(camera,original.matrix),neutral));
      assert.equal(actual.calls[0].alpha,original.alpha);
      if (!original.alpha) hidden++;
      count++;
    }
  }
  assert.equal(count,252); assert.ok(hidden>0,"rolling pebble hides tucked feet");
});

async function art() {
  const result = createCombatEvolutionArt(file => "data:application/json;base64," +
    readFileSync(new URL("../"+file,import.meta.url)).toString("base64"),surface,async file => ({ file,width:512,height:512 }));
  for (const tribe of ["bean","spore","pebble","spring"]) await result.prepare(tribe);
  return result;
}

test("분리 콜백은 전투+일반 부속지 조합의 공격·피격에만 요청된다", async () => {
  const renderer = await art();
  for (const tribe of ["spore","pebble","spring"]) for (const feet of [0,1]) for (const optIn of [false,true]) {
    for (const action of ["attack","hurt","idle","walk","death"]) {
      const layers = [], body = (ctx,pose,layer) => layers.push(layer);
      body.splitFeet = optIn;
      const agent = { tribe,attributes:{blade:1,antenna:1,strength:1,feet},health:action === "death" ? 0 : 10,
        bornAt:0,diedAt:10,hurtStartedAt:action === "hurt" ? 10 : -Infinity,
        attack:action === "attack" ? {startedAt:10,speed:1} : null,moveStartedAt:10,moveDuration:action === "walk" ? 1 : 0 };
      renderer.frame(agent,optIn ? 10.341 : 10.3,null,body);
      const split = optIn && ["attack","hurt"].includes(action);
      assert.deepEqual(layers,split ? [undefined,"combat-body","combat-feet"] : [undefined],`${tribe} ${feet} ${optIn} ${action}`);
    }
  }
  const layers = [], body = (ctx,pose,layer) => layers.push(layer); body.splitFeet = true;
  renderer.frame({tribe:"bean",attributes:{blade:1,feet:1},health:10,attack:{startedAt:10,speed:1}},10.3,null,body);
  assert.deepEqual(layers,[],"bean retains its existing root-foot renderer");
  assert.equal(renderer.frame({tribe:"spore",attributes:{feet:1},health:10},10.3,null,body),null,"base attacks never enter this compositor");
});

test("세 종족 7개 전투 속성 조합은 피격에서 발과 몸을 한 번씩 그리고 도약의 발 숨김도 보존한다", async () => {
  const renderer = await art();
  for (const tribe of ["spore","pebble","spring"]) for (let mask=1;mask<8;mask++) {
    const attributes = { feet:1,antenna:1,strength:1 };
    for (const [i,key] of ["blade","piercing","carapace"].entries()) attributes[key] = mask>>i&1;
    const agent = { tribe,attributes,health:10,bornAt:0,hurtStartedAt:10 };
    const layers = [], body = (ctx,pose,layer) => { layers.push(layer); ctx.drawImage(layer || "full"); };
    body.splitFeet = true;
    renderer.frame(agent,10.3,null,body);
    assert.deepEqual(layers,[undefined,"combat-body","combat-feet"],`${tribe} ${mask} hurt`);
    layers.length=0;
    renderer.frame({...agent,hurtStartedAt:-Infinity,attack:{startedAt:10,speed:1}},10.3,null,body);
    const fullyVisibleHop = mask===4 && tribe==="spore";
    assert.deepEqual(layers,fullyVisibleHop ? [undefined] : [undefined,"combat-body","combat-feet"],`${tribe} ${mask} attack`);
  }
});

test("실제 게임 콜백은 등록된 발·몸 레이어를 요청하고 기존 분리되지 않은 콜백도 지원한다", () => {
  const game = readFileSync(new URL("./game.js",import.meta.url),"utf8");
  const start=game.indexOf("    function drawAgentAppearanceLayer("), end=game.indexOf("    function drawCombatAgentAttributes(",start);
  const requests=[];
  const box={AGENT_HEIGHT:.8,state:{simSeconds:10.3},idleMotion:{matches:false},unitAnimationSheets:new Map(),
    Spawner:{unitDisplayAttributes,combatAttributeKeys:()=>["blade"],unitAnimationPose:()=>({action:"attack"}),hasCombatEvolution:()=>true},
    combatAttributeArt:{ready:()=>true,frame:(agent,time,scale,body)=>{
      assert.equal(body.splitFeet,true);
      for(const layer of [undefined,"combat-body","combat-feet"])body({drawImage(){}},{action:"attack"},layer);
      return {};
    }},tribeArt:{sprite:(tribe,attributes,layer)=>{requests.push([tribe,layer]);return{};}},
    drawCombatAgentAttributes(){},drawAgentAppearanceBody(){assert.fail("unexpected basic body fallback");},drawSelectionOutline(){}
  };
  vm.createContext(box);vm.runInContext(game.slice(start,end),box);
  for(const tribe of ["spore","pebble","spring"])box.drawAgentAppearanceLayer(context(),0,
    {tribe,attributes:{blade:1,strength:1,feet:1},attack:{startedAt:10}},100,{x:0,y:0},null,null,null);
  assert.deepEqual(requests,["spore","pebble","spring"].flatMap(tribe=>["full","combat-body","combat-feet"].map(layer=>[tribe,layer])));
});

// Ordinary antenna/arm portraits still contain native-sized support feet.
// The added-feet stat changes size, not whether the body has feet to separate.
test("추가 발 없는 부속지 조합도 기존 발 위치·레이어·숨김 정책을 따른다", async () => {
  const renderer = await art();
  const calls = (image, alpha = 1) => {
    const ctx = image?.getContext?.("2d");
    if (!ctx) return [{ image, alpha }];
    return ctx.calls.flatMap(call => calls(call.image, alpha * call.alpha));
  };
  let checked = 0;
  for (const tribe of ["spore","pebble","spring"]) for (let mask = 1; mask < 8; mask++) {
    for (const ordinary of [{ antenna:1 },{ strength:1 },{ arms:1 }]) for (const action of ["attack","hurt"]) {
      const attributes = { ...ordinary };
      for (const [i,key] of ["blade","piercing","carapace"].entries()) attributes[key] = mask >> i & 1;
      const layers = [], body = (ctx,pose,layer) => { layers.push(layer); ctx.drawImage(layer || "full"); };
      body.splitFeet = true;
      const agent = { tribe,attributes,health:10,bornAt:0,hurtStartedAt:action === "hurt" ? 10 : -Infinity,
        attack:action === "attack" ? {startedAt:10,speed:1} : null };
      const result = renderer.frame(agent,10.3,null,body), paint = calls(result);
      const fullyVisibleHop = action === "attack" && mask === 4 && tribe === "spore";
      if (!unitDisplayAttributes(agent).antenna && !unitDisplayAttributes(agent).strength && !unitDisplayAttributes(agent).arms) {
        assert.deepEqual(layers, [], "current DNA collapses to one combat form without legacy appendage callbacks");
      } else if (fullyVisibleHop) {
        assert.deepEqual(layers,[undefined]);
        assert.equal(paint.filter(call => call.image === "full").length,1);
      } else {
        assert.deepEqual(layers,[undefined,"combat-body","combat-feet"]);
        const feet = paint.filter(call => call.image === "combat-feet"), torso = paint.filter(call => call.image === "combat-body");
        assert.equal(feet.length,1); assert.equal(torso.length,1);
        assert.equal(paint.some(call => call.image === "full"),false,"registration portrait is never painted twice");
        assert.ok(paint.findIndex(call => call.image === "combat-feet") < paint.findIndex(call => call.image === "combat-body"),"support stays behind torso");
        assert.equal(torso[0].alpha,1,"body remains visible during foot tuck");
        const key = ["blade","piercing","carapace"].find(key => attributes[key]);
        const rig = rigFile(tribe,key), sampled = combatEvolutionPose(agent,10.3,{
          idle:{...rig.timelines.idle,action:"idle"},attack:{...rig.timelines.attack,action:"attack"},hurt:{...rig.timelines.hurt,action:"hurt"}
        });
        const alpha = action === "attack" && attributeAttackPose(rig,sampled.sampleTime).body.feetAlpha <= .35 ? 0 : 1;
        assert.equal(feet[0].alpha,alpha,`${tribe} ${mask} ${action} native visibility`);
      }
      checked++;
    }
  }
  assert.equal(checked,126);
});
