// Records the real Thinstream extension running on YouTube in Chrome for Testing.
// Output: demo/footage/*.mp4 (1920x1080) plus markers.json with what happens when.
//
// What is real: the extension, the YouTube page, the player dropping to 144p, every click.
// What is replayed: the caption file. YouTube does not serve captions to a test browser,
// so /api/timedtext is answered from demo/captions-tears-of-steel.json, which holds the
// lines YouTube served for this film in a normal browser (first 170 seconds). The extension
// then reads that response the same way it reads the live one.
// A test browser also cannot skip ahead in a video (YouTube stops sending data after a
// seek), so the film plays from the start and the one jump stays a few seconds ahead.
//
// Run: cd demo && npm i puppeteer-core && node record.mjs
import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(here, '../extension');
const OUT = path.join(here, 'footage');
const CHROME = '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';
const caps = JSON.parse(fs.readFileSync(path.join(here, 'captions-tears-of-steel.json'), 'utf8'));
const VIDEO = 'R6MlUcmOul8';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const extId = [...crypto.createHash('sha256').update(EXT).digest('hex').slice(0, 32)]
  .map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');

// Always start from a clean browser profile. The old one goes to the Trash.
const profile = path.join(OUT, '.profile');
if (fs.existsSync(profile)) fs.renameSync(profile, path.join(process.env.HOME, '.Trash', `thinstream-profile-${Date.now()}`));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: path.join(OUT, '.profile'),
  args: [`--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`,
    '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1280,720', '--lang=en-US'],
  ignoreDefaultArgs: ['--disable-extensions'],
});
await browser.defaultBrowserContext().overridePermissions('https://www.youtube.com', ['clipboard-read', 'clipboard-write']);

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 2 });
// YouTube's own "theater mode" preference, so the player fills the frame.
await page.setCookie({ name: 'wide', value: '1', domain: '.youtube.com', path: '/' });

// Replay the saved caption file for this film.
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/api/timedtext')) return req.continue();
  const lang = new URL(url).searchParams.get('lang') || 'en';
  const lines = caps[lang];
  if (!lines) return req.respond({ status: 404, body: '' });
  const events = lines.map(([t, s], i) => ({
    tStartMs: Math.round(t * 1000),
    dDurationMs: Math.round(((lines[i + 1] ? lines[i + 1][0] : t + 4) - t) * 1000),
    segs: [{ utf8: s }],
  }));
  req.respond({ status: 200, contentType: 'application/json; charset=UTF-8', body: JSON.stringify({ wireMagic: 'pb3', events }) });
});

const markers = {};
let clipStart = 0;
let clipName = '';
let recorder = null;
const mark = (label) => { (markers[clipName] ||= []).push({ t: +((Date.now() - clipStart) / 1000).toFixed(2), label }); };
async function start(name) {
  clipName = name;
  recorder = await page.screencast({ path: path.join(OUT, name + '.webm') });
  clipStart = Date.now();
}
async function stop() {
  await recorder.stop();
  const src = path.join(OUT, clipName + '.webm');
  const dst = path.join(OUT, clipName + '.mp4');
  execFileSync('nice', ['-n', '10', 'ffmpeg', '-y', '-loglevel', 'error', '-i', src,
    '-vf', 'scale=1920:1080:flags=lanczos,fps=30', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', dst]);
  fs.renameSync(src, path.join(os_trash(), `thinstream-${clipName}-${Date.now()}.webm`));
}
function os_trash() { return path.join(process.env.HOME, '.Trash'); }

// A drawn cursor, because a page recording has no mouse pointer in it.
async function addCursor() {
  await page.evaluate(() => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(640px,360px);transition:none';
    const ns = 'http://www.w3.org/2000/svg';
    const s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '22'); s.setAttribute('height', '22');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', 'M4 2l14 9.5-6.2 1.2 3.6 7.1-2.7 1.3-3.5-7.2L4 18z');
    p.setAttribute('fill', '#fff'); p.setAttribute('stroke', '#000'); p.setAttribute('stroke-width', '1.4'); p.setAttribute('stroke-linejoin', 'round');
    s.append(p); c.append(s);
    const ring = document.createElement('div');
    ring.style.cssText = 'position:absolute;left:-14px;top:-14px;width:32px;height:32px;border-radius:50%;border:3px solid #5ef2c0;opacity:0;transform:scale(.4)';
    c.append(ring);
    document.documentElement.append(c);
    document.addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
    document.addEventListener('mousedown', () => {
      ring.animate([{ opacity: 0.95, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 450, easing: 'ease-out' });
    }, true);
  });
}
let mouse = { x: 640, y: 360 };
async function moveTo(x, y, ms = 700) {
  const steps = Math.max(8, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = i / steps; const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    await page.mouse.move(mouse.x + (x - mouse.x) * e, mouse.y + (y - mouse.y) * e);
    await sleep(16);
  }
  mouse = { x, y };
}
async function center(selector, pick) {
  return page.evaluate((sel, pick) => {
    const list = [...document.querySelectorAll(sel)];
    const el = pick == null ? list[0] : (typeof pick === 'number' ? list[pick] : list.find((n) => n.textContent.includes(pick)));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, selector, pick);
}
async function clickOn(selector, pick, label) {
  const c = await center(selector, pick);
  if (!c) throw new Error('not found: ' + selector + ' ' + pick);
  await moveTo(c.x, c.y);
  await sleep(250);
  mark(label);
  await page.mouse.click(c.x, c.y);
}
const seek = (t) => page.evaluate((t) => { const p = document.getElementById('movie_player'); p.seekTo(t, true); p.playVideo(); }, t);

// ---------- helpers for each take ----------
// A test browser only gets about the first 50 seconds of a film from YouTube, and cannot
// skip ahead. So every clip starts from a fresh page load and stays inside that window.
const errorShown = () => page.evaluate(() => { const e = document.querySelector('#movie_player .ytp-error'); return !!e && getComputedStyle(e).display !== 'none'; });
const filmTime = () => page.evaluate(() => Math.round(document.querySelector('#movie_player video').currentTime * 10) / 10);
async function openFilm(untilSeconds) {
  await page.goto('https://www.youtube.com/watch?v=' + VIDEO, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const p = document.getElementById('movie_player'); return p && p.getPlayerState && p.getPlayerState() === 1; }, { timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => { if (!document.querySelector('ytd-watch-flexy[theater]')) document.querySelector('.ytp-size-button')?.click(); });
  await sleep(1200);
  await page.evaluate(() => window.scrollTo(0, 0));
  console.log('theater mode:', await page.evaluate(() => !!document.querySelector('ytd-watch-flexy[theater]')));
  await addCursor();
  mouse = { x: 640, y: 360 };
  await page.mouse.move(640, 360);
  await waitFilm(untilSeconds, 60000);
}
// Wait until the film reaches a time, but never longer than maxMs. A test browser can
// stall (for example when the quality goes back up), and the take must still end.
async function waitFilm(t, maxMs) {
  const until = Date.now() + maxMs;
  while ((await filmTime()) < t && Date.now() < until) await sleep(200);
}
async function endClip(n) {
  mark('end');
  const t = await filmTime(); const err = await errorShown();
  console.log(`clip ${n}: film at ${t}s, player error: ${err}`);
  if (err) mark('PLAYER ERROR on screen at the end of this take, trim before it');
  await stop();
}

// ---------- clip 1: normal video, one click, transcript follows ----------
await openFilm(11.5);
await start('01-one-click');
mark('film playing at normal quality');
await moveTo(640, 300, 900);
await waitFilm(16.5, 15000);
await clickOn('.thinstream-btn', null, 'click the Thinstream button');
await sleep(1200);
mark('listen mode on, 144p, transcript shown');
await moveTo(1100, 330, 900);
await waitFilm(46.5, 40000); // dialogue runs 0:23 to 0:43, lines light up one by one
await endClip(1);

// Click to jump is not recorded here: a test browser cannot skip ahead on YouTube.
// It was tested by hand in a normal browser and needs a real screen recording.

// ---------- clip 2: caption language (listen mode is still on after the reload) ----------
await openFilm(24);
await start('02-language');
const langBox = await center('#thinstream-panel .ts-lang');
await moveTo(langBox.x, langBox.y);
await sleep(500);
const pickLang = async (name, label) => {
  mark(label);
  await page.evaluate((name) => {
    const s = document.querySelector('#thinstream-panel .ts-lang');
    const i = [...s.options].findIndex((o) => o.textContent.startsWith(name));
    s.value = String(i); s.dispatchEvent(new Event('change'));
  }, name);
};
await pickLang('Spanish', 'switch captions to Spanish');
await sleep(3800);
await pickLang('Arabic', 'switch captions to Arabic, right to left');
await sleep(3800);
await pickLang('English', 'back to English');
await sleep(2800);
await endClip(2);

// ---------- clip 3: text size, copy, back to video ----------
await openFilm(25);
await start('03-tools-and-back');
await sleep(500);
await clickOn('#thinstream-panel .ts-tool', 'A+', 'larger text');
await sleep(450);
await page.mouse.click(mouse.x, mouse.y);
await sleep(450);
await page.mouse.click(mouse.x, mouse.y);
await sleep(1100);
await clickOn('#thinstream-panel .ts-tool', 'Copy', 'copy the transcript');
await sleep(1500);
const facts = await page.evaluate(() => ({
  meta: document.querySelector('#thinstream-panel .ts-meta')?.textContent,
  lines: document.querySelectorAll('#thinstream-panel .ts-line').length,
  langs: document.querySelectorAll('#thinstream-panel .ts-lang option').length,
  note: 'lines is 14 because the saved caption file is an excerpt (first 170 seconds of the film)',
}));
await clickOn('#thinstream-panel .ts-tool', 'Show video', 'show video again');
await sleep(600);
mark('video is back');
await moveTo(640, 330, 700);
await sleep(1800); // keep this short: a test browser stalls when the quality goes back up
await endClip(3);

// ---------- clip 4: the toolbar popup ----------
const pop = await browser.newPage();
await pop.setViewport({ width: 320, height: 360, deviceScaleFactor: 3 });
await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
await sleep(600);
const popRec = await pop.screencast({ path: path.join(OUT, '04-popup.webm') });
await sleep(1200);
await pop.click('#on');
await sleep(1500);
await pop.click('#hideExtras');
await sleep(1500);
await pop.click('#hideExtras');
await sleep(800);
await pop.click('#on');
await sleep(1000);
await popRec.stop();
execFileSync('nice', ['-n', '10', 'ffmpeg', '-y', '-loglevel', 'error', '-i', path.join(OUT, '04-popup.webm'),
  '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', path.join(OUT, '04-popup.mp4')]);
fs.renameSync(path.join(OUT, '04-popup.webm'), path.join(os_trash(), `thinstream-04-popup-${Date.now()}.webm`));

fs.writeFileSync(path.join(OUT, 'markers.json'), JSON.stringify({ film: caps.title, credit: caps.credit, facts, markers }, null, 2) + '\n');
console.log(JSON.stringify({ facts, clips: Object.keys(markers) }));
await browser.close();
