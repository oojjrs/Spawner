import test from "node:test";
import assert from "node:assert/strict";
import { createBeginnerHelp } from "./beginner-help.mjs";

function fixture(offer) {
  const element=()=>({style:{},children:[],listeners:{},hidden:false,disabled:false,textContent:"",
    replaceChildren(...children){this.children=children;},setAttribute(){},addEventListener(name,listener){this.listeners[name]=listener;}});
  const elements=Object.fromEntries(["beginner-help","beginner-construction","beginner-help-message"].map(id=>[id,element()]));
  const actions=[],document={getElementById:id=>elements[id],createElement:element};
  const ui=createBeginnerHelp(document,async value=>{actions.push(value);return {agentId:"born"};});
  ui.update("room",offer,true,false);return {elements,actions};
}

const requirements=[{type:"tree",name:"목재",amount:12,missing:12},{type:"pebbles",name:"자갈",amount:12,missing:12}];
test("채집 안내는 추천 개체가 맡을 자원과 실제 속성·생산비만 표시하고 같은 제안으로 생산한다", async () => {
  const offer={kind:"harvest",step:"test",buildingName:"전초둥지",name:"관통병",resources:["pebbles"],requirements,
    slots:["piercing"],attributes:["관통"],cost:5,canProduce:true};
  const {elements,actions}=fixture(offer),[text,details]=elements["beginner-help-message"].children,button=elements["beginner-construction"];
  assert.match(text.textContent,/자갈.*채집/);assert.doesNotMatch(text.textContent,/목재/);
  assert.equal(details.textContent,"자갈 12 · 관통");assert.equal(button.textContent,"관통병 생산 · 5P");
  await button.listeners.click();assert.equal(actions[0],offer);assert.equal(elements["beginner-help"].hidden,true);
});

test("변태와 운반은 역할을 구분하며 잠긴 속성의 생산 버튼을 막는다", () => {
  for(const [kind,word] of [["construction","변태"],["transport","운반"]]) {
    const offer={kind,buildingName:"전초둥지",name:kind,requirements,attributes:[],cost:5,canProduce:false,issue:"둥지 성장 필요"};
    const {elements}=fixture(offer);
    assert.match(elements["beginner-help-message"].children[0].textContent,new RegExp(word));
    assert.equal(elements["beginner-construction"].disabled,true);assert.equal(elements["beginner-construction"].title,offer.issue);
  }
});
