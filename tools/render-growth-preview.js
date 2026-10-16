// Render the real mini-program canvas exporter in Chromium for visual QA.
// All preview numbers are sample data, never loaded from user storage.
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/A1996/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve(__dirname, '..');
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 560 }, deviceScaleFactor: 2 });
    await page.setContent('<html><body style="margin:0"><canvas id="card" style="width:375px;height:560px"></canvas></body></html>');
    const source = fs.readFileSync(path.join(root, 'utils/share-card.js'), 'utf8');
    await page.addScriptTag({ content: '(function(){const module={exports:{}};' + source + ';window.cards=module.exports;})()' });
    const directory = path.join(root, 'docs/codex-tasks/training-growth-preview');
    fs.mkdirSync(directory, { recursive: true });
    const reports = [
      { kind: 'session', title: '胸 · 三角肌中束 · 三头', date: '2026-10-16', volume: 4260, exerciseCount: 5, setCount: 17, durationMin: 48, newRecords: [{ name: '杠铃卧推', label: '最大重量' }] },
      { kind: 'week', title: '我的训练周报', start: '2026-10-05', end: '2026-10-11', volume: 18450, trainingCount: 4, setCount: 64, avgCalories: 2130, avgProtein: 136, weightChange: -.4, nutritionDays: 5, newRecords: [{ name: '杠铃卧推', label: '最大重量' }, { name: '深蹲', label: '估算 1RM' }] }
    ];
    for (const report of reports) {
      await page.evaluate(report => window.cards.render(document.querySelector('canvas'), report), report);
      await page.locator('canvas').screenshot({ path: path.join(directory, report.kind + '.png') });
    }
    console.log('Rendered 2 actual canvas exporters using sample data: ' + directory);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
