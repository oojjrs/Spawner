import { DNA_BOARD_SHAPES, dnaBoardCells, dnaPieceCells, dnaBoardTrace, dnaBoardPack } from "./dna-board.mjs";
import { dnaCombatStats } from "./dna-combat-stats.mjs";
import { tribeDnaStats } from "./tribe-dna-stats.mjs";

export const ATTRIBUTE_DNA = (() => {
  const colors = {organ:'#edba87',action:'#8fbbed',stat:'#87d7b8'};
  const definitions = [["blade","organ",20],["carapace","stat",10],["antenna","organ",20],["gather","organ",20],["legs","stat",20],["power","stat",10],["combo","action",14],["speed","stat",12],["comboPower","stat",12],["critical","stat",12],["criticalPower","stat",10],["accuracy","stat",10],["penetration","stat",12],["health","stat",10],["armor","stat",10],["evasion","stat",14],["parry","action",14],["block","action",12],["blockPower","stat",10],["counter","action",14],["counterPower","stat",10],["tenacity","stat",10],["reduction","stat",12],["movement","stat",10],["capacity","stat",10],["harvest","stat",10],["harvestSpeed","stat",10],["vision","stat",10],["loadSpeed","stat",10],null,["stun","action",16],["stunTime","stat",12],["bleed","action",16],["bleedPower","stat",12],["area","action",18],["areaPower","stat",12],["lifesteal","action",16],["reflection","action",16],["regeneration","action",14],["comboSpeed","stat",12],["focus","stat",12],null,["secretion","organ",20],["rangedPower","stat",12],["rangedSpeed","stat",12],null];
  const alphabet = 'ATGC';
  const genes = definitions.map((entry,index) => entry && ({id:entry[0],category:entry[1],price:entry[2]/2,code:alphabet[Math.floor(index/16)]+alphabet[Math.floor(index/4)%4]+alphabet[index%4],color:colors[entry[1]]})).filter(Boolean);
  const lookup = new Map(genes.map(gene=>[gene.id,gene]));
  const specification=[{"gene":"gather","grade":1,"order":1},{"gene":"health","grade":1,"order":3},{"gene":"blade","grade":2,"order":0},{"gene":"power","grade":2,"order":1},{"gene":"speed","grade":2,"order":2},{"gene":"capacity","grade":1,"order":0},{"gene":"movement","grade":1,"order":4},{"gene":"antenna","grade":2,"order":8},{"gene":"carapace","grade":2,"order":9},{"gene":"combo","grade":3,"order":0},{"gene":"legs","grade":3,"order":10,"retired":true},{"gene":"armor","grade":3,"order":11,"retired":true},{"gene":"vision","grade":3,"order":10},{"gene":"harvest","grade":2,"order":10,"retired":true},{"gene":"harvestSpeed","grade":1,"order":2},{"gene":"loadSpeed","grade":2,"order":11},{"gene":"accuracy","grade":3,"order":6},{"gene":"tenacity","grade":3,"order":7},{"gene":"block","grade":3,"order":8},{"gene":"evasion","grade":3,"order":9},{"gene":"parry","grade":4,"order":21},{"gene":"counter","grade":3,"order":2},{"gene":"critical","grade":3,"order":1},{"gene":"criticalPower","grade":4,"order":24},{"gene":"penetration","grade":4,"order":25},{"gene":"comboPower","grade":4,"order":26},{"gene":"blockPower","grade":4,"order":27},{"gene":"counterPower","grade":4,"order":28},{"gene":"reduction","grade":4,"order":29},{"gene":"stun","grade":3,"order":3},{"gene":"stunTime","grade":4,"order":31},{"gene":"bleed","grade":3,"order":4},{"gene":"bleedPower","grade":4,"order":33},{"gene":"area","grade":3,"order":5},{"gene":"areaPower","grade":4,"order":35},{"gene":"lifesteal","grade":4,"order":36},{"gene":"reflection","grade":4,"order":37},{"gene":"regeneration","grade":4,"order":38},{"gene":"comboSpeed","grade":4,"order":39},{"gene":"focus","grade":4,"order":40},{"gene":"secretion","grade":2,"order":3},{"gene":"rangedPower","grade":2,"order":4},{"gene":"rangedSpeed","grade":2,"order":5}];
  for(const entry of specification){const gene=lookup.get(entry.gene);gene.grade=entry.grade;gene.order=entry.order;if(entry.retired)gene.retired=true;gene.price=piecePrice({gene:gene.id,grade:gene.grade});}
  const catalog=genes.filter(gene=>!gene.retired).sort((a,b)=>a.grade-b.grade||a.order-b.order);

  for (const [index, gene] of genes.entries()) { gene.cells = DNA_BOARD_SHAPES[gene.id]; gene.fillColor = `hsl(${(index * 137.508 + 24) % 360} 48% 64%)`; }

  for(const [id,color] of Object.entries({capacity:'#71cdb9',gather:'#d8ba77',harvestSpeed:'#df8d96',health:'#db9d7e',movement:'#a6a1dd'}))lookup.get(id).fillColor=color;

  const boardRadii=[3,4,5,6];
  function boardRadius(level){return Number.isInteger(level)&&level>=1&&level<=4?boardRadii[level-1]:Infinity;}
  function inside(point,level){return Math.max(Math.abs(point.q),Math.abs(point.r),Math.abs(point.q+point.r))<=boardRadius(level);}
  function key(point){return point.q+','+point.r;}
  function trace(pieces,level){return dnaBoardTrace(pieces,level,lookup,boardRadius);}
  function boardCells(level){return dnaBoardCells(boardRadius(level));}
  function pack(pieces,level){return dnaBoardPack(pieces,level,boardRadius);}
  function piecePrice(piece){
    const gene=lookup.get(piece.gene),grade=piece.grade===undefined?1:piece.grade;
    if(!gene)return 0;
    return (gene.category==='organ'?[0,8,12,11,15]:[0,5,7,11,15])[grade]||0;
  }
  function price(pieces){return Math.ceil(pieces.reduce((sum,piece)=>sum+piecePrice(piece),0));}
  function cost(pieces){return 3+price(pieces);}
  function counts(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+1;return result;}
  function weights(pieces){const result={};for(const piece of pieces)result[piece.gene]=(result[piece.gene]||0)+(piece.grade===undefined?1:piece.grade);return result;}
  function stats(pieces,tribe){
    const n=weights(pieces),c=counts(pieces),gather=!!c.gather,profile=tribeDnaStats(tribe);
    return {...dnaCombatStats(c,n,undefined,tribe),gatherCount:c.gather||0,antennaCount:c.antenna||0,
      capacity:gather?c.gather+(n.capacity||0):0,harvest:gather?1:0,
      harvestTime:gather?4/(1+.1*(n.harvestSpeed||0)):0,movement:.25*profile.base.movement+.04*(n.movement||0)*(profile.growth.movement??1),
      vision:Math.min(12,1+(c.antenna||0)+.5*(n.vision||0)),scale:1+.01*pieces.length,roaming:!!n.antenna,
      loadSpeed:gather?Math.min(100,75+5*(n.loadSpeed||0)):0};
  }
  function clonePiece(piece){return {gene:piece.gene,rotation:piece.rotation,grade:piece.grade,q:piece.q,r:piece.r};}
  function validate(value){
    if(!value||![1,2,3,4,5].includes(value.version)||!Array.isArray(value.pieces)||value.pieces.length>2048||!Number.isFinite(value.budget)||value.budget<0||value.budget>999999999)return null;
    let level=value.level===undefined?1:value.level;
    if(!Number.isInteger(level)||level<1||level>4)return null;
    let pieces=[];
    for(const input of value.pieces){
      const gene=lookup.get(input?.gene),grade=input?.grade===undefined?(value.version>=3?gene?.grade:1):input.grade;
      if(!gene||!Number.isInteger(grade)||grade<1||grade>4||!Number.isInteger(input.rotation)||input.rotation<0||input.rotation>5)return null;
      if(value.version===5){
        if(input.shape!==undefined||input.cells!==undefined)return null;
        pieces.push({gene:gene.id,grade,rotation:input.rotation,q:input.q,r:input.r});
      }else pieces.push({gene:gene.id,grade,rotation:input.rotation});
    }
    if(value.version<5){
      const source=pieces;
      pieces=pack(source,level);
      while(!pieces&&level<4&&value.level===undefined)pieces=pack(source,++level);
      if(!pieces){
        const occupied=new Set(),positions=boardCells(level);let overflow=0;
        pieces=source.map(input=>{
          for(const position of positions)for(let rotation=0;rotation<6;rotation++){
            const piece={...input,rotation,q:position.q,r:position.r},cells=dnaPieceCells(piece);
            if(cells.some(cell=>!inside(cell,level)||occupied.has(key(cell))))continue;
            for(const cell of cells)occupied.add(key(cell));return piece;
          }
          const index=overflow++;return {...input,q:boardRadius(level)+4+(index%Math.ceil(Math.sqrt(source.length)))*6,r:-boardRadius(level)+Math.floor(index/Math.ceil(Math.sqrt(source.length)))*6};
        });
      }
    }
    if(!trace(pieces).valid)return null;
    return {version:5,pieces,budget:Math.floor(value.budget),level};
  }

  return {genes,catalog,lookup,trace,boardCells,pieceCells:dnaPieceCells,pack,piecePrice,price,cost,counts,weights,stats,validate,clonePiece,key,boardRadius,inside};
})();
