export const ATTRIBUTE_DNA = (() => {
  const directions = [[1,0],[0,1],[-1,1],[-1,0],[0,-1],[1,-1]];
  const colors = {organ:'#edba87',action:'#8fbbed',stat:'#87d7b8'};
  const definitions = [
    ['blade','organ',1,20],['carapace','organ',-1,20],['antenna','organ',0,20],['gather','organ',2,20],['legs','organ',-2,20],
    ['power','stat',1,10],['combo','action',-1,14],['speed','stat',0,12],['comboPower','stat',2,12],['critical','stat',-2,12],['criticalPower','stat',1,10],['accuracy','stat',-1,10],['penetration','stat',0,12],
    ['health','stat',-1,10],['armor','stat',2,10],['evasion','action',-2,14],['parry','action',1,14],['block','action',0,12],['blockPower','stat',-1,10],['counter','action',2,14],['counterPower','stat',-2,10],['tenacity','stat',1,10],['reduction','stat',-1,12],
    ['movement','stat',0,10],['capacity','stat',1,10],['harvest','stat',-1,10],['harvestSpeed','stat',2,10],['vision','stat',-2,10],['loadSpeed','stat',0,10],['healing','stat',1,10],
    ['stun','action',-1,16],['stunTime','stat',2,12],['bleed','action',-2,16],['bleedPower','stat',1,12],['area','action',0,18],['areaPower','stat',-1,12],['lifesteal','action',2,16],['reflection','action',-2,16],['regeneration','action',1,14],['comboSpeed','stat',-1,12],['focus','stat',0,12]
  ];
  const alphabet = 'ATGC';
  const genes = definitions.map((entry,index) => ({id:entry[0],category:entry[1],turn:entry[2],price:entry[3],code:alphabet[Math.floor(index/16)]+alphabet[Math.floor(index/4)%4]+alphabet[index%4],color:colors[entry[1]]}));
  const lookup = new Map(genes.map(gene=>[gene.id,gene]));
  const specification=[{"gene":"gather","grade":1,"steps":[0,0],"order":0},{"gene":"health","grade":1,"steps":[0,1],"order":1},{"gene":"blade","grade":1,"steps":[0,2],"order":2},{"gene":"power","grade":2,"steps":[0,0,0],"order":3},{"gene":"speed","grade":2,"steps":[0,0,1],"order":4},{"gene":"capacity","grade":2,"steps":[0,1,5],"order":5},{"gene":"movement","grade":2,"steps":[0,1,3],"order":6},{"gene":"antenna","grade":2,"steps":[0,1,2],"order":7},{"gene":"carapace","grade":2,"steps":[0,1,0],"order":8},{"gene":"combo","grade":3,"steps":[0,1,5,0],"order":9},{"gene":"legs","grade":3,"steps":[0,1,0,4],"order":10},{"gene":"armor","grade":3,"steps":[0,1,2,0],"order":11},{"gene":"vision","grade":3,"steps":[0,1,2,4],"order":12},{"gene":"harvest","grade":3,"steps":[0,1,0,5],"order":13},{"gene":"harvestSpeed","grade":3,"steps":[0,1,3,2],"order":14},{"gene":"loadSpeed","grade":3,"steps":[0,1,2,3],"order":15},{"gene":"accuracy","grade":3,"steps":[0,1,0,2],"order":16},{"gene":"tenacity","grade":3,"steps":[0,1,0,1],"order":17},{"gene":"healing","grade":3,"steps":[0,2,1,3],"order":18},{"gene":"block","grade":3,"steps":[0,0,1,5],"order":19},{"gene":"evasion","grade":3,"steps":[0,1,1,2],"order":20},{"gene":"parry","grade":4,"steps":[0,1,2,0,1],"order":21},{"gene":"counter","grade":4,"steps":[0,1,0,4,0],"order":22},{"gene":"critical","grade":4,"steps":[0,2,1,0,2],"order":23},{"gene":"criticalPower","grade":4,"steps":[0,1,3,1,0],"order":24},{"gene":"penetration","grade":4,"steps":[0,1,2,0,2],"order":25},{"gene":"comboPower","grade":4,"steps":[0,1,3,1,2],"order":26},{"gene":"blockPower","grade":4,"steps":[0,1,2,3,1],"order":27},{"gene":"counterPower","grade":4,"steps":[0,1,5,1,0],"order":28},{"gene":"reduction","grade":4,"steps":[0,1,0,5,1],"order":29},{"gene":"stun","grade":4,"steps":[0,1,5,4,0],"order":30},{"gene":"stunTime","grade":4,"steps":[0,1,0,5,0],"order":31},{"gene":"bleed","grade":4,"steps":[0,1,2,1,0],"order":32},{"gene":"bleedPower","grade":4,"steps":[0,1,2,3,5],"order":33},{"gene":"area","grade":4,"steps":[0,1,0,1,3],"order":34},{"gene":"areaPower","grade":4,"steps":[0,1,0,2,3],"order":35},{"gene":"lifesteal","grade":4,"steps":[0,1,0,5,4],"order":36},{"gene":"reflection","grade":4,"steps":[0,1,2,1,3],"order":37},{"gene":"regeneration","grade":4,"steps":[0,1,0,1,2],"order":38},{"gene":"comboSpeed","grade":4,"steps":[0,1,2,3,4],"order":39},{"gene":"focus","grade":4,"steps":[0,2,0,1,5],"order":40}];
  for(const entry of specification){const gene=lookup.get(entry.gene);gene.grade=entry.grade;gene.steps=entry.steps;gene.order=entry.order;}
  const catalog=genes.slice().sort((a,b)=>a.grade-b.grade||a.order-b.order);

  const boardRadii=[3,4,5,6],profiles=new Map(),shapeCache=new Map();
  function boardRadius(level){return Number.isInteger(level)&&level>=1&&level<=4?boardRadii[level-1]:Infinity;}
  function inside(point,level){return Math.max(Math.abs(point.q),Math.abs(point.r),Math.abs(point.q+point.r))<=boardRadius(level);}
  function legacyShape(gene,grade){
    if(grade===1)return [0,gene.turn];
    const identity=gene.id+':'+grade;if(shapeCache.has(identity))return shapeCache.get(identity);
    if(!profiles.has(grade)){
      const options=[],visited=new Set(['0,0','1,0']);
      function visit(position,path,bends){
        if(path.length===grade+1){if(bends>=grade-1)options.push(path.slice());return;}
        for(const turn of [-2,-1,0,1,2]){const direction=((path[path.length-1]+turn)%6+6)%6,next=step(position,direction),id=key(next);if(visited.has(id))continue;visited.add(id);path.push(direction);visit(next,path,bends+(turn===0?0:1));path.pop();visited.delete(id);}
      }
      visit({q:1,r:0},[0],0);profiles.set(grade,options);
    }
    const options=profiles.get(grade),result=options[(genes.indexOf(gene)*17+grade*7)%options.length];shapeCache.set(identity,result);return result;
  }
  function shape(gene,grade){return gene.steps;}
  function route(start,gene,grade,rotation,shapeSteps){const points=[{q:start.q,r:start.r}],directions=Array.isArray(shapeSteps)?shapeSteps:shape(gene,grade);for(const direction of directions)points.push(step(points[points.length-1],direction+rotation));return points;}

  function key(point) {return point.q+','+point.r;}
  function step(point,direction) {const delta=directions[((direction%6)+6)%6];return {q:point.q+delta[0],r:point.r+delta[1]};}
  function trace(pieces,level){
    const nodes=[{q:0,r:0}],paths=[],occupied=new Map([['0,0',{kind:'node',index:0}]]),outside=[];let closed=false,issue='';
    for(let index=0;index<pieces.length;index++){
      const piece=pieces[index],gene=lookup.get(piece.gene),grade=piece.grade===undefined?1:piece.grade;
      if(!gene||!Number.isInteger(piece.rotation)||piece.rotation<0||piece.rotation>5||!Number.isInteger(grade)||grade<1||grade>4||closed)return {valid:false,reason:closed?'closed':'invalid',nodes,paths,closed,at:index,outside};
      if(Number.isInteger(level)&&grade>level&&!issue)issue='level';
      const start=nodes[nodes.length-1],points=route(start,gene,grade,piece.rotation,piece.shape),end=points[points.length-1];
      for(let pointIndex=1;pointIndex<points.length;pointIndex++){
        const point=points[pointIndex],last=pointIndex===points.length-1,contact=occupied.get(key(point));
        if(contact&&(!last||contact.kind!=='node'))return {valid:false,reason:'collision',nodes,paths,closed,at:index,problem:point,outside};
        if(!inside(point,level)){outside.push(point);if(!issue)issue='boundary';}
        if(last&&contact)closed=true;else occupied.set(key(point),{kind:last?'node':'path',index:last?index+1:index});
      }
      paths.push({start,middle:points[1],end,points,gene:gene.id,rotation:piece.rotation,grade});nodes.push(end);
    }
    return {valid:!issue,reason:issue,nodes,paths,closed,occupied,outside};
  }
  function price(pieces){return pieces.reduce((sum,piece,index)=>{const gene=lookup.get(piece.gene),grade=piece.grade===undefined?1:piece.grade;return sum+Math.ceil((gene?.price||0)*(grade+2)/3*(1+index*.06));},0);}
  function counts(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+1;return result;}
  function weights(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+(piece.grade===undefined?1:piece.grade);return result;}
  function stats(pieces){
    const n=weights(pieces),physical=counts(pieces),extra=key=>Math.max(0,(n[key]||0)-(physical[key]||0)),attack=!!n.blade,shell=!!n.carapace,legs=!!n.legs,gather=!!n.gather;
    return {health:10+10*(n.health||0),power:attack?2+2*(n.power||0)+2*extra('blade'):0,hits:attack?1+(n.combo||0):0,speed:attack?Math.min(4,.5+.05*(n.speed||0)):0,armor:shell?(n.armor||0)+extra('carapace'):0,parry:shell?Math.min(60,4*(n.parry||0)):0,block:shell?Math.min(75,10+5*(n.block||0)):0,evasion:legs?Math.min(60,5+3*(n.evasion||0)+3*extra('legs')):0,capacity:gather?1+(n.capacity||0)+extra('gather'):0,harvest:gather?Math.min(1+(n.harvest||0)+extra('gather'),1+(n.capacity||0)+extra('gather')):0,harvestTime:gather?4/(1+.1*(n.harvestSpeed||0)):0,movement:.25+.04*(n.movement||0),vision:Math.min(12,1+(n.antenna?1:0)+.5*(n.vision||0)+.5*extra('antenna')),scale:1+.01*pieces.length,roaming:!!n.antenna,comboPower:attack?Math.min(100,50+5*(n.comboPower||0)):0,critical:attack?Math.min(75,4*(n.critical||0)):0,criticalPower:attack?Math.min(400,150+10*(n.criticalPower||0)):0,accuracy:attack?Math.min(60,3*(n.accuracy||0)):0,penetration:attack?(n.penetration||0):0,blockPower:shell?Math.min(90,50+4*(n.blockPower||0)):0,counter:attack&&shell?Math.min(100,10*(n.counter||0)):0,counterPower:attack&&shell?Math.min(200,100+10*(n.counterPower||0)):0,tenacity:Math.min(75,5*(n.tenacity||0)),reduction:Math.min(40,2*(n.reduction||0)),loadSpeed:gather?Math.min(100,75+5*(n.loadSpeed||0)):0,healing:10*(n.healing||0),stun:attack?Math.min(30,3*(n.stun||0)):0,stunTime:attack&&n.stun?Math.min(1,.25+.05*(n.stunTime||0)):0,bleed:attack?Math.min(75,5*(n.bleed||0)):0,bleedPower:attack&&n.bleed?1+(n.bleedPower||0):0,area:attack?Math.min(5,n.area||0):0,areaPower:attack&&n.area?Math.min(75,35+5*(n.areaPower||0)):0,lifesteal:attack?Math.min(20,n.lifesteal||0):0,reflection:shell?Math.min(30,3*(n.reflection||0)):0,regeneration:.1*(n.regeneration||0),comboSpeed:attack?Math.max(.06,.12-.005*(n.comboSpeed||0)):0,focus:attack?Math.max(.08,.3-.02*(n.focus||0)):0};
  }
  function clonePiece(piece){return {gene:piece.gene,rotation:piece.rotation,grade:piece.grade,shape:piece.shape.slice()};}
  function validate(value){
    if(!value||![1,2,3].includes(value.version)||!Array.isArray(value.pieces)||value.pieces.length>2048||!Number.isFinite(value.budget)||value.budget<0||value.budget>999999999)return null;
    const pieces=[];
    for(const input of value.pieces){
      const gene=lookup.get(input?.gene),grade=input?.grade===undefined?(value.version===3?gene?.grade:1):input.grade,rotation=input?.rotation;
      if(!gene||!Number.isInteger(grade)||grade<1||grade>4||!Number.isInteger(rotation)||rotation<0||rotation>5)return null;
      const original=Array.isArray(input.shape)?input.shape:value.version<3?legacyShape(gene,grade):shape(gene,grade);
      if(original.length!==grade+1||!original.every(direction=>Number.isInteger(direction)&&direction>=-5&&direction<=5))return null;
      pieces.push({gene:gene.id,grade,rotation,shape:original.map(direction=>(direction%6+6)%6)});
    }
    if(!trace(pieces).valid)return null;
    let level=Number.isInteger(value.level)&&value.level>=1&&value.level<=4?value.level:1;
    if(value.level===undefined){while(level<4&&!trace(pieces,level).valid)level++;}
    return {version:3,pieces,budget:Math.floor(value.budget),level};
  }

  return {genes,catalog,lookup,trace,price,counts,weights,stats,validate,clonePiece,step,key,shape,route,boardRadius,inside};
})();
