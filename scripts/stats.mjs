#!/usr/bin/env node
// Thinstream numbers from GitHub: release downloads, stars, forks and repo traffic.
//
//   node scripts/stats.mjs
//
// Needs the `gh` CLI, signed in. Nothing here touches the extension, and nothing
// is sent anywhere except the questions to GitHub's API.
//
// GitHub only keeps repo traffic (views and clones) for 14 days, so every run
// saves what it sees to stats/history.json. Run it at least once every two weeks
// and no day is lost. Running it twice on one day just refreshes that day.
//
// stats/history.json is not in git (see .gitignore). It holds traffic numbers
// that are not public, and the site hides the download count until it is worth
// showing. What counts as "worth showing" is MIN_DOWNLOADS in docs/index.html.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'alireza12t/thinstream';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// STATS_FILE points the script at another history file, for testing.
const historyFile = process.env.STATS_FILE || path.join(root, 'stats', 'history.json');

function gh(endpoint, { paginate = false } = {}) {
  const args = ['api', endpoint];
  if (paginate) args.push('--paginate', '--slurp');
  const out = execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const data = JSON.parse(out);
  return paginate ? data.flat() : data;
}

// Traffic needs push access to the repo. If the token does not have it, carry on without.
function ghOptional(endpoint) {
  try { return gh(endpoint); } catch { return null; }
}

const day = (iso) => iso.slice(0, 10);
const n = (x) => Number(x).toLocaleString('en-US');

// ---- ask GitHub ----
const repo = gh(`repos/${REPO}`);
const releases = gh(`repos/${REPO}/releases?per_page=100`, { paginate: true });
const views = ghOptional(`repos/${REPO}/traffic/views`);
const clones = ghOptional(`repos/${REPO}/traffic/clones`);
const referrers = ghOptional(`repos/${REPO}/traffic/popular/referrers`);
const paths = ghOptional(`repos/${REPO}/traffic/popular/paths`);

const now = new Date().toISOString();
const today = day(now); // UTC, the same clock GitHub's traffic days use
const born = day(repo.created_at);

const assets = {};
let downloads = 0;
for (const rel of releases) {
  for (const a of rel.assets) {
    assets[a.name] = a.download_count;
    downloads += a.download_count;
  }
}
const byBrowser = { chrome: 0, firefox: 0, other: 0 };
for (const [name, count] of Object.entries(assets)) {
  if (name.includes('chrome')) byBrowser.chrome += count;
  else if (name.includes('firefox')) byBrowser.firefox += count;
  else byBrowser.other += count;
}

// ---- merge into the history file ----
let history = { repo: REPO, days: {}, traffic: { views: {}, clones: {} }, referrers: {} };
if (fs.existsSync(historyFile)) {
  const old = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  history = { ...history, ...old, traffic: { views: {}, clones: {}, ...old.traffic } };
}

const earlier = Object.keys(history.days).filter((d) => d < today).sort();
const last = earlier.length ? earlier[earlier.length - 1] : null;

history.days[today] = {
  at: now,
  downloads,
  assets,
  stars: repo.stargazers_count,
  forks: repo.forks_count,
  watchers: repo.subscribers_count,
};

// Each day GitHub still remembers replaces our copy of that day (today is still
// growing). Days it has already dropped stay as we saved them.
function mergeTraffic(kind, fresh) {
  if (!fresh) return;
  for (const row of fresh[kind]) {
    const d = day(row.timestamp);
    if (d < born) continue; // GitHub pads the window with days before the repo existed
    history.traffic[kind][d] = { count: row.count, uniques: row.uniques };
  }
}
mergeTraffic('views', views);
mergeTraffic('clones', clones);
if (referrers) {
  history.referrers[today] = referrers.map((r) => ({ from: r.referrer, count: r.count, uniques: r.uniques }));
}

fs.mkdirSync(path.dirname(historyFile), { recursive: true });
const tmp = historyFile + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(history, null, 2) + '\n');
fs.renameSync(tmp, historyFile);

// ---- print ----
const sum = (kind) => Object.values(history.traffic[kind]).reduce((t, r) => t + r.count, 0);
const trafficDays = Object.keys(history.traffic.views).sort();
const change = (now, before) => {
  const diff = now - before;
  return diff === 0 ? 'no change' : (diff > 0 ? '+' : '') + n(diff);
};

console.log(`Thinstream on GitHub, ${today} (UTC)`);
console.log('');
console.log(`Downloads   ${n(downloads)} in total (Chrome zip ${n(byBrowser.chrome)}, Firefox zip ${n(byBrowser.firefox)})`);
for (const rel of releases) {
  const parts = rel.assets.map((a) => `${a.name.replace(/^thinstream-/, '').replace(/-[\d.]+\.zip$/, '')} ${n(a.download_count)}`);
  console.log(`  ${rel.tag_name.padEnd(8)} ${parts.join(', ') || 'no files'}`);
}
console.log(`Stars       ${n(repo.stargazers_count)}`);
console.log(`Forks       ${n(repo.forks_count)}`);
console.log(`Watchers    ${n(repo.subscribers_count)}`);
console.log('');
if (views && clones) {
  console.log(`Repo page views   ${n(views.count)} in the last 14 days, ${n(views.uniques)} different visitors`);
  console.log(`Repo clones       ${n(clones.count)} in the last 14 days, ${n(clones.uniques)} different cloners`);
  if (trafficDays.length) {
    console.log(`Saved so far      ${n(sum('views'))} views and ${n(sum('clones'))} clones since ${trafficDays[0]} (${trafficDays.length} days kept)`);
  }
  if (referrers && referrers.length) {
    console.log('Where visitors came from (last 14 days):');
    for (const r of referrers) console.log(`  ${r.referrer.padEnd(24)} ${n(r.count)} views, ${n(r.uniques)} visitors`);
  } else {
    console.log('Where visitors came from: nothing recorded yet');
  }
  if (paths && paths.length) {
    console.log('Most viewed pages (last 14 days):');
    for (const p of paths.slice(0, 5)) console.log(`  ${p.path}  ${n(p.count)} views`);
  }
} else {
  console.log('Repo traffic: not available with this gh login (it needs push access to the repo).');
}
console.log('');
if (last) {
  const b = history.days[last];
  console.log(`Since ${last}: downloads ${change(downloads, b.downloads)}, stars ${change(repo.stargazers_count, b.stars)}, forks ${change(repo.forks_count, b.forks)}`);
} else {
  console.log('First saved day. The next run on a later day shows the change.');
}
console.log(`History: ${path.relative(root, historyFile)} (${Object.keys(history.days).length} day${Object.keys(history.days).length === 1 ? '' : 's'} saved, not in git)`);
console.log('');
console.log('What these mean: a download is one fetch of a zip from the release page.');
console.log('It is not a person and not an install. Bots and repeat downloads count too.');
