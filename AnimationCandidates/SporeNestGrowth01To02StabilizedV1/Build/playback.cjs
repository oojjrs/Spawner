const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const scratch = path.resolve(root, '../$Trash/SporeStabilizedV1');
  const study = process.argv.includes('--study');
  const file = study ? path.join(scratch, 'connections-study.webp') : path.join(root, 'growth.webp');
  const data = fs.readFileSync(file).toString('base64');
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 640, height: 640}});
  await page.setContent('<style>html,body{margin:0;background:#20282e}img{display:block;width:640px;height:640px}</style><img src="data:image/webp;base64,' + data + '">');
  await page.locator('img').evaluate(im => im.decode());
  const start = performance.now();
  const targets = study ? [0,200,400,600,800,1000,1400,1500,1700,1900,2100,2300,2450,2750,2950,3200] : [0,250,500,750,980,1050,1450,1750,1850,1950,2070,2260,2650,3000,3150,3300,3450,3550,3950,4250,4400,4650,4900,5150,5400,5650,5750,6100];
  const times = [];
  for (let i = 0; i < targets.length; i++) {
    const delay = targets[i] - (performance.now() - start);
    if (delay > 0) await page.waitForTimeout(delay);
    times.push(performance.now() - start);
    await page.screenshot({path: path.join(scratch, (study ? 'study-' : 'full-') + String(i).padStart(2, '0') + '.png')});
  }
  fs.writeFileSync(path.join(scratch, study ? 'study-playback.json' : 'full-playback.json'), JSON.stringify({file, timesMs: times.map(Math.round), surface: [640,640]}));
  console.log(JSON.stringify({samples: times.length, timesMs: times.map(Math.round), surface: [640,640]}));
  await browser.close();
})();
