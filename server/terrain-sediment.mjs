export function routeTerrainSediment(formed, water, river, discharge, normalDepth) {
  const {size,height,drainage,profile,erosion}=formed,length=height.length,dx=profile.cellMeters;
  const diameters=[.032,.001,.00002],fractions=[.35,.5,.15];
  const load=diameters.map(()=>new Float64Array(length)),deposit=diameters.map(()=>new Float64Array(length)),bankGravel=new Float32Array(length);
  const exported=[0,0,0],produced=[0,0,0],stored=[0,0,0],annualSeconds=31557600,eventFraction=.05;
  for(let index=0;index<length;index++)if(!formed.sea[index])for(let grain=0;grain<3;grain++){
    const source=erosion[index]*dx*dx*fractions[grain];load[grain][index]=source;produced[grain]+=source;
  }
  for(let cursor=drainage.order.length-1;cursor>=0;cursor--){
    const index=drainage.order[cursor],parent=drainage.parent[index];
    if(formed.sea[index]||parent<0){for(let grain=0;grain<3;grain++)exported[grain]+=load[grain][index];continue;}
    const x=index%size,y=Math.floor(index/size),nx=parent%size,ny=Math.floor(parent/size);
    const distance=dx*Math.hypot(nx-x,ny-y),tx=-(ny-y)*dx/distance,ty=(nx-x)*dx/distance;
    const bedSlope=Math.max(.00001,(drainage.level[index]-(formed.sea[parent]?0:drainage.level[parent]))/distance);
    const left=Math.round(y+ty)*size+Math.round(x+tx),right=Math.round(y-ty)*size+Math.round(x-tx);
    const a=Math.max(.0001,(height[left]-height[index])/dx),b=Math.max(.0001,(height[right]-height[index])/dx);
    const cross=normalDepth(discharge[index]*6,bedSlope,a,b,profile.manning),stress=1000*9.81*cross.depth*bedSlope;
    const coarse=load[0][index]+load[1][index],sandFraction=coarse?load[1][index]/coarse:fractions[1]/(fractions[0]+fractions[1]);
    const mean=Math.exp((1-sandFraction)*Math.log(diameters[0])+sandFraction*Math.log(diameters[1]));
    const reference=(.021+.015*Math.exp(-20*sandFraction))*1650*9.81*mean;
    const targets=[];
    if(river[index]){
      const reach=Math.max(1,Math.ceil(cross.width/(2*dx)));
      for(let offset=-reach;offset<=reach;offset++){
        const px=Math.round(x+tx*offset),py=Math.round(y+ty*offset);if(px<0||py<0||px>=size||py>=size)continue;
        const target=py*size+px;
        if(!water[target]&&Math.abs(height[target]-height[index])<=Math.max(2,cross.depth*2))targets.push([target,Math.exp(-Math.abs(offset))]);
      }
    }
    if(!targets.length)targets.push([index,1]);
    const totalWeight=targets.reduce((sum,item)=>sum+item[1],0);
    const mixture=load[0][index]+load[1][index]+load[2][index];
    if(river[index]&&mixture>0)for(const side of[-1,1]){
      const px=Math.round(x+tx*side),py=Math.round(y+ty*side);if(px<0||py<0||px>=size||py>=size)continue;
      const target=py*size+px;if(water[target])continue;
      const bedGravel=fractions[0]/(fractions[0]+fractions[1]);
      bankGravel[target]=Math.max(bankGravel[target],.5*Math.max(bedGravel,load[0][index]/mixture));
    }
    for(let grain=0;grain<3;grain++){
      const incoming=load[grain][index],diameter=diameters[grain];let outgoing;
      if(water[index]===2){
        const settling=1.65*9.81*diameter*diameter/(18*.000001+Math.sqrt(.75*1.65*9.81*diameter**3));
        outgoing=incoming*Math.exp(-settling*distance/Math.max(.000001,cross.velocity*Math.max(.5,drainage.level[index]-height[index])));
      }else if(grain===2){
        const settling=1.65*9.81*diameter*diameter/(18*.000001+Math.sqrt(.75*1.65*9.81*diameter**3));
        outgoing=incoming*Math.exp(-settling*distance/Math.max(.000001,cross.velocity*cross.depth));
      }else{
        const proportion=grain===0?1-sandFraction:sandFraction;
        const exponent=.67/(1+Math.exp(1.5-diameter/mean)),phi=stress/(reference*(diameter/mean)**exponent);
        const transport=phi<1.35?.002*phi**7.5:14*(1-.894/Math.sqrt(phi))**4.5;
        const capacity=transport*proportion*Math.pow(stress/1000,1.5)*cross.width/(1.65*9.81)*annualSeconds*eventFraction;
        outgoing=Math.min(incoming,Math.max(0,capacity));
      }
      const retained=incoming-outgoing;stored[grain]+=retained;
      for(const [target,weight]of targets){
        deposit[grain][target]+=retained*weight/totalWeight;
        if(grain===0&&river[index]&&!water[target]&&mixture>0)bankGravel[target]=Math.max(bankGravel[target],(incoming/mixture)*(.25+.75*retained/Math.max(.000000001,incoming))*weight);
      }
      load[grain][parent]+=outgoing;
    }
  }
  const exposureYears=1000,gravel=new Float32Array(length),sand=new Float32Array(length),fines=new Float32Array(length),cover=new Float32Array(length),flux=new Float64Array(length);
  for(let index=0;index<length;index++){
    gravel[index]=deposit[0][index]*exposureYears/(dx*dx);sand[index]=deposit[1][index]*exposureYears/(dx*dx);fines[index]=deposit[2][index]*exposureYears/(dx*dx);
    cover[index]=gravel[index]+sand[index]+fines[index];flux[index]=load[0][index]+load[1][index]+load[2][index];
  }
  return {gravel,sand,fines,cover,bankGravel,flux,budget:{produced,stored,exported},diameters,fractions,exposureYears,eventFraction};
}
