import json, math, os, tempfile
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir())/'spawner-dna-level2-mpl'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties

root=Path(__file__).resolve().parent
data=json.loads((root/'comparison.json').read_text())
font=FontProperties(fname='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
plt.rcParams.update({'font.family':font.get_name(),'axes.unicode_minus':False,'svg.fonttype':'path'})
background='#12261e';foreground='#edf1df';muted='#a6b9a8'
colors={'power':'#8dccf0','speed':'#ebbc7d','capacity':'#b8a0d9','antenna':'#8ed7bd','carapace':'#c4d48a'}
order=['power','speed','capacity','antenna','carapace']
gene_info={v['gene']:v for v in data['currentGenes']}
directions=[(1,0),(0,1),(-1,1),(-1,0),(0,-1),(1,-1)]
def xy(p):return (p['q']+p['r']/2,p['r']*math.sqrt(3)/2)
def shape_points(steps):
 points=[{'q':0,'r':0}]
 for step in steps:
  q,r=directions[step%6];p=points[-1];points.append({'q':p['q']+q,'r':p['r']+r})
 return points
def clean(ax):
 ax.set_facecolor(background);ax.set_aspect('equal');ax.axis('off')
def draw_path(ax,points,color,width=3):
 x,y=zip(*map(xy,points));ax.plot(x,y,color=color,lw=width,solid_capstyle='round',zorder=2)
 ax.scatter(x[1:-1],y[1:-1],s=24,color=color,zorder=3)
 ax.scatter([x[0]],[y[0]],s=58,facecolor=background,edgecolor=color,linewidth=2,zorder=5)
 ax.scatter([x[-1]],[y[-1]],s=58,color=color,zorder=4)

fig=plt.figure(figsize=(15,12),facecolor=background)
fig.text(.04,.965,'1레벨 배정 고정 · 2레벨 모양 비교',fontproperties=font,fontsize=24,color=foreground,weight='bold')
fig.text(.04,.928,'채집 · 체력 · 칼날 · 이속 · 분비는 그대로. 아래 변경안은 기하 검토이며 게임에는 적용하지 않았습니다.',fontproperties=font,fontsize=12,color=muted)
row_titles=['현행 유지','재배정 A · 운반 L형','재배정 B · 안테나 L형']
for row,plan in enumerate(data['results']):
 y=.863-row*.16
 fig.text(.04,y+.018,row_titles[row],fontproperties=font,fontsize=12,color=foreground)
 for col,gene in enumerate(order):
  ax=fig.add_axes([.17+col*.132,y-.080,.12,.105]);clean(ax)
  points=shape_points(plan['shapes'][gene]);draw_path(ax,points,colors[gene])
  ax.set_xlim(-.4,3.5);ax.set_ylim(-2,2)
  changed=any(item['gene']==gene for item in plan['changes'])
  ax.set_title(gene_info[gene]['label']+(' *'if changed else ''),fontproperties=font,fontsize=11,color='#ffcf89'if changed else foreground,pad=4)
  ax.text(.5,-.04,f"{gene_info[gene]['cost']}P",transform=ax.transAxes,ha='center',fontproperties=font,fontsize=10,color=muted)
fig.text(.04,.415,'맞물림 비교 · 2레벨 37칸 판',fontproperties=font,fontsize=17,color=foreground)
examples=[(data['results'][0],0,'현행 · 공격력1 + 공속1'),(data['results'][0],1,'현행 · 공격력2 + 공속2'),(data['results'][1],0,'재배정 · 공격력1 + 공속1')]
for col,(plan,index,title)in enumerate(examples):
 case=plan['cases'][index];sample=case['representative'];ax=fig.add_axes([.04+col*.32,.09,.29,.28]);clean(ax)
 cells=[{'q':q,'r':r}for q in range(-3,4)for r in range(-3,4)if max(abs(q),abs(r),abs(q+r))<=3]
 x,y=zip(*map(xy,cells));ax.scatter(x,y,s=18,color='#3c5545',zorder=1)
 for path in sample['paths']:draw_path(ax,path['points'],colors[path['gene']],3.5)
 ax.set_xlim(-3.7,3.7);ax.set_ylim(-3.4,3.4)
 ax.set_title(title,fontproperties=font,fontsize=12,color=foreground,pad=4)
 note=('시작점으로 닫힘'if sample['closedAtOrigin']else '열린 경로')+f" · {sample['occupied']}/37칸"
 ax.text(.5,-.04,note,transform=ax.transAxes,ha='center',fontproperties=font,fontsize=11,color=muted)
fig.text(.04,.035,'파랑=공격력 · 주황=공속. 이 세 그림은 공격기관 없는 형태 비교입니다. 실제 공격에는 칼날이 필요합니다.',fontproperties=font,fontsize=11,color=muted)
fig.savefig(root/'level2-review.png',dpi=160,facecolor=background)
fig.savefig(root/'level2-review.svg',facecolor=background)
plt.close(fig)
