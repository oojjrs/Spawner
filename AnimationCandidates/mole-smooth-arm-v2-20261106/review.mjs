import fs from'node:fs/promises';import path from'node:path';import{createRequire}from'node:module';import{spawn}from'node:child_process';
const require=createRequire('/workspace/scratch/cdf786db13f9/Spawner-retry/package.json'),{createCanvas,loadImage,GlobalFonts}=require('@napi-rs/canvas');
const HERE=path.dirname(new URL(import.meta.url).pathname),OLD='/workspace/scratch/cdf786db13f9/Spawner-retry/DesignAssets/Animations/CreatureWalkV2/soil-mole/Frames';
GlobalFonts.registerFromPath('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','Noto');
const old=[],frames=[];for(let i=1;i<=8;i++)old.push(await loadImage(OLD+'/'+String(i).padStart(2,'0')+'.png'));for(let i=0;i<64;i++)frames.push(await loadImage(HERE+'/Frames/'+String(i).padStart(2,'0')+'.png'));
await fs.mkdir(HERE+'/Review/VideoFrames',{recursive:true});
function txt(c,s,x,y,size=20,col='#4b6254',bold=false){c.font=`${bold?'bold ':''}${size}px Noto`;c.fillStyle=col;c.fillText(s,x,y);}
const dur=[80,80,90,80,80,90,80,87];function oldat(phase){let t=phase*667;for(let i=0;i<8;i++){if(t<dur[i])return old[i];t-=dur[i];}return old[7];}
for(let n=0;n<64;n++){
 const cv=createCanvas(1280,850),c=cv.getContext('2d');c.fillStyle='#eaf0e5';c.fillRect(0,0,1280,850);
 txt(c,'흙두더지 보행 · 팔 연결 수정',32,48,31,'#233e30',true);txt(c,'기존 원화 유지 · 새 그림 없이 팔과 몸통이 이어지는 범위를 부드럽게 조정',32,86,19);
 for(let side=0;side<2;side++){const x=20+side*630;c.fillStyle='#f7f9f3';c.beginPath();c.roundRect(x,112,610,615,23);c.fill();txt(c,side?'팔 연결 수정 시안':'기존 8장 보행',x+25,157,24,side?'#2e7051':'#617069',true);txt(c,side?'원래 발톱·털 유지 · 64프레임':'손 모양과 위치가 바뀌는 기존 동작',x+25,190,18);const im=side?frames[n]:oldat(n/64);c.drawImage(im,x+45,210,520,520);c.drawImage(im,x+257,585,96,96);}
 txt(c,'같은 667ms 주기로 비교 · 전반 정상 속도 / 후반 0.25배 느리게',32,770,19);
 txt(c,'오프라인 애셋 미리보기 · 실제 게임 녹화 아님 · 게임 미적용 · 무음',32,803,18);
 txt(c,'원화에 보이는 앞발 2개와 뒷발 1개만 사용. 실제 이동 접지와 게임 속도는 검수하지 않았습니다.',32,832,16);
 await fs.writeFile(HERE+'/Review/VideoFrames/'+String(n).padStart(3,'0')+'.png',cv.toBuffer('image/png'));
}
const filter="[0:v]fps=60,format=yuv420p,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='1x SPEED':x=1090:y=28:fontsize=23:fontcolor=0x2e7051[v0];[1:v]fps=60,format=yuv420p,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='0.25x SLOW':x=1060:y=28:fontsize=23:fontcolor=0x2e7051[v1];[v0][v1]concat=n=2:v=1:a=0[out]";
const ff=spawn('ffmpeg',['-y','-v','error','-stream_loop','-1','-framerate',String(64/.667),'-t','6','-i',HERE+'/Review/VideoFrames/%03d.png','-stream_loop','-1','-framerate',String(16/.667),'-t','6','-i',HERE+'/Review/VideoFrames/%03d.png','-filter_complex',filter,'-map','[out]','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',HERE+'/mole-smooth-arm-walk-review.mp4'],{stdio:['ignore','ignore','pipe']});let err='';ff.stderr.on('data',b=>err+=b);await new Promise((r,j)=>{ff.on('error',j);ff.on('close',n=>n?j(Error(err)):r());});console.log('Final silent review saved');
