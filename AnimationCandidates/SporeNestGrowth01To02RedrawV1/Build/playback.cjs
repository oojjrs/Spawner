const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('C:/Users/oojjr/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

(async () => {
  const root = path.resolve(__dirname, '..');
  const scratch = path.resolve(root, '../$Trash/SporeRedrawV1');
  const file = path.join(root, 'covered-growth.webp');
  const data = fs.readFileSync(file).toString('base64');
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 640, height: 640}});
  await page.setContent('<style>html,body{margin:0;background:#20282e}img{display:block;width:640px;height:640px}</style><img src="data:image/webp;base64,' + data + '">');
  await page.locator('img').evaluate(im => im.decode());
  const start = performance.now();
  const targets = [0, 600, 820, 910, 1005, 1080, 1205, 1550, 2010, 2160, 2270, 2370, 2505, 2850, 3250];
  const times = [];
  for (let i = 0; i < targets.length; i++) {
    const delay = targets[i] - (performance.now() - start);
    if (delay > 0) await page.waitForTimeout(delay);
    times.push(performance.now() - start);
    await page.screenshot({path: path.join(scratch, 'growth-' + String(i).padStart(2, '0') + '.png')});
  }
  fs.writeFileSync(path.join(scratch, 'growth-playback.json'), JSON.stringify({file, timesMs: times.map(Math.round), surface: [640, 640]}));
  console.log(JSON.stringify({samples: times.length, timesMs: times.map(Math.round), surface: [640, 640]}));
  await browser.close();
})();
