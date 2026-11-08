exec(open('tools/spring-native-facing-20261108/bean-spore-remaining-crops.py').read().split('keys=list(a)')[0])
x=json.load(open(out/'bean-spore-priority-registry.json'));rows=[]
for k,c in x['held'].items():
 c={**c,'frameSize':c['frameWidth'],'frameCount':len(c['times'])*2};add(rows,k+' HELD left/right hit blocks',c)
save(rows,'bean-spore-held-priority.jpg')
for tribe,v in x['ranged'].items():
 rows=[]
 for ac,c in v.items():
  if not isinstance(c,dict):continue
  if ac=='lifecycle':
   for n,b in c.items():add(rows,tribe+' ranged '+n,b)
  elif c.get('frameCount'):add(rows,tribe+' ranged '+ac,c)
 save(rows,'bean-spore-ranged-priority-'+tribe+'.jpg')
