from pathlib import Path
import json
import math
import shutil
import sys
sys.dont_write_bytecode=True
from PIL import Image
from render import execute

ROOT=Path(__file__).resolve().parents[1]
PROJECT=ROOT.parents[2]


def save_json(path,value):
    path.write_bytes((json.dumps(value)+'\r\n').encode('utf-8'))


def animation_command(paths,durations):
    command=['magick','-background','none','-dispose','Background']
    for path,duration in zip(paths,durations):
        command+=['-delay',str(duration)+'x1000','(',str(path),')']
    return command


def export(name):
    folder=ROOT/name
    work=PROJECT/'$Trash/slump-connect-v12'/name/'full'
    rig=json.loads((folder/'rig.json').read_text('utf-8'))
    records=json.loads((work/'motion.json').read_text('utf-8'))
    durations=json.loads((work/'timing.json').read_text('utf-8'))
    if len(records)!=len(durations) or min(durations)<=0:
        raise RuntimeError('Invalid animation timing: '+name)
    if records[-1]['eyeState']!=2 or records[-1]['bodyY']!=0:
        raise RuntimeError('Final pose is incomplete: '+name)
    if min(min(record['partPixels'].values()) for record in records)<=0:
        raise RuntimeError('A leg disappeared: '+name)
    paths=[work/f'{index:03d}.png' for index in range(len(records))]
    columns=8
    sheet=Image.new('RGBA',(512*columns,512*math.ceil(len(paths)/columns)))
    for index,path in enumerate(paths):
        sheet.paste(Image.open(path).convert('RGBA'),(index%columns*512,index//columns*512))
    sheet_path=work/'death-sheet.png'
    sheet.save(sheet_path)
    execute(['magick',str(sheet_path),'-define','webp:lossless=true',str(folder/'death.webp')])
    command=animation_command(paths,durations)
    execute(command+['-loop','0','-define','webp:lossless=true',str(folder/'preview.webp')])
    execute(command+['-resize','64x64','-loop','0','-define','webp:lossless=true',str(folder/'thumbnail.webp')])
    shutil.copyfile(work/'preview.gif',folder/'death.gif')
    shutil.copyfile(work/'contact.png',folder/'contact.png')
    shutil.copyfile(work/'motion.json',folder/'motion.json')
    prefix='DesignAssets/Animations/CreatureDeathV12/'+name+'/'
    metadata={'name':name,'action':'death','motion':'slump-eyes-closed',
              'sourceImage':rig['appearanceAuthority'],'image':prefix+'death.webp',
              'frameSize':512,'columns':columns,'frameCount':len(paths),
              'pivotX':256,'pivotY':448,'durationsMs':durations,'durationMs':sum(durations),'loop':False,
              'preview':prefix+'preview.webp','thumbnail':prefix+'thumbnail.webp','gif':prefix+'death.gif',
              'rig':prefix+'rig.json','renderer':'DesignAssets/Animations/CreatureDeathV12/SlumpAuthoring/render.py',
              'exporter':'DesignAssets/Animations/CreatureDeathV12/SlumpAuthoring/export.py',
              'approvedKeyframes':'DesignAssets/Animations/CreatureDeathV12/keyframes.json',
              'construction':'rigid-carapace-head-tail-and-separate-leg-skin-meshes'}
    save_json(folder/'death.json',metadata)
    print(json.dumps({'name':name,'frames':len(paths),'durationMs':sum(durations),
                      'sheet':sheet.size,'gif':str(folder/'death.gif')}))


if __name__=='__main__':
    export(sys.argv[1])
