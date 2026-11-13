// Makes the Mac App Store assets from the real extension on YouTube:
//   ../dist/appstore/screenshots/mac-*.png   2880x1800
//   ../dist/appstore/preview/mac-preview.mp4 1920x1080, under 30 s, silent audio track
// Same approach as record.mjs: real extension, real page, caption file replayed, pointer drawn in.
// "Hide recommendations and comments" is switched on, so no other channels' thumbnails show.
// The preview take also hides the sidebar with a style tag before listen mode is switched on.
// Run: cd demo && node store-shots.mjs
import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(here, '../extension');
const SHOTS = path.resolve(here, '../dist/appstore/screenshots');
const PREVIEW = path.resolve(here, '../dist/appstore/preview');
const caps = JSON.parse(fs.readFileSync(path.join(here, 'captions-tears-of-steel.json'), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const trash = (p, tag) => { if (fs.existsSync(p)) fs.renameSync(p, path.join(process.env.HOME, '.Trash', `thinstream-${tag}-${Date.now()}`)); };
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(PREVIEW, { recursive: true });
const profile = path.join(SHOTS, '.profile'); trash(profile, 'shots-profile');
const extId = [...crypto.createHash('sha256').update(EXT).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', headless: true, userDataDir: profile,
  args: [`--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`, '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--lang=en-US'], ignoreDefaultArgs: ['--disable-extensions'] });

// switch on the extension's own "Hide recommendations and comments" option
const pop = await browser.newPage();
await pop.goto(`chrome-extension://${extId}/popup/popup.html`); await sleep(500);
await pop.click('#hideExtras'); await sleep(400); await pop.close();

const page = await browser.newPage();
await page.setCookie({ name: 'wide', value: '1', domain: '.youtube.com', path: '/' });
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (!url.includes('/api/timedtext')) return req.continue();
  const lines = caps[new URL(url).searchParams.get('lang') || 'en'];
  if (!lines) return req.respond({ status: 404, body: '' });
  req.respond({ status: 200, contentType: 'application/json; charset=UTF-8', body: JSON.stringify({ events: lines.map(([t, s], i) => ({ tStartMs: Math.round(t * 1000), dDurationMs: Math.round(((lines[i + 1] ? lines[i + 1][0] : t + 4) - t) * 1000), segs: [{ utf8: s }] })) }) });
});
const filmTime = () => page.evaluate(() => document.querySelector('#movie_player video').currentTime);
const errorShown = () => page.evaluate(() => { const e = document.querySelector('#movie_player .ytp-error'); return !!e && getComputedStyle(e).display !== 'none'; });
const waitFilm = async (t, max = 60000) => { const end = Date.now() + max; while ((await filmTime()) < t && Date.now() < end) await sleep(150); };
async function open(until) {
  await page.goto('https://www.youtube.com/watch?v=R6MlUcmOul8', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => { const p = document.getElementById('movie_player'); return p && p.getPlayerState && p.getPlayerState() === 1; }, { timeout: 30000 });
  await sleep(2500);
  await page.evaluate(() => { if (!document.querySelector('ytd-watch-flexy[theater]')) document.querySelector('.ytp-size-button')?.click(); window.scrollTo(0, 0); });
  await waitFilm(until);
}
const pickLang = (name) => page.evaluate((name) => { const s = document.querySelector('#thinstream-panel .ts-lang'); s.value = String([...s.options].findIndex((o) => o.textContent.startsWith(name))); s.dispatchEvent(new Event('change')); }, name);

// ---------- the preview take: one click, transcript follows, language switch ----------
await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1.5 });
await open(13.2);
// Before listen mode is on, the extension does not hide the sidebar, so hide it here too.
// That keeps other channels' thumbnails out of the preview. It only changes the page layout.
await page.addStyleTag({ content: 'ytd-watch-flexy #secondary, ytd-watch-flexy #related { display: none !important; }' });
await page.evaluate(() => {
  const c = document.createElement('div'); c.id = 'demo-cursor';
  c.style.cssText = 'position:fixed;left:0;top:0;width:22px;height:22px;z-index:2147483647;pointer-events:none;transform:translate(640px,300px)';
  const ns = 'http://www.w3.org/2000/svg'; const s = document.createElementNS(ns, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', '22'); s.setAttribute('height', '22');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', 'M4 2l14 9.5-6.2 1.2 3.6 7.1-2.7 1.3-3.5-7.2L4 18z'); p.setAttribute('fill', '#fff'); p.setAttribute('stroke', '#000'); p.setAttribute('stroke-width', '1.4'); p.setAttribute('stroke-linejoin', 'round');
  s.append(p); c.append(s);
  const ring = document.createElement('div'); ring.style.cssText = 'position:absolute;left:-14px;top:-14px;width:32px;height:32px;border-radius:50%;border:3px solid #5ef2c0;opacity:0;transform:scale(.4)'; c.append(ring);
  document.documentElement.append(c);
  document.addEventListener('mousemove', (e) => { c.style.transform = `translate(${e.clientX}px,${e.clientY}px)`; }, true);
  document.addEventListener('mousedown', () => { ring.animate([{ opacity: 0.95, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.5)' }], { duration: 450, easing: 'ease-out' }); }, true);
});
let mouse = { x: 640, y: 300 }; await page.mouse.move(640, 300);
async function moveTo(x, y, ms = 700) { const n = Math.max(8, Math.round(ms / 16)); for (let i = 1; i <= n; i++) { const k = i / n; const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; await page.mouse.move(mouse.x + (x - mouse.x) * e, mouse.y + (y - mouse.y) * e); await sleep(16); } mouse = { x, y }; }
const center = (sel) => page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, sel);
const webm = path.join(PREVIEW, 'take.webm');
const rec = await page.screencast({ path: webm });
const t0 = Date.now();
await sleep(1200);
const btn = await center('.thinstream-btn'); await moveTo(btn.x, btn.y, 900);
await waitFilm(16.6, 8000);
await page.mouse.click(btn.x, btn.y);
await sleep(900); await moveTo(1120, 330, 900);
await waitFilm(33.2, 25000);
const lang = await center('#thinstream-panel .ts-lang'); await moveTo(lang.x, lang.y, 600);
await pickLang('Spanish'); await sleep(3000);
await pickLang('Arabic'); await sleep(3200);
await pickLang('English'); await sleep(1800);
await rec.stop();
console.log('preview take', ((Date.now() - t0) / 1000).toFixed(1) + 's, film at', Math.round(await filmTime()), 'error', await errorShown());

// ---------- screenshots (listen mode is on from here) ----------
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
async function shot(name) { await page.mouse.move(720, 520); await sleep(500); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log(name, 'film', Math.round(await filmTime()), 'error', await errorShown()); }
await open(31.5); await shot('mac-1-listen-mode');
await page.evaluate(() => { const b = [...document.querySelectorAll('#thinstream-panel .ts-tool')].find((x) => x.textContent === 'A+'); b.click(); b.click(); b.click(); });
await waitFilm(39); await sleep(600); await shot('mac-2-larger-text');
await open(26); await pickLang('Arabic'); await sleep(3500); await shot('mac-3-arabic');
await browser.close();
trash(profile, 'shots-profile');

// ---------- encode the preview: 1920x1080, 30 fps, at most 29.5 s, with a silent stereo track ----------
const out = path.join(PREVIEW, 'mac-preview.mp4'); trash(out, 'old-preview');
execFileSync('nice', ['-n', '10', 'ffmpeg', '-y', '-loglevel', 'error', '-i', webm, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
  '-t', '29.5', '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.0', '-crf', '17', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out]);
trash(webm, 'take');
