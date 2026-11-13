// Thinstream browser test for Firefox. Installs the build in ../dist/firefox (run
// ./scripts/build.sh first) and checks the player button, 144p, the panel and restore.
// Run: cd tests && npm i puppeteer-core && FF=/path/to/firefox node e2e-firefox.mjs
// Get a test Firefox with: npx @puppeteer/browsers install firefox@stable --path ./browsers
// From a sandboxed shell also set CFFIXED_USER_HOME and HOME to a scratch folder, or
// Firefox exits with "Could not find profile folder".
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = process.env.EXT || path.resolve(here, '../dist/firefox');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'thinstream-firefox-'));
fs.mkdirSync(path.join(OUT, 'profile'), { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const browser = await puppeteer.launch({
  browser: 'firefox',
  executablePath: process.env.FF,
  headless: true, userDataDir: path.join(OUT, 'profile'),
  extraPrefsFirefox: { 'media.autoplay.default': 0, 'media.volume_scale': '0.0', 'intl.accept_languages': 'en-US, en' },
});
console.log('version:', await browser.version());
const extId = await browser.installExtension(EXT);
console.log('installed extension:', extId);
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
const snap = async (label) => page.evaluate(() => {
  const p = document.getElementById('movie_player');
  const panel = document.getElementById('thinstream-panel');
  const v = document.querySelector('#movie_player video');
  return {
    cls: document.documentElement.className.match(/thinstream[\w-]*/g),
    pageAttr: document.documentElement.getAttribute('data-thinstream-page'),
    btn: !!document.querySelector('.thinstream-btn'), btnParent: document.querySelector('.thinstream-btn')?.parentElement?.className,
    panelShown: !!panel && getComputedStyle(panel).display !== 'none',
    lines: panel ? panel.querySelectorAll('.ts-line').length : 0,
    first: panel?.querySelector('.ts-line .ts-text')?.textContent?.slice(0, 50),
    empty: panel?.querySelector('.ts-empty')?.textContent,
    meta: panel?.querySelector('.ts-meta')?.textContent,
    langs: [...(panel?.querySelectorAll('.ts-lang option') || [])].map(o => o.textContent).slice(0, 5),
    ccPressed: p?.querySelector('.ytp-subtitles-button')?.getAttribute('aria-pressed'),
    ls: localStorage.getItem('yt-player-quality'), prev: localStorage.getItem('thinstream:prev-quality'),
    t: v?.currentTime, paused: v?.paused, videoVis: v ? getComputedStyle(v).visibility : null,
  };
}).then(r => { console.log('\n== ' + label + '\n' + JSON.stringify(r)); return r; });

await page.goto('https://www.youtube.com/watch?v=' + (process.argv[2] || 'jNQXAC9IVRw'), { waitUntil: 'domcontentloaded' });
await sleep(7000);
console.log('title:', await page.title());
await snap('1 loaded, mode off');
console.log('clicked:', await page.evaluate(() => { const b = document.querySelector('.thinstream-btn'); b?.click(); return !!b; }));
await sleep(8000);
await snap('2 mode on');
await page.screenshot({ path: OUT + '/ff-on.png' });
await page.goto('https://www.youtube.com/watch?v=' + (process.argv[2] || 'jNQXAC9IVRw'), { waitUntil: 'domcontentloaded' });
await sleep(9000);
await snap('3 fresh load with mode on');
await page.evaluate(() => [...document.querySelectorAll('#thinstream-panel .ts-tool')].find(b => b.textContent === 'Show video')?.click());
await sleep(4000);
await snap('4 mode off again');
console.log('errors:', errors.slice(0, 5));
await browser.close();
