// Re-films only the toolbar popup, so the clip shows the current version number.
// Uses the same browser profile as record.mjs, so the "listened" line is still there.
import puppeteer from 'puppeteer-core';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const here = path.dirname(fileURLToPath(import.meta.url));
const EXT = path.resolve(here, '../extension');
const OUT = path.join(here, 'footage');
const version = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8')).version;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const extId = [...crypto.createHash('sha256').update(EXT).digest('hex').slice(0, 32)].map((c) => String.fromCharCode(97 + parseInt(c, 16))).join('');
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', headless: true, userDataDir: path.join(OUT, '.profile'),
  args: [`--load-extension=${EXT}`, `--disable-extensions-except=${EXT}`, '--lang=en-US'], ignoreDefaultArgs: ['--disable-extensions'] });
const pop = await browser.newPage();
await pop.setViewport({ width: 320, height: 360, deviceScaleFactor: 3 });
await pop.goto(`chrome-extension://${extId}/popup/popup.html`);
await sleep(600);
if (await pop.$eval('#on', (el) => el.checked)) { await pop.click('#on'); await sleep(400); }
const name = `04-popup-${version}`;
const rec = await pop.screencast({ path: path.join(OUT, name + '.webm') });
await sleep(1200); await pop.click('#on');
await sleep(1500); await pop.click('#hideExtras');
await sleep(1500); await pop.click('#hideExtras');
await sleep(800); await pop.click('#on');
await sleep(1000);
await rec.stop();
console.log(JSON.stringify(await pop.evaluate(() => ({ version: document.getElementById('version').textContent, stats: document.getElementById('stats').textContent }))));
await browser.close();
execFileSync('nice', ['-n', '10', 'ffmpeg', '-y', '-loglevel', 'error', '-i', path.join(OUT, name + '.webm'), '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-an', path.join(OUT, name + '.mp4')]);
fs.renameSync(path.join(OUT, name + '.webm'), path.join(process.env.HOME, '.Trash', `thinstream-${name}-${Date.now()}.webm`));
