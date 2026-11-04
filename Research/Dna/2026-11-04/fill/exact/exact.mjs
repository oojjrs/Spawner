import fs from 'node:fs';
import {ATTRIBUTE_DNA as M} from '../../../../../server/dna.mjs';
const started=Date.now();
const points=[];
for(let r=-2;r<=2;r++)for(let q=-2;q<=2;q++)if(Math.max(Math.abs(q),Math.abs(r),Math.abs(q+r))<=2)points.push({q,r});
const index=new Map(points.map((p,i)=>[p.q+','+p.r,i]));
const root=index.get('0,0'),rootBit=1<<root,all=(1<<19)-1;
const dirs=[[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
const neighbors=points.map(p=>dirs.map(d=>index.get((p.q+d[0])+','+(p.r+d[1]))).filter(i=>i!==undefined));
const transforms=[];
for(const mirror of [false,true])for(let rotation=0;rotation<6;rotation++)transforms.push(points.map(p=>{let q=p.q,r=p.r;if(mirror)[q,r]=[r,q];for(let k=0;k<rotation;k++)[q,r]=[-r,q+r];return index.get(q+','+r);}));
function transformMask(mask,map){let result=0;for(let i=0;i<19;i++)if(mask&(1<<i))result|=1<<map[i];return result;}
const pop=new Uint8Array(1<<19);for(let i=1;i<=all;i++)pop[i]=pop[i>>1]+(i&1);
const counts=Array.from({length:19},()=>Array(12).fill(0));
const open=Array(19).fill(0),closed=Array(19).fill(0),examples={};
const pairAt=new Int32Array(19),selected=[];
let candidatePartitions=0,leaves=0,accepted=0;
for(let joints=0;joints<=all;joints++){
 if(!(joints&rootBit))continue;
 const n=19-pop[joints];if(n<9||n>14)continue;
 const choices=[];let viable=true;
 for(let middle=0;middle<19;middle++)if(!(joints&(1<<middle))){
  const js=neighbors[middle].filter(j=>(joints&(1<<j))!==0);
  if(js.length<2){viable=false;break;}
  const options=[];
  for(let a=0;a<js.length;a++)for(let b=a+1;b<js.length;b++){
   const left=js[a],right=js[b];
   options.push({middle,left,right,mask:(1<<left)|(1<<right),transformed:transforms.map(map=>(1<<map[left])|(1<<map[right]))});
  }
  choices.push(options);
 }
 if(!viable)continue;
 candidatePartitions++;
 choices.sort((a,b)=>a.length-b.length);
 const symmetries=[];for(let s=1;s<12;s++)if(transformMask(joints,transforms[s])===joints)symmetries.push(s);
 function visit(at,parity,used){
  if(at===n){
   leaves++;
   if(used!==joints)return;
   if(parity){if(!(parity&rootBit))return;const other=parity^rootBit;if(!other||(other&(other-1)))return;}
   let connected=rootBit,previous=-1;
   while(previous!==connected){previous=connected;for(let i=0;i<n;i++)if(selected[i].mask&connected)connected|=selected[i].mask;}
   if(connected!==joints)return;
   accepted++;counts[n][0]++;
   if(parity)open[n]++;else closed[n]++;
   let symmetryCount=0;
   for(const s of symmetries){let fixed=true;const map=transforms[s];for(let i=0;i<n;i++){const o=selected[i];if(pairAt[map[o.middle]]!==o.transformed[s]){fixed=false;break;}}if(fixed){counts[n][s]++;symmetryCount++;}}
   const exampleKey=n+'-'+(parity?'open':'closed');
   if(!examples[exampleKey]||symmetryCount>examples[exampleKey].symmetryCount)examples[exampleKey]={count:n,closed:!parity,symmetryCount,joints,middles:selected.slice(0,n).map(o=>({middle:o.middle,left:o.left,right:o.right}))};
   return;
  }
  for(const option of choices[at]){selected[at]=option;pairAt[option.middle]=option.mask;visit(at+1,parity^option.mask,used|option.mask);}
 }
 visit(0,0,0);
}
const summaries=[];
for(let n=9;n<19;n++)if(counts[n][0])summaries.push({pieces:n,identityCount:counts[n][0],open:open[n],closed:closed[n],fixedByTransform:counts[n],rotationOrbits:counts[n].slice(0,6).reduce((a,b)=>a+b,0)/6,dihedralOrbits:counts[n].reduce((a,b)=>a+b,0)/12});
const byTurn={0:'gather',1:'health',2:'blade',4:'secretion',5:'movement'};
for(const example of Object.values(examples)){
 const adjacency=Array.from({length:19},()=>[]);
 example.middles.forEach((e,i)=>{adjacency[e.left].push(i);adjacency[e.right].push(i);});
 const used=new Set(),tour=[];
 function walk(v){for(const ei of adjacency[v]){if(used.has(ei))continue;used.add(ei);const edge=example.middles[ei],next=edge.left===v?edge.right:edge.left;walk(next);tour.push({start:v,middle:edge.middle,end:next});}}
 walk(root);tour.reverse();
 const pieces=tour.map(t=>{const a=points[t.start],b=points[t.middle],c=points[t.end];const d1=dirs.findIndex(d=>a.q+d[0]===b.q&&a.r+d[1]===b.r),d2=dirs.findIndex(d=>b.q+d[0]===c.q&&b.r+d[1]===c.r),turn=(d2-d1+6)%6;return {gene:byTurn[turn],grade:1,rotation:d1,shape:[0,turn]};});
 const trace=M.trace(pieces,1);
 if(!trace.valid||trace.occupied.size!==19)throw Error('Trace mismatch '+example.count);
 example.pieces=pieces;
 example.paths=trace.paths;
 example.nativeTrace={valid:trace.valid,occupied:trace.occupied.size,closed:trace.closed};
}
const result={observedAt:new Date().toISOString(),boardRadius:2,boardPoints:points,root,definition:'Unlabeled physical DNA assemblies; each occupied midpoint chooses an unordered pair of joint neighbors. Assembly insertion order and strand reversal are ignored. All five directed grade-1 shapes and all six rotations are allowed. Every one of 19 points is occupied; legal existing-endpoint reuse allowed.',candidatePartitions,leaves,accepted,summaries,totals:{identity:accepted,rotationOrbits:summaries.reduce((s,x)=>s+x.rotationOrbits,0),dihedralOrbits:summaries.reduce((s,x)=>s+x.dihedralOrbits,0)},examples:Object.values(examples),elapsedMs:Date.now()-started};
if(summaries.some(x=>!Number.isSafeInteger(x.rotationOrbits)||!Number.isSafeInteger(x.dihedralOrbits)))throw Error('Burnside noninteger');
fs.writeFileSync(new URL('./exact.json',import.meta.url),JSON.stringify(result,null,2).replace(/\n/g,'\r\n'),'utf8');
console.log(JSON.stringify({candidatePartitions,leaves,accepted,summaries,totals:result.totals,elapsedMs:result.elapsedMs}));