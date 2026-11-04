import fs from 'node:fs';
import {ATTRIBUTE_DNA as M} from '../../../../../server/dna.mjs';
const key=p=>`${p.q},${p.r}`;
const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const points=[];for(let r=-2;r<=2;r++)for(let q=-2;q<=2;q++)if(M.inside({q,r},1))points.push({q,r});
const half=[{q:0,r:0},...points.filter(p=>p.r>0||p.r===0&&p.q>0)];
const available=new Set(half.map(key));
const cycles=[];let visitedStates=0;
function dfs(path,used){
 visitedStates++;
 if(path.length===half.length){if(dirs.some(([q,r])=>path.at(-1).q+q===0&&path.at(-1).r+r===0))cycles.push([...path,{q:0,r:0}]);return;}
 const last=path.at(-1);
 for(const [q,r]of dirs){const next={q:last.q+q,r:last.r+r},id=key(next);if(available.has(id)&&!used.has(id)){used.add(id);path.push(next);dfs(path,used);path.pop();used.delete(id);}}
}
dfs([{q:0,r:0}],new Set(['0,0']));
function piecePaths(path){const pieces=[];for(let i=0;i<path.length-1;i+=2){const a=path[i],b=path[i+1],c=path[i+2];const d0=dirs.findIndex(([q,r])=>a.q+q===b.q&&a.r+r===b.r),d1=dirs.findIndex(([q,r])=>b.q+q===c.q&&b.r+r===c.r);pieces.push({gene:'gather',grade:1,rotation:d0,shape:[0,(d1-d0+6)%6]});}return pieces;}
const identity=p=>`${key(p.start)}>${key(p.middle)}>${key(p.end)}`;
function transformed(p,k,mirror){let q=p.q,r=p.r;if(mirror)[q,r]=[r,q];for(let i=0;i<k;i++)[q,r]=[-r,q+r];return {q,r};}
function pathSig(paths,k,mirror){return paths.map(p=>{const a=key(transformed(p.start,k,mirror)),b=key(transformed(p.end,k,mirror)),mid=key(transformed(p.middle,k,mirror));return [a,b].sort().join('|')+'@'+mid;}).sort().join(';');}
function signature(paths){return Array.from({length:12},(_,i)=>pathSig(paths,i%6,i>=6)).sort()[0];}
const unique=new Map();
for(const cycle of cycles){const rotated=cycle.map(p=>({q:-p.q,r:-p.r}));const pieces=[...piecePaths(cycle),...piecePaths(rotated)],trace=M.trace(pieces,1);if(!trace.valid||trace.occupied.size!==19)throw Error('trace mismatch');const counts={A:0,B:0,C:0};const paths=trace.paths.map((p,i)=>{const t=pieces[i].shape[1],type=t===0?'A':t===1||t===5?'B':'C';counts[type]++;return {...p,index:i+1,type};});const sig=signature(paths);if(!unique.has(sig))unique.set(sig,{id:'',pieces,paths,counts,occupied:trace.occupied.size,closed:trace.closed,rotationalSymmetry180:pathSig(paths,0,false)===pathSig(paths,3,false),reflections:Array.from({length:6},(_,k)=>k).filter(k=>pathSig(paths,0,false)===pathSig(paths,k,true))});}
const all=[...unique.values()];
const chosen=[];for(const type of ['A','B','C']){const candidate=all.slice().sort((a,b)=>b.counts[type]-a.counts[type]||b.reflections.length-a.reflections.length).find(c=>!chosen.includes(c));if(candidate)chosen.push(candidate);}
const balanced=all.slice().sort((a,b)=>Math.max(...Object.values(a.counts))-Math.min(...Object.values(a.counts))-(Math.max(...Object.values(b.counts))-Math.min(...Object.values(b.counts)))).find(c=>!chosen.includes(c));if(balanced)chosen.push(balanced);
chosen.forEach((c,i)=>c.id=i+1);
const output={boardPoints:points,boardRadius:2,halfCycleCountIncludingReverse:cycles.length,visitedStates,physicalRepresentativesAfterDihedralDedup:all.length,all,chosen,notes:['Each candidate fills all 19 level-1 points with 10 anonymous 3-point DNA pieces.','All candidates pass current M.trace(pieces,1) with explicit shape; no DNA attribute has been assigned.','Each candidate consists of a 10-edge half-cycle and its 180-degree copy.','This is the restricted two-half-cycle family, not the total full-board count.']};
fs.writeFileSync(new URL('./symmetric.json',import.meta.url),JSON.stringify(output,null,2).replace(/\n/g,'\r\n'),'utf8');
console.log(JSON.stringify({halfCycles:cycles.length,states:visitedStates,unique:all.length,chosen:chosen.map(c=>({id:c.id,counts:c.counts,reflections:c.reflections}))}));