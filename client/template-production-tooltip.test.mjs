import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';
import {ATTRIBUTE_DNA} from '../server/dna.mjs';
import {validateDna} from '../server/dna-unit.mjs';
import {birthCost,ATTRIBUTES,isAttributeUnlocked} from '../server/attributes.mjs';
import {DNA_STARTER_DESIGNS} from './dna-starter-designs.mjs';
const source=readFileSync(new URL('./game.js',import.meta.url),'utf8');
const declaration=name=>source.match(new RegExp('^    function '+name+'\\([^]*?^    }','m'))[0];
function fixture(){
 const scope=createContext({state:{agents:[],nestLevel:1,nestHealth:100,evolutionPoints:50,tribe:'bean'},connection:{online:true,busy:false},
 Spawner:{ATTRIBUTE_DNA,validateDna},birthCost,ATTRIBUTES,isAttributeUnlocked,unitCapacity:()=>30,slotCapacity:()=>3});
 runInContext(declaration('hasBirthplace')+declaration('dnaDesignValid')+declaration('templateProductionIssues'),scope);return scope;
}
const template=pieces=>({dna:{version:6,level:4,budget:1000,pieces:ATTRIBUTE_DNA.pack(pieces.map(gene=>({gene,grade:ATTRIBUTE_DNA.lookup.get(gene).grade,rotation:0})),4)}});

test('기본 설계의 레벨·판 크기·포인트 부족을 실제 검증 규칙과 맞춘다',()=>{
 const s=fixture();
 for(const starter of DNA_STARTER_DESIGNS){const t={dna:starter.design};const issues=s.templateProductionIssues(t);
 const allowed=!!validateDna(t.dna,s.state.nestLevel,s.state.evolutionPoints)&&s.state.evolutionPoints>=birthCost(t,'bean');
 assert.equal(issues.length===0,allowed,starter.name+': '+issues.join('\n'));}
 const t=template(['blade']);s.state.evolutionPoints=0;assert.match(s.templateProductionIssues(t).join('\n'),/둥지 Lv.2 필요 \(현재 Lv.1\)/);assert.match(s.templateProductionIssues(t).join('\n'),/현재 0P \/ 필요 15P/);
 s.state.nestLevel=2;s.state.evolutionPoints=15;assert.equal(s.templateProductionIssues(t).length,0);
});

test('동시에 부족한 모든 조건과 연결 상태를 표시하고 해제 후 지운다',()=>{
 const s=fixture(),t=template(['gather']);s.state.agents=Array.from({length:30},()=>({health:1}));s.state.nestHealth=0;s.state.evolutionPoints=3;s.connection.online=false;
 let text=s.templateProductionIssues(t).join('\n');assert.match(text,/30\/30마리/);assert.match(text,/8P 부족/);assert.match(text,/둥지가 파괴/);assert.match(text,/연결이 끊겼/);
 s.state.agents=[];s.state.nestHealth=100;s.state.evolutionPoints=11;s.connection.online=true;assert.equal(s.templateProductionIssues(t).length,0);
 s.connection.busy=true;assert.match(s.templateProductionIssues(t).join(''),/이전 요청/);s.connection.busy=false;s.state.ending={};assert.match(s.templateProductionIssues(t).join(''),/게임이 종료/);
});

test('중복 기관·겹침·큰 설계도·옛 속성 설계의 부족 조건을 구분한다',()=>{
 const s=fixture();s.state.nestLevel=4;s.state.evolutionPoints=1000;
 let t=template(['gather','gather']);assert.match(s.templateProductionIssues(t).join(''),/중복 기관/);
 t=template(['health','capacity']);t.dna.pieces[1]={...t.dna.pieces[0],gene:'capacity'};assert.match(s.templateProductionIssues(t).join(''),/조각이 겹칩니다/);
 t=template(['health']);t.dna.pieces[0].q=7;assert.match(s.templateProductionIssues(t).join(''),/DNA 판보다 큰/);
 assert.match(s.templateProductionIssues({slots:['strength','strength','strength','strength']}).join(''),/속성 슬롯 부족/);
});

test('비활성 생산 버튼의 설명은 포커스 가능한 설계도 카드에도 연결된다',()=>{
 const update=declaration('updateColonyPanel');assert.match(update,/spawn.disabled = issues.length > 0/);assert.match(update,/card.tabIndex = spawn.disabled \? 0 : -1/);assert.match(update,/spawn.style.pointerEvents = spawn.disabled \? "none" : ""/);assert.match(update,/issues.join\("\\n"\)/);assert.match(update,/card.setAttribute\("aria-label"/);
});
