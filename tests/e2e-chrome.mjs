// Thinstream browser test for Chrome. Loads the unpacked extension from ../extension in
// Chrome for Testing and checks the player button, 144p, the panel, restore and the popup.
// Run: cd tests && npm i puppeteer-core && node e2e-chrome.mjs [videoId]
// Chrome path: set CHROME, or it uses /Applications/Google Chrome for Testing.app.
// Note: YouTube sends a test browser an empty caption file, so transcript lines stay at 0
// here. Test the transcript on live YouTube in a normal browser (see HISTORY.md).
import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = process.env.EXT || path.resolve(here, '../extension');
const OUT = process.env.OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'thinstream-chrome-'));
const VID = process.argv[2] || 'jNQXAC9IVRw';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const extId = [...crypto.createHash('sha256').update(EXT).digest('hex').slice(0, 32)].map(c => String.fromCharCode(97 + parseInt(c, 16))).join('');
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
  userDataDir: OUT + '/profile',
  args: [`--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1400,900', '--lang=en-US'],
  ignoreDefaultArgs: ['--disable-extensions'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message.slice(0, 200)));
page.on('console', m => { if (m.type() === 'error' && /thinstream|extension/i.test(m.text())) errors.push('console: ' + m.text().slice(0, 200)); });
const snap = async (label) => page.evaluate(() => {
  const p = document.getElementById('movie_player');
  const panel = document.getElementById('thinstream-panel');
  const v = document.querySelector('#movie_player video');
  return {
    url: location.href.slice(0, 60),
    cls: document.documentElement.className.match(/thinstream[\w-]*/g),
    pageAttr: document.documentElement.getAttribute('data-thinstream-page'),
    btn: !!document.querySelector('.thinstream-btn'), btnParent: document.querySelector('.thinstream-btn')?.parentElement?.className,
    panelShown: !!panel && getComputedStyle(panel).display !== 'none',
    lines: panel ? panel.querySelectorAll('.ts-line').length : 0,
    first: panel?.querySelector('.ts-line .ts-text')?.textContent?.slice(0, 60),
    now: panel?.querySelector('.ts-now .ts-text')?.textContent?.slice(0, 60),
    empty: panel?.querySelector('.ts-empty')?.textContent,
    meta: panel?.querySelector('.ts-meta')?.textContent,
    langs: [...(panel?.querySelectorAll('.ts-lang option') || [])].map(o => o.textContent).slice(0, 8),
    lang: panel?.querySelector('.ts-lang')?.selectedOptions?.[0]?.textContent,
    ccPressed: p?.querySelector('.ytp-subtitles-button')?.getAttribute('aria-pressed'),
    ls: localStorage.getItem('yt-player-quality'), prev: localStorage.getItem('thinstream:prev-quality'),
    t: v?.currentTime, paused: v?.paused, state: p?.className.match(/(playing|paused|unstarted|ad-showing|buffering)-?mode|ad-showing/g),
  };
}).then(r => { console.log('\n== ' + label + '\n' + JSON.stringify(r, null, 1)); return r; });

await page.goto('https://www.youtube.com/watch?v=' + VID, { waitUntil: 'domcontentloaded' });
await sleep(6000);
console.log('title:', await page.title());
// consent wall?
const consent = await page.evaluate(() => !!document.querySelector('form[action*="consent"], ytd-consent-bump-v2-lightbox'));
console.log('consent wall:', consent);
await page.evaluate(() => document.getElementById('movie_player')?.playVideo?.());
await sleep(2000);
await snap('1 loaded, mode off');
await page.screenshot({ path: OUT + '/1-off.png' });
// main-world quality before
const q0 = await page.evaluate(() => { const b = document.querySelector('.thinstream-btn'); b?.click(); return !!b; });
console.log('clicked button:', q0);
await sleep(7000);
await snap('2 mode on');
await page.screenshot({ path: OUT + '/2-on.png' });
// language switch
const switched = await page.evaluate(() => { const s = document.querySelector('#thinstream-panel .ts-lang'); if (!s || s.options.length < 2) return false; s.value = String((s.selectedIndex + 1) % s.options.length); s.dispatchEvent(new Event('change')); return true; });
if (switched) { await sleep(5000); await snap('3 language switched'); }
// seek by line click
await page.evaluate(() => { const rows = document.querySelectorAll('#thinstream-panel .ts-line'); rows[Math.min(3, rows.length - 1)]?.click(); });
await sleep(1500);
await snap('4 after line click');
// reload with mode on (document_start path)
await page.goto('https://www.youtube.com/watch?v=' + (process.argv[3] || VID), { waitUntil: 'domcontentloaded' });
await sleep(9000);
await snap('5 fresh load with mode on');
await page.screenshot({ path: OUT + '/5-fresh.png' });
// turn off
await page.evaluate(() => [...document.querySelectorAll('#thinstream-panel .ts-tool')].find(b => b.textContent === 'Show video')?.click());
await sleep(4000);
await snap('6 mode off again');
await page.screenshot({ path: OUT + '/6-off.png' });
// popup
const pop = await browser.newPage();
await pop.setViewport({ width: 320, height: 330, deviceScaleFactor: 2 });
try {
  await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
  await sleep(500);
  await pop.screenshot({ path: OUT + '/popup.png' });
  console.log('popup ok', await pop.evaluate(() => ({ v: document.getElementById('version').textContent, on: document.getElementById('on').checked })));
} catch (e) { console.log('popup failed', e.message); }
console.log('errors:', errors);
await browser.close();
