const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const scratch = path.resolve(root, '../$Trash/SporeDrapedV2');
  const study = process.argv.includes('--study');
  const file = study ? path.join(scratch, 'representative.webp') : path.join(root, 'growth.webp');
  const image = fs.readFileSync(file).toString('base64');
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 640, height: 640}});
  await page.setContent('<style>html,body{margin:0;background:#20282e}img{display:block;width:640px;height:640px}</style><img src="data:image/webp;base64,' + image + '">');
  await page.locator('img').evaluate(im => im.decode());
  const start = performance.now();
  const targets = study ? [0, 150, 300, 500, 700, 1000, 1350, 1700, 1900, 2050, 2250, 2450, 2750, 3050, 3300] : [0, 500, 1000, 1400, 1750, 1810, 2150, 2700, 2760, 3150, 3650, 3850, 4450, 5050, 5200, 5500];
  const times = [];
  for (let i = 0; i < targets.length; i++) {
    const delay = targets[i] - (performance.now() - start);
    if (delay > 0) await page.waitForTimeout(delay);
    times.push(performance.now() - start);
    await page.screenshot({path: path.join(scratch, (study ? 'study-' : 'browser-') + String(i).padStart(2, '0') + '.png')});
  }
  fs.writeFileSync(path.join(scratch, study ? 'study-times.json' : 'playback-times.json'), JSON.stringify(times));
  console.log(JSON.stringify({samples: times.length, timesMs: times.map(Math.round), surface: [640, 640], file}));
  await browser.close();
})();
