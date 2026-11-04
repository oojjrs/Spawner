#!/usr/bin/env python3
"""Exercise hosted source-only bean motion drafts and file-lazy source leases."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url',default='http://127.0.0.1:8768/')
args=parser.parse_args();here=Path(__file__).resolve().parent
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,
                             args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1100,'height':900},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(args.base_url.rstrip('/')+'/BeanRigPreview.html',wait_until='networkidle')
    page.wait_for_function('window.SpawnerBeanRigReview?.selected === 0')
    page.evaluate('SpawnerBeanRigReview.pause()')
    rows=[]
    for mask in range(31):
        result=page.evaluate('(mask)=>SpawnerBeanRigReview.validate(mask)',mask)
        assert result['sourceStats']['entries']==1 and result['sourceStats']['leases']==1
        assert result['sourceStats']['peakBytes']<=result['sourceStats']['byteBudget']
        assert any(row['changedPixels']>0 for row in result['rows'] if row['action']=='idle')
        assert any(row['changedPixels']>0 for row in result['rows'] if row['action']=='hurt')
        assert max(row['fixedMaxError'] for row in result['rows'])<=1
        assert all(row['changedPixels']==0 for row in result['rows'] if row['t'] in [0,1])
        rows.append(result)
    page.select_option('#form','30');page.wait_for_function('SpawnerBeanRigReview.selected === 30')
    page.check('#tint');page.select_option('#part',label='분비기관');page.select_option('#action','hurt')
    page.evaluate("SpawnerBeanRigReview.draw('hurt',.25)")
    page.screenshot(path=str(here/'visible-parts-desktop.png'),full_page=True)
    mobile=browser.new_page(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
    mobile.on('pageerror',lambda error:errors.append(str(error)))
    mobile.goto(args.base_url.rstrip('/')+'/BeanRigPreview.html',wait_until='networkidle')
    mobile.wait_for_function('window.SpawnerBeanRigReview?.selected === 0')
    mobile.evaluate('SpawnerBeanRigReview.pause()')
    mobile.evaluate('(mask)=>SpawnerBeanRigReview.choose(mask)',30)
    assert not mobile.evaluate('document.documentElement.scrollWidth>innerWidth')
    for selector in ['#form','#action','#part','#pause','#restart']:
        assert mobile.locator(selector).bounding_box()['height']>=44
    mobile.evaluate("SpawnerBeanRigReview.draw('idle',.5)")
    mobile_stats=mobile.evaluate('SpawnerBeanRigReview.sourceStats()')
    assert mobile_stats['byteBudget']==8*1024*1024 and mobile_stats['entries']==1 and mobile_stats['leases']==1
    mobile.screenshot(path=str(here/'visible-parts-mobile.png'),full_page=True)
    lazy=page.evaluate('''async()=>{
      const M=SpawnerAppearance,source=M.createUnitAppearanceSource({protocol:'file:',byteBudget:M.UNIT_APPEARANCE_BYTE_BUDGETS.mobile});
      const leases=[];
      for(const mask of [0,8,18,30]){
        const path=SpawnerBeanRigPreviewData.entries[mask].sourceImage;
        const lease=await source.acquire(path);leases.push({mask,bytes:lease.blob.size});lease.release();source.clear();
      }
      return {leases,stats:source.stats(),dataKeys:Object.keys(globalThis.SpawnerUnitAppearanceData||{})};
    }''')
    assert lazy['stats']['leases']==0 and lazy['stats']['residentBytes']==0 and not lazy['dataKeys']
    assert lazy['stats']['peakBytes']<=lazy['stats']['byteBudget']
    assert not errors,errors
    report={'schema':'spawner.visible-bean-browser-qa.v1','sourceCount':31,'evaluatedGpuFrames':310,
            'pageErrors':errors,'sources':rows,'fileLazyProtocolSimulation':lazy,
            'mobile':{'viewport':[390,844],'deviceScaleFactor':3,'touch':True,'horizontalOverflow':False,'minimumControlHeight':44,'sourceStats':mobile_stats},
            'scope':'Actual rendered draft frames, not action registration or art approval. File protocol loader exercised over HTTP because file navigation is blocked in this environment.'}
    (here/'visible-parts-browser-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    browser.close()
print(json.dumps({'sources':31,'gpuFrames':310,'pageErrors':len(errors),'fixedPixelMaxError':max(row['fixedMaxError'] for result in rows for row in result['rows']),'fileLazyLeasesAfterClear':0}))
