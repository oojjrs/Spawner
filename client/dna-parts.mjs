export function dnaPartValidate(M,value) {
  if(!value||value.version!==1||!Array.isArray(value.pieces)||!value.pieces.length||value.pieces.length>2048)return null;
  const pieces=[];
  for(const input of value.pieces){
    const gene=M.lookup.get(input?.gene),grade=input?.grade,rotation=input?.rotation,shape=input?.shape;
    if(!gene||!Number.isInteger(grade)||grade<1||grade>4||!Number.isInteger(rotation)||rotation<0||rotation>5||!Array.isArray(shape)||shape.length!==grade+1||!shape.every(direction=>Number.isInteger(direction)&&direction>=0&&direction<=5))return null;
    pieces.push({gene:gene.id,grade,rotation,shape:[...shape]});
  }
  const organs=new Set();
  for(const piece of pieces)if(M.lookup.get(piece.gene).category==='organ'){if(organs.has(piece.gene))return null;organs.add(piece.gene);}
  if(!M.trace(pieces).valid)return null;
  const level=Math.max(...pieces.map(piece=>Math.max(piece.grade,M.lookup.get(piece.gene).grade)));
  return {version:1,level,pieces};
}

export function dnaPartTrace(M,part) {
  const value=dnaPartValidate(M,part);
  return value?M.trace(value.pieces):null;
}

export function dnaPartRange(M,design,first,last) {
  if(!design||!Array.isArray(design.pieces)||!Number.isInteger(first)||!Number.isInteger(last)||first<0||last<0||first>=design.pieces.length||last>=design.pieces.length)return null;
  return dnaPartValidate(M,{version:1,pieces:design.pieces.slice(Math.min(first,last),Math.max(first,last)+1)});
}

export function dnaPartAppend(M,design,part,rotation) {
  const value=dnaPartValidate(M,part);
  if(!value||value.pieces.some(piece=>M.lookup.get(piece.gene).retired)||!Number.isInteger(rotation)||rotation<0||rotation>5||!design||!Array.isArray(design.pieces))return null;
  const pieces=design.pieces.map(M.clonePiece).concat(value.pieces.map(piece=>({...M.clonePiece(piece),rotation:(piece.rotation+rotation)%6})));
  if(value.level>design.level||!M.trace(pieces,design.level).valid)return null;
  const organs=new Set();
  for(const piece of pieces)if(M.lookup.get(piece.gene).category==='organ'){if(organs.has(piece.gene))return null;organs.add(piece.gene);}
  return {version:3,level:design.level,budget:design.budget,pieces};
}
