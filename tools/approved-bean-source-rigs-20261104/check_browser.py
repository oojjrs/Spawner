#!/usr/bin/env python3
"""Validate the standalone bind viewer served by an existing local HTTP server."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--base-url', default='http://127.0.0.1:8768/')
args = parser.parse_args()
here = Path(__file__).resolve().parent
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':1100,'height':850}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(args.base_url.rstrip('/')+'/tools/approved-bean-source-rigs-20261104/', wait_until='networkidle')
    page.wait_for_function('window.bindReview !== undefined')
    result = page.evaluate('window.bindReview.validateAll()')
    assert result['sourceCount'] == 32
    assert all(row['differentRgbaValues'] == 0 and row['maxRgbaError'] == 0 for row in result['sources'])
    for mask in [0,1,2,4,8,16,31]:
        page.evaluate('(mask) => window.bindReview.select(mask)', mask)
        page.locator('#mesh').check()
        page.locator('#lean').check()
        assert page.locator(f'button[data-mask="{mask}"]').get_attribute('aria-pressed') == 'true'
    page.set_viewport_size({'width':390, 'height':844})
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile horizontal overflow'
    assert page.locator('button').first.bounding_box()['height'] >= 44
    assert not errors, errors
    result['pageErrors'] = errors
    result['mobileViewport'] = [390,844]
    result['mobileHorizontalOverflow'] = False
    result['scope'] = 'Browser decoded-RGBA comparison. Raw PNG-decoded RGBA comparison is independently recorded by build.py.'
    (here/'browser-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    browser.close()
print(json.dumps({'sources':32,'maxBrowserRgbaError':0,'pageErrors':len(errors),'mobileHorizontalOverflow':False}))
