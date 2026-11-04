(() => {
  'use strict';
  const axes = [
    { key: 'hp', name: '체력', unit: 'HP', step: 1, max: 1e12, min: 1, color: '#e6ad6c' },
    { key: 'power', name: '공격력', unit: '피해', step: 1, max: 1e12, min: 1, color: '#f08087' },
    { key: 'speed', name: '공격 속도', unit: '회/초', step: .001, max: 1e6, min: .001, color: '#83c5ed' },
    { key: 'defense', name: '방어력', unit: '방어', step: 1, max: 1e12, min: 0, color: '#ad9ae8' },
    { key: 'regen', name: '자기 재생', unit: 'HP/초', step: 1, max: 1e12, min: 0, color: '#82cfa5' }
  ];
  // Per-stat ranks and comparison party sizes are the handoff's fixed inputs.
  const rows = [
    ['flower-tail-bird','꽃꼬리새',1,3,16,1,9,1],['dew-rabbit','이슬토끼',2,2,13,2,10,1],
    ['rolling-acorn','굴림도토리',3,4,10,12,1,1],['cotton-sheep','솜양',7,1,6,5,12,1],
    ['bundle-snail','보따리달팽이',10,5,4,15,14,2],['soil-mole','흙두더지',6,6,8,7,8,1],
    ['bubble-toad','방울두꺼비',8,7,11,6,11,2],['spiny-back-beetle','가시등 딱정벌레',9,8,9,14,2,2],
    ['snare-vine','올가미덩굴',11,10,5,11,18,2],['soil-boar','흙멧돼지',14,14,7,13,5,2],
    ['shadow-weasel','그늘족제비',5,15,19,4,7,2],['talon-owl','갈퀴부엉이',4,16,15,3,4,3],
    ['vine-turtle','넝쿨거북',16,9,3,16,15,3],['lantern-keeper','등불지기',13,11,14,9,16,3],
    ['spring-keeper','봄지기',12,12,17,8,13,4],['old-garden-snail','오래된 등짐',18,13,2,18,17,4],
    ['spiny-back-leader','가시등 우두머리',17,17,12,17,3,5],['white-paw','흰발',15,19,18,10,6,5],
    ['walking-forest','걸어가는 산',19,18,1,19,19,6]
  ].map(([key,name,...ranks],index)=>({ key,name,tier:index+1,unique:index>=13,ranks:Object.fromEntries(axes.map((a,i)=>[a.key,ranks[i]])),party:ranks[5] }));
  const lineages = [['flower-tail-bird','spring-keeper'],['dew-rabbit','lantern-keeper'],['bundle-snail','old-garden-snail'],['vine-turtle','walking-forest'],['shadow-weasel','white-paw'],['spiny-back-beetle','spiny-back-leader']];
  function initial() {
    const curves = Object.fromEntries(axes.map(a=>[a.key,[]]));
    for(let t=1;t<=19;t++) { const i=t-1,x=i/18;
      curves.hp.push(Math.round(650+3550*Math.sqrt(x)));curves.power.push(Math.round(12+2.1*i+12*x*x));
      curves.speed.push(Number((.4+.095*i).toFixed(3)));curves.defense.push(Math.round(10+.5*i*i));curves.regen.push(t);
    }
    return curves;
  }
  function valid(curves) {
    return axes.every(a=>Array.isArray(curves?.[a.key])&&curves[a.key].length===19&&curves[a.key].every((v,i,vs)=>Number.isFinite(v)&&v>=a.min&&v<=a.max&&(a.step!==1||Number.isInteger(v))&&(!i||v>vs[i-1])));
  }
  function edit(curves,key,index,value) {
    const axis=axes.find(a=>a.key===key);if(!axis||!Number.isInteger(index)||index<0||index>=19||!Number.isFinite(value))return false;
    const values=curves[key],low=index?values[index-1]+axis.step:axis.min,high=index<18?values[index+1]-axis.step:axis.max;
    values[index]=Number(Math.max(low,Math.min(high,Math.round(Math.max(axis.min,Math.min(axis.max,value))/axis.step)*axis.step)).toFixed(axis.step===1?0:3));
    return true;
  }
  function calculate(curves) {
    if(!valid(curves))throw new Error('유효하지 않은 곡선입니다. 티어별 값은 엄격히 증가해야 합니다.');
    const units=rows.map(row=>{
      const stats=Object.fromEntries(axes.map(a=>[a.key,curves[a.key][row.ranks[a.key]-1]]));
      const dps=stats.power*stats.speed/1.5,playerDps=7500/(100+stats.defense),netDps=row.party*playerDps-stats.regen;
      const seconds=netDps>0?stats.hp/netDps:Infinity;
      return {...row,...stats,hps:stats.regen,dps,playerDps,netDps,seconds,outside:seconds<10||seconds>60};
    });
    const byKey=new Map(units.map(row=>[row.key,row]));const inversions=[];
    for(let i=0;i<lineages.length;i++)for(let j=i+1;j<lineages.length;j++){
      const [a,au]=lineages[i].map(k=>byKey.get(k)),[b,bu]=lineages[j].map(k=>byKey.get(k));
      if(Math.sign(a.dps-b.dps)!==Math.sign(au.dps-bu.dps))inversions.push({original:[a.name,b.name],unique:[au.name,bu.name]});
    }
    return {units,inversions};
  }
  globalThis.SpawnerNeutralCurves=Object.freeze({axes,rows,lineages,initial,valid,edit,calculate});
})();
