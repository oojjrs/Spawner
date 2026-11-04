import fs from 'node:fs';
import {ATTRIBUTE_DNA as M} from '../../../../../server/dna.mjs';
const points=[];
for(let r=-2;r<=2;r++)for(let q=-2;q<=2;q++)if(M.inside({q,r},1))points.push({q,r});
const lookup=new Map(points.map((p,i)=>[M.key(p),i]));
const center=lookup.get('0,0'),first=lookup.get('1,0'),full=(1<<19)-1;
const adjacency=points.map(p=>Array.from({length:6},(_,direction)=>({id:lookup.get(M.key(M.step(p,direction))),direction})).filter(x=>x.id!==undefined));
const bits=points.map((p,i)=>1<<i),adjMasks=adjacency.map(a=>a.reduce((s,v)=>s|bits[v.id],0));
const reflect=points.map(p=>lookup.get(M.key({q:p.q+p.r,r:-p.r})));
let visits=0,count=0;
const histogram={},best=new Map(),path=[center,first],directions=[0];
const criteria=['straight','broad','sharp','balanced','smooth','angular','outerEarly','outerLate'];
function connected(mask){
 let flood=mask&-mask,front=flood;
 while(front){const bit=front&-front;front^=bit;const id=31-Math.clz32(bit),next=adjMasks[id]&mask&~flood;flood|=next;front|=next;}
 return flood===mask;
}
function record(){
 count++;
 const pieces=[],counts={A:0,B:0,C:0};
 let smooth=0,outerWeight=0;
 for(let i=1;i<directions.length;i++){const d=Math.abs(directions[i]-directions[i-1]),turn=Math.min(d,6-d);smooth+=turn;}
 for(let i=0;i<path.length;i++){const p=points[path[i]],radius=Math.max(Math.abs(p.q),Math.abs(p.r),Math.abs(p.q+p.r));if(radius===2)outerWeight+=i;}
 for(let i=0;i<18;i+=2){const rotation=directions[i],bend=(directions[i+1]-rotation+6)%6,type=bend===0?'A':bend===1||bend===5?'B':'C';counts[type]++;pieces.push({shape:[0,bend],rotation,type,points:path.slice(i,i+3).map(id=>points[id]),index:i/2+1});}
 const profile=counts.A+','+counts.B+','+counts.C;histogram[profile]=(histogram[profile]||0)+1;
 const signature=path.join(','),mirror=path.map(id=>reflect[id]).join(','),canonical=signature<mirror?signature:mirror;
 const scores={straight:counts.A*1000-smooth,broad:counts.B*1000-smooth,sharp:counts.C*1000-smooth,balanced:-(Math.max(...Object.values(counts))-Math.min(...Object.values(counts)))*1000-smooth,smooth:-smooth,angular:smooth,outerEarly:-outerWeight,outerLate:outerWeight};
 for(const criterion of criteria){const old=best.get(criterion);if(!old||scores[criterion]>old.score)best.set(criterion,{criterion,score:scores[criterion],signature:canonical,path:path.map(id=>points[id]),pieces,counts,smooth,outerWeight});}
}
function dfs(position,mask){
 visits++;
 if(mask===full){record();return;}
 const remaining=full^mask;
 if(!connected(remaining))return;
 for(const next of adjacency[position]){
  if(mask&bits[next.id])continue;
  path.push(next.id);directions.push(next.direction);dfs(next.id,mask|bits[next.id]);directions.pop();path.pop();
 }
}
const started=performance.now();dfs(first,bits[center]|bits[first]);
const selected=[];
for(const value of best.values())if(!selected.some(x=>x.signature===value.signature))selected.push(value);
const checks=selected.map(s=>{const pieces=s.pieces.map(p=>({gene:'gather',grade:1,rotation:p.rotation,shape:p.shape})),trace=M.trace(pieces,1);return {criterion:s.criterion,valid:trace.valid,occupied:trace.occupied.size,pieceCount:pieces.length};});
if(checks.some(c=>!c.valid||c.occupied!==19))throw Error('representative geometry mismatch');
const output={definition:'19 occupied board points; 9 anonymous 3-point pieces; no endpoint rejoin; central starting node; first direction fixed to zero',boardRadius:2,points,exactCount:{allRotations:count*6,rotationClasses:count,rotationReflectionClasses:count/2},visits,elapsedMs:performance.now()-started,histogram,representatives:selected,checks};
fs.writeFileSync(new URL('./hamiltonian.json',import.meta.url),JSON.stringify(output,null,2).replace(/\n/g,'\r\n'),'utf8');
console.log(JSON.stringify({exactCount:output.exactCount,visits,elapsedMs:output.elapsedMs,profiles:Object.keys(histogram).length,representatives:selected.map(s=>({criterion:s.criterion,counts:s.counts,smooth:s.smooth})),checks},null,2));