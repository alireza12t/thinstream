// Thinstream page script.
// Runs in YouTube's own JavaScript world so it can talk to the player.
// It never sends data anywhere. It only talks to content.js through window.postMessage.
(() => {
  'use strict';

  // A browser that ignores "world": "MAIN" would load this file in the extension world.
  // In that case do nothing. content.js injects it into the page instead.
  if (globalThis.chrome?.runtime?.id || globalThis.browser?.runtime?.id) return;
  if (window.__thinstreamPage) return;
  window.__thinstreamPage = true;
  if (document.documentElement) document.documentElement.setAttribute('data-thinstream-page', '1');

  const HEIGHTS = {
    tiny: 144, small: 240, medium: 360, large: 480, hd720: 720,
    hd1080: 1080, hd1440: 1440, hd2160: 2160, hd2880: 2880, highres: 4320,
  };
  const LS_PREV = 'thinstream:prev-quality';
  const LS_CC = 'thinstream:prev-captions';
  const YT_QUALITY = 'yt-player-quality';

  const state = {
    on: false,
    lang: '',
    videoId: null,
    tracks: [],
    wanted: null,
    captionsWereOn: null,
    timer: null,
    lastForce: 0,
    lastQuality: null,
    patched: false,
    fetch: window.fetch.bind(window),
    cache: new Map(),
    urls: new Map(),
  };

  const post = (type, data) => window.postMessage({ thinstream: 'page', type, data }, location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.thinstream !== 'content') return;
    const { type, data } = e.data;
    if (type === 'set') set(data || {});
    else if (type === 'track') chooseTrack(data && data.index);
  });

  function player() {
    const el = document.getElementById('movie_player');
    return el && typeof el.getPlayerResponse === 'function' ? el : null;
  }

  function set({ on, lang }) {
    state.lang = lang || '';
    on = !!on;
    if (on === state.on) return;
    state.on = on;
    clearInterval(state.timer);
    if (on) {
      patchNetwork();
      state.videoId = null;
      state.lastQuality = null;
      state.timer = setInterval(tick, 1000);
      tick();
    } else {
      restore();
    }
  }

  function tick() {
    if (!state.on) return;
    const p = player();
    if (!p) return;
    let pr = null;
    try { pr = p.getPlayerResponse(); } catch (_) {}
    const id = pr && pr.videoDetails && pr.videoDetails.videoId;
    if (!id) return;
    if (id !== state.videoId) {
      state.videoId = id;
      startVideo(p, pr, id);
    }
    forceQuality(p);
  }

  // ---------- quality ----------

  function savedQualityHeight() {
    try {
      const raw = localStorage.getItem(LS_PREV);
      if (!raw || raw === 'auto') return 0;
      return JSON.parse(JSON.parse(raw).data).quality || 0;
    } catch (_) { return 0; }
  }

  function rememberUserQuality() {
    try {
      if (localStorage.getItem(LS_PREV) === null) {
        localStorage.setItem(LS_PREV, localStorage.getItem(YT_QUALITY) || 'auto');
      }
    } catch (_) {}
  }

  function forceQuality(p) {
    const now = Date.now();
    let levels = [];
    try { levels = p.getAvailableQualityLevels() || []; } catch (_) {}
    const lowest = levels.filter((l) => HEIGHTS[l]).sort((a, b) => HEIGHTS[a] - HEIGHTS[b])[0];
    if (!lowest) return;
    let current = '';
    try { current = p.getPlaybackQuality(); } catch (_) {}
    if (current !== lowest && now - state.lastForce > 3000) {
      state.lastForce = now;
      try {
        if (typeof p.setPlaybackQualityRange === 'function') p.setPlaybackQualityRange(lowest, lowest);
        else p.setPlaybackQuality(lowest);
      } catch (_) {}
    }
    if (state.lastQuality !== lowest) {
      state.lastQuality = lowest;
      post('quality', { height: HEIGHTS[lowest] });
    }
  }

  function restore() {
    const p = player();
    let label = 'auto';
    try {
      const h = savedQualityHeight();
      localStorage.removeItem(LS_PREV);
      if (h) label = Object.keys(HEIGHTS).find((k) => HEIGHTS[k] === h) || 'auto';
    } catch (_) {}
    if (p) {
      try {
        if (typeof p.setPlaybackQualityRange === 'function') p.setPlaybackQualityRange(label, label);
        else p.setPlaybackQuality(label);
      } catch (_) {}
      if (state.captionsWereOn === false) {
        try { p.setOption('captions', 'track', {}); } catch (_) {}
      }
    }
    try { localStorage.removeItem(LS_CC); } catch (_) {}
    state.videoId = null;
    state.wanted = null;
    state.captionsWereOn = null;
    state.lastQuality = null;
  }

  // ---------- per video ----------

  function startVideo(p, pr, id) {
    let before = 0;
    try { before = HEIGHTS[p.getPlaybackQuality()] || 0; } catch (_) {}
    const prevSaved = savedQualityHeight();
    rememberUserQuality();
    const details = pr.videoDetails || {};
    const baselineHint = before > 144 ? before : (prevSaved > 144 ? prevSaved : 720);
    post('video', {
      videoId: id,
      title: details.title || '',
      duration: Number(details.lengthSeconds) || 0,
      live: !!details.isLiveContent && !Number(details.lengthSeconds),
      sizes: estimateSizes(pr, baselineHint),
    });
    loadCaptions(p, pr, id);
  }

  // Rough size of this video in listen mode and at a normal quality.
  // Uses the byte sizes YouTube lists for each format of this exact video.
  function estimateSizes(pr, baselineHint) {
    const formats = (pr.streamingData && pr.streamingData.adaptiveFormats) || [];
    const duration = Number(pr.videoDetails && pr.videoDetails.lengthSeconds) || 0;
    const size = (f) => {
      const exact = Number(f.contentLength);
      if (exact) return exact;
      const rate = f.averageBitrate || f.bitrate;
      return rate && duration ? (rate / 8) * duration : 0;
    };
    const avg = (list) => {
      const sizes = list.map(size).filter(Boolean);
      return sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
    };
    const audio = formats.filter((f) => /^audio\//.test(f.mimeType || ''));
    const video = formats.filter((f) => /^video\//.test(f.mimeType || '') && f.height);
    if (!audio.length || !video.length) return null;
    const medium = audio.filter((f) => f.audioQuality === 'AUDIO_QUALITY_MEDIUM');
    const audioBytes = avg(medium.length ? medium : audio);
    const heights = [...new Set(video.map((f) => f.height))].sort((a, b) => a - b);
    const low = heights[0];
    const base = heights.filter((h) => h <= baselineHint).pop() || low;
    if (base <= low) return null;
    const lowBytes = avg(video.filter((f) => f.height === low));
    const baseBytes = avg(video.filter((f) => f.height === base));
    if (!audioBytes || !lowBytes || !baseBytes) return null;
    return {
      listen: Math.round(audioBytes + lowBytes),
      baseline: Math.round(audioBytes + baseBytes),
      lowHeight: low,
      baseHeight: base,
    };
  }

  // ---------- transcript ----------

  const trackKey = (t) => `${t.languageCode || ''}|${t.kind || ''}|${t.name || ''}`;

  function urlKey(u) {
    return `${u.searchParams.get('lang') || ''}|${u.searchParams.get('kind') || ''}|${u.searchParams.get('name') || ''}`;
  }

  function captionsAreOn(p) {
    const btn = p.querySelector('.ytp-subtitles-button');
    if (btn && btn.hasAttribute('aria-pressed')) return btn.getAttribute('aria-pressed') === 'true';
    try { return !!(p.getOption('captions', 'track') || {}).languageCode; } catch (_) { return false; }
  }

  function loadCaptions(p, pr, id) {
    state.tracks = [];
    state.wanted = null;
    const listed = pr.captions && pr.captions.playerCaptionsTracklistRenderer
      && pr.captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!listed || !listed.length) {
      post('tracks', { videoId: id, tracks: [], index: -1 });
      post('transcript', { videoId: id, status: 'none' });
      return;
    }
    if (state.captionsWereOn === null) {
      // Remember whether captions were on before listen mode touched them,
      // so turning listen mode off puts them back the way they were.
      let saved = null;
      try { saved = localStorage.getItem(LS_CC); } catch (_) {}
      if (saved === null) {
        saved = captionsAreOn(p) ? '1' : '0';
        try { localStorage.setItem(LS_CC, saved); } catch (_) {}
      }
      state.captionsWereOn = saved === '1';
    }
    try { p.loadModule('captions'); } catch (_) {}
    let tries = 0;
    post('transcript', { videoId: id, status: 'loading' });
    const wait = () => {
      if (!state.on || state.videoId !== id) return;
      let list = [];
      try { list = p.getOption('captions', 'tracklist') || []; } catch (_) {}
      if (list.length) {
        state.tracks = list;
        let current = {};
        try { current = p.getOption('captions', 'track') || {}; } catch (_) {}
        selectTrack(p, id, pickTrack(list, current));
      } else if (++tries < 20) {
        setTimeout(wait, 500);
      } else {
        post('transcript', { videoId: id, status: 'failed' });
      }
    };
    wait();
  }

  function pickTrack(list, current) {
    const find = (fn) => list.findIndex(fn);
    let i = -1;
    if (state.lang) {
      i = find((t) => trackKey(t) === state.lang);
      if (i < 0) i = find((t) => t.languageCode === state.lang.split('|')[0]);
    }
    if (i < 0 && current.languageCode) i = find((t) => trackKey(t) === trackKey(current));
    if (i < 0) {
      const mine = (navigator.language || 'en').split('-')[0];
      i = find((t) => t.kind !== 'asr' && (t.languageCode || '').split('-')[0] === mine);
      if (i < 0) i = find((t) => (t.languageCode || '').split('-')[0] === mine);
    }
    if (i < 0) i = find((t) => t.kind !== 'asr');
    return i < 0 ? 0 : i;
  }

  function chooseTrack(index) {
    const p = player();
    if (!p || !state.on || !state.videoId || !state.tracks[index]) return;
    selectTrack(p, state.videoId, index);
  }

  function selectTrack(p, id, index) {
    const track = state.tracks[index];
    const key = trackKey(track);
    state.wanted = { id, key };
    post('tracks', {
      videoId: id,
      index,
      tracks: state.tracks.map((t) => ({
        key: trackKey(t),
        name: t.displayName || t.languageName || t.languageCode || '?',
      })),
    });
    const cacheKey = `${id}|${key}`;
    if (state.cache.has(cacheKey)) {
      post('transcript', { videoId: id, status: 'ok', lines: state.cache.get(cacheKey) });
      try { p.setOption('captions', 'track', track); } catch (_) {}
      return;
    }
    post('transcript', { videoId: id, status: 'loading' });
    const pending = () => state.on && state.wanted && state.wanted.id === id
      && state.wanted.key === key && !state.cache.has(cacheKey);

    // 1. Ask the player for the track. Its own request is caught by patchNetwork().
    try { p.setOption('captions', 'track', track); } catch (_) {}
    // 2. If the player already had it, reuse the request it made earlier.
    setTimeout(() => { if (pending()) fetchFromHistory(id, track); }, 1500);
    // 3. Still nothing: switch captions off and on so the player asks again.
    setTimeout(() => {
      if (!pending()) return;
      try {
        p.setOption('captions', 'track', {});
        setTimeout(() => { try { p.setOption('captions', 'track', track); } catch (_) {} }, 400);
      } catch (_) {}
    }, 3500);
    setTimeout(() => { if (pending()) fetchFromHistory(id, track); }, 6000);
    setTimeout(() => { if (pending()) post('transcript', { videoId: id, status: 'failed' }); }, 9000);
  }

  function fetchFromHistory(id, track) {
    const key = trackKey(track);
    let entries = [];
    try {
      entries = performance.getEntriesByType('resource')
        .map((e) => e.name)
        .filter((n) => n.indexOf('/api/timedtext') !== -1 && n.indexOf('v=' + id) !== -1)
        .reverse();
    } catch (_) {}
    const known = state.urls.get(id);
    if (known) entries.unshift(known);
    const signed = [];
    for (const name of entries) {
      try {
        const u = new URL(name, location.href);
        if (u.searchParams.get('signature')) signed.push(u);
      } catch (_) {}
    }
    // Best: the exact request for this track. Otherwise any signed request for this video,
    // with the language swapped.
    const u = signed.find((x) => urlKey(x) === key && !x.searchParams.get('tlang')) || signed[0];
    if (!u) return;
    u.searchParams.set('lang', track.languageCode);
    if (track.kind) u.searchParams.set('kind', track.kind); else u.searchParams.delete('kind');
    if (track.name) u.searchParams.set('name', track.name); else u.searchParams.delete('name');
    u.searchParams.delete('tlang');
    u.searchParams.set('fmt', 'json3');
    const url = u.href;
    state.fetch(url, { credentials: 'include' })
      .then((r) => r.text())
      .then((text) => onTimedText(url, text))
      .catch(() => {});
  }

  function onTimedText(url, text) {
    let u;
    try { u = new URL(url, location.href); } catch (_) { return; }
    const id = u.searchParams.get('v');
    if (!id || u.searchParams.get('tlang')) return;
    const lines = parse(text, u.searchParams.get('kind') === 'asr');
    if (!lines) return;
    const key = urlKey(u);
    state.urls.set(id, u.href);
    state.cache.set(`${id}|${key}`, lines);
    while (state.cache.size > 12) state.cache.delete(state.cache.keys().next().value);
    while (state.urls.size > 12) state.urls.delete(state.urls.keys().next().value);
    if (state.on && state.wanted && state.wanted.id === id && state.wanted.key === key) {
      post('transcript', { videoId: id, status: 'ok', lines });
    }
  }

  function parse(text, auto) {
    let json;
    try { json = JSON.parse(text); } catch (_) { return null; }
    const raw = [];
    for (const ev of json.events || []) {
      if (!ev.segs) continue;
      const s = ev.segs.map((x) => x.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!s) continue;
      raw.push({ t: (ev.tStartMs || 0) / 1000, s });
    }
    if (!raw.length) return null;
    if (!auto) return raw;
    // Auto captions come as short fragments. Join them into readable lines.
    const out = [];
    let cur = null;
    for (const line of raw) {
      if (cur && cur.s.length < 90 && line.t - cur.last < 4) {
        cur.s += ' ' + line.s;
        cur.last = line.t;
      } else {
        cur = { t: line.t, s: line.s, last: line.t };
        out.push(cur);
      }
    }
    return out.map(({ t, s }) => ({ t, s }));
  }

  // Watch the player's own caption requests. Only /api/timedtext is looked at.
  function patchNetwork() {
    if (state.patched) return;
    state.patched = true;
    const originalFetch = window.fetch;
    state.fetch = originalFetch.bind(window);
    window.fetch = function (input) {
      const promise = originalFetch.apply(this, arguments);
      try {
        const url = typeof input === 'string' ? input : (input && input.url) || String(input);
        if (url.indexOf('/api/timedtext') !== -1) {
          promise.then((r) => r.clone().text()).then((t) => onTimedText(url, t)).catch(() => {});
        }
      } catch (_) {}
      return promise;
    };
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      try {
        const u = String(url);
        if (u.indexOf('/api/timedtext') !== -1) {
          this.addEventListener('load', () => {
            try {
              if (this.responseType === '' || this.responseType === 'text') onTimedText(u, this.responseText);
            } catch (_) {}
          });
        }
      } catch (_) {}
      return originalOpen.apply(this, arguments);
    };
  }

  post('ready', {});
})();
