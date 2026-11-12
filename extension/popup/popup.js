// Thinstream popup. Reads and writes settings in local browser storage only.
const api = globalThis.browser ?? globalThis.chrome;
const DEFAULTS = { on: false, hideExtras: false, savedBytes: 0, listenSeconds: 0 };

const $ = (id) => document.getElementById(id);

function fmtBytes(b) {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  return Math.round(b / 1e6) + ' MB';
}

function fmtDuration(s) {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min`;
}

function render(s) {
  $('on').checked = !!s.on;
  $('hideExtras').checked = !!s.hideExtras;
  $('stats').textContent = s.listenSeconds >= 60
    ? `${fmtDuration(s.listenSeconds)} listened. About ${fmtBytes(s.savedBytes)} saved (estimate).`
    : '';
}

async function load() {
  render(await api.storage.local.get(DEFAULTS));
}

for (const key of ['on', 'hideExtras']) {
  $(key).addEventListener('change', (e) => api.storage.local.set({ [key]: e.target.checked }));
}
api.storage.onChanged.addListener(load);
$('version').textContent = api.runtime.getManifest().version;
load();
