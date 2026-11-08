#!/usr/bin/env python3
"""Describe repaired whole-body source pixels; preserve every authored clock/pivot."""
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
rows=json.loads((HERE/'followup13-integration-map.json').read_text())['items'];by_path={r['source']:r for r in rows}
changed=[]
for name in ['client/antenna-combo-assets.mjs','client/blade-carapace-assets.mjs','client/secretion-combo-assets.mjs','client/unit-action-art-assets.mjs','client/unit-appearance-assets.mjs']:
 p=ROOT/name;old=p.read_text();s=old
 for path,r in by_path.items():
  # All thirteen action clips use a flat literal image/sourceFacing registration.
  pattern=r'("image"\s*:\s*"'+re.escape(path)+r'"[^{}]*?"sourceFacing"\s*:\s*)"right"'
  s=re.sub(pattern,r'\1"left"',s)
  s=s.replace(r['originalSHA256'],r['candidateSHA256'])
 if s!=old:p.write_text(s);changed.append(name)
(HERE/'followup13-runtime-changes.json').write_text(json.dumps({'status':'completed','files':changed,'sourcePaths':list(by_path),'geometryAndTimingChanged':False},ensure_ascii=False,indent=2)+'\n')
print(json.dumps(changed))
