// Thinstream content script.
// Draws the listen mode panel and the player button, and keeps settings in sync.
// Everything stays in the browser. No network requests are made from here.
(() => {
  'use strict';

  const api = globalThis.browser ?? globalThis.chrome;
  const DEFAULTS = { on: false, hideExtras: false, fontSize: 20, lang: '', adNoise: true };
  const SVG = 'http://www.w3.org/2000/svg';
  // Phones and tablets in any browser (Safari, Chrome, Firefox): the video player takes
  // taps on top of it, so these get the panel as a sheet in the page instead.
  const MOBILE = location.hostname === 'm.youtube.com'
    || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches);

  let settings = { ...DEFAULTS };
  let video = { id: null, title: '', duration: 0, sizes: null };
  let lines = [];
  let status = 'idle';
  let tracks = [];
  let trackIndex = -1;
  let quality = 144;
  let activeIdx = -1;
  let lastUserScroll = 0;
  let lastTime = 0;
  let pendingBytes = 0;
  let pendingSeconds = 0;
  let pageReady = false;
  let boundVideo = null;
  let adOn = false;
  let adMuted = [];
  let noise = null;

  // ---------- tiny DOM helpers (no innerHTML, YouTube enforces Trusted Types) ----------

  function h(tag, props, ...children) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v);
    }
    for (const c of children) if (c) el.append(c);
    return el;
  }

  function icon(d, size) {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 24);
    s.setAttribute('height', size || 24);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2.4');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    s.append(p);
    return s;
  }

  // The Thinstream mark: a play triangle built from transcript lines.
  const MARK = 'M5.5 5h3M5.5 8.5h8M5.5 12h13M5.5 15.5h8M5.5 19h3';

  const fmtTime = (t) => {
    t = Math.max(0, Math.floor(t));
    const hrs = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = String(t % 60).padStart(2, '0');
    return hrs ? `${hrs}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  };

  const fmtBytes = (b) => {
    if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
    if (b >= 1e7) return Math.round(b / 1e6) + ' MB';
    return (b / 1e6).toFixed(1) + ' MB';
  };

  // ---------- UI ----------

  const ui = {};

  function build() {
    ui.button = h('button', {
      class: 'ytp-button thinstream-btn',
      title: 'Listen mode (Thinstream)',
      'aria-label': 'Listen mode',
      'aria-pressed': 'false',
      onclick: (e) => { e.stopPropagation(); save({ on: !settings.on }); },
    }, icon(MARK));

    ui.fab = h('button', {
      id: 'thinstream-fab',
      'aria-label': 'Listen mode',
      onclick: () => save({ on: !settings.on }),
    }, icon(MARK, 18), h('span', { text: 'Listen mode' }));

    ui.meta = h('span', { class: 'ts-meta' });
    ui.lang = h('select', {
      class: 'ts-lang',
      title: 'Transcript language',
      'aria-label': 'Transcript language',
      onchange: () => {
        const i = Number(ui.lang.value);
        if (!tracks[i]) return;
        trackIndex = i;
        send('track', { index: i });
        save({ lang: tracks[i].key });
      },
    });
    const tool = (label, title, fn, cls) => h('button', {
      class: 'ts-tool ' + (cls || ''), title, 'aria-label': title, text: label, onclick: fn,
    });
    ui.copy = tool('Copy', 'Copy the transcript', copyTranscript, 'ts-opt');
    ui.head = h('div', { class: 'ts-head' },
      h('div', { class: 'ts-brand' }, icon(MARK, 18), h('span', { text: 'Listen mode' })),
      ui.meta,
      h('div', { class: 'ts-tools' },
        ui.lang,
        tool('A-', 'Smaller text', () => save({ fontSize: Math.max(14, settings.fontSize - 2) }), 'ts-opt'),
        tool('A+', 'Larger text', () => save({ fontSize: Math.min(40, settings.fontSize + 2) }), 'ts-opt'),
        ui.copy,
        tool('Save', 'Download the transcript as a text file', downloadTranscript, 'ts-opt'),
        tool('Show video', 'Turn listen mode off', () => save({ on: false }), 'ts-primary'),
      ));

    ui.title = h('div', { class: 'ts-title', dir: 'auto' });
    ui.empty = h('div', { class: 'ts-empty' });
    ui.lines = h('div', { class: 'ts-lines' });
    ui.body = h('div', { class: 'ts-body' }, ui.title, ui.empty, ui.lines);
    ui.adLabel = h('div', { class: 'ts-ad-label', text: 'Ad break' });
    ui.adClock = h('div', { class: 'ts-ad-clock', role: 'timer', text: '' });
    ui.adNoise = h('button', {
      class: 'ts-tool',
      onclick: () => save({ adNoise: !settings.adNoise }),
    });
    ui.ad = h('div', { class: 'ts-ad' },
      ui.adLabel, ui.adClock,
      h('div', { class: 'ts-ad-note', text: 'The ad is muted. Your video continues when it ends.' }),
      ui.adNoise);
    ui.follow = h('button', {
      class: 'ts-follow',
      text: 'Back to now',
      onclick: () => { lastUserScroll = 0; scrollToActive(true); },
    });
    ui.panel = h('div', { id: 'thinstream-panel', role: 'region', 'aria-label': 'Thinstream listen mode' },
      ui.head, ui.ad, ui.body, ui.follow);

    // Keep clicks and keys inside the panel away from YouTube's player shortcuts.
    for (const type of ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup',
      'touchstart', 'touchend', 'wheel', 'contextmenu']) {
      ui.panel.addEventListener(type, (e) => e.stopPropagation());
    }
    ui.panel.addEventListener('keydown', (e) => {
      if (e.target === ui.lang) e.stopPropagation();
    });
    for (const type of ['wheel', 'touchmove', 'pointerdown']) {
      ui.body.addEventListener(type, () => { lastUserScroll = Date.now(); }, { passive: true });
    }
    ui.lines.addEventListener('click', (e) => {
      const row = e.target.closest('.ts-line');
      if (!row || !boundVideo) return;
      const line = lines[Number(row.dataset.i)];
      if (!line) return;
      lastUserScroll = 0;
      if (pageReady) {
        send('seek', { t: line.t });
      } else {
        boundVideo.currentTime = line.t;
        if (boundVideo.paused) boundVideo.play().catch(() => {});
      }
    });
  }

  function renderMeta() {
    let text = `${quality}p video, hidden`;
    const s = video.sizes;
    if (s) text += `. About ${fmtBytes(s.listen)} instead of ${fmtBytes(s.baseline)} at ${s.baseHeight}p`;
    ui.meta.textContent = text;
    ui.title.textContent = video.title || '';
  }

  function renderTracks() {
    ui.lang.replaceChildren(...tracks.map((t, i) => h('option', { value: String(i), text: t.name })));
    ui.lang.value = String(trackIndex);
    ui.lang.hidden = tracks.length === 0;
  }

  function renderLines() {
    activeIdx = -1;
    const messages = {
      idle: '',
      loading: 'Loading the transcript…',
      none: 'This video has no captions. The audio keeps playing.',
      failed: 'The transcript did not load. The audio keeps playing.',
      ok: '',
    };
    ui.empty.textContent = messages[status] || '';
    ui.empty.hidden = !ui.empty.textContent;
    if (status === 'failed' && trackIndex >= 0) {
      ui.empty.append(' ', h('button', {
        class: 'ts-tool', text: 'Try again', onclick: () => send('track', { index: trackIndex }),
      }));
    }
    const frag = document.createDocumentFragment();
    lines.forEach((line, i) => {
      frag.append(h('button', { class: 'ts-line', 'data-i': String(i) },
        h('span', { class: 'ts-time', text: fmtTime(line.t) }),
        h('span', { class: 'ts-text', dir: 'auto', text: line.s })));
    });
    ui.lines.replaceChildren(frag);
    ui.body.scrollTop = 0;
    const off = lines.length === 0;
    for (const el of ui.head.querySelectorAll('.ts-opt')) el.disabled = off && !/^A/.test(el.textContent);
    onTime();
  }

  function findIndex(t) {
    let lo = 0;
    let hi = lines.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= t + 0.15) { ans = mid; lo = mid + 1; } else hi = mid - 1;
    }
    return ans;
  }

  function scrollToActive(force) {
    const row = ui.lines.children[activeIdx];
    if (!row) return;
    const recent = Date.now() - lastUserScroll < 5000;
    if (recent && !force) {
      ui.follow.classList.add('ts-show');
      return;
    }
    ui.follow.classList.remove('ts-show');
    const top = row.offsetTop - ui.body.clientHeight * 0.35;
    ui.body.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function onTime() {
    if (!boundVideo) return;
    const t = boundVideo.currentTime;
    const player = document.getElementById('movie_player');
    const inAd = !!(player && player.classList.contains('ad-showing'));
    const dt = t - lastTime;
    lastTime = t;
    checkAd();
    if (!settings.on || inAd) return;
    if (dt > 0 && dt < 2 && !boundVideo.paused) {
      pendingSeconds += dt;
      const s = video.sizes;
      if (s && video.duration > 0) pendingBytes += ((s.baseline - s.listen) / video.duration) * dt;
    }
    if (!lines.length) return;
    const i = findIndex(t);
    if (i === activeIdx) return;
    const old = ui.lines.children[activeIdx];
    if (old) old.classList.remove('ts-now');
    activeIdx = i;
    const row = ui.lines.children[i];
    if (row) row.classList.add('ts-now');
    scrollToActive(false);
  }

  // ---------- ads ----------
  // While an ad plays in listen mode: mute it, show a countdown instead of the
  // transcript, and play quiet jazz so the silence does not feel like a stall.
  // The music is made in the browser, nothing is downloaded.
  // YouTube's own Skip button stays on top of the panel. It ignores scripted clicks
  // (tested 2026-11-13), so skipping is left to the listener.

  // A slow jazz loop (ii V I VI: electric piano chords, walking bass, brushed ride)
  // over a little hiss. Every note is made here with Web Audio.
  const JAZZ = [
    { chord: [53, 57, 60, 64], bass: [38, 41, 45, 44] }, // Dm9
    { chord: [53, 59, 64, 69], bass: [43, 47, 50, 49] }, // G13
    { chord: [52, 59, 62, 67], bass: [36, 40, 43, 46] }, // Cmaj9
    { chord: [55, 61, 65, 70], bass: [45, 43, 41, 40] }, // A7
  ];
  const BEAT = 60 / 84;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function tone(n, type, freq, at, peak, len) {
    const osc = n.ctx.createOscillator();
    const g = n.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(g).connect(n.warm);
    osc.start(at);
    osc.stop(at + len + 0.05);
  }

  function brush(n, at, peak) {
    const src = n.ctx.createBufferSource();
    const g = n.ctx.createGain();
    src.buffer = n.hiss;
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    src.connect(g).connect(n.bright);
    src.start(at, Math.random());
    src.stop(at + 0.25);
  }

  function chord(n, notes, at, peak) {
    notes.forEach((m, i) => {
      const t = at + i * 0.012;
      tone(n, 'sine', hz(m), t, peak, 2.2);
      tone(n, 'sine', hz(m) * 2, t, peak * 0.18, 0.9);
    });
  }

  // Schedules notes a little ahead of the clock, so a throttled background tab keeps time.
  function playAhead() {
    const n = noise;
    if (!n) return;
    while (n.next < n.ctx.currentTime + 2.2) {
      const bar = JAZZ[Math.floor(n.step / 4) % JAZZ.length];
      const beat = n.step % 4;
      const at = n.next;
      const swing = at + BEAT * 2 / 3;
      const soft = 0.85 + Math.random() * 0.3;
      tone(n, 'triangle', hz(bar.bass[beat]), at, 0.16 * soft, BEAT * 1.1);
      brush(n, at, 0.05 * soft);
      if (beat === 1 || beat === 3) brush(n, swing, 0.03 * soft);
      if (beat === 0) chord(n, bar.chord, at, 0.045);
      if (beat === 1) chord(n, bar.chord, swing, 0.03);
      n.next += BEAT;
      n.step++;
    }
  }

  function startNoise() {
    if (noise) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      const ctx = new Ctx();
      const hiss = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = hiss.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 0.6);
      gain.connect(ctx.destination);
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 1800;
      warm.connect(gain);
      const bright = ctx.createBiquadFilter();
      bright.type = 'highpass';
      bright.frequency.value = 5000;
      bright.connect(gain);
      const bed = ctx.createBufferSource();
      bed.buffer = hiss;
      bed.loop = true;
      const bedGain = ctx.createGain();
      bedGain.gain.value = 0.006;
      bed.connect(bedGain).connect(warm);
      bed.start();
      noise = { ctx, gain, warm, bright, hiss, next: ctx.currentTime + 0.15, step: 0, timer: 0 };
      noise.timer = setInterval(playAhead, 400);
      playAhead();
    } catch (_) { noise = null; }
  }

  function stopNoise() {
    if (!noise) return;
    const { ctx, gain, timer } = noise;
    noise = null;
    clearInterval(timer);
    try {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    } catch (_) {}
    setTimeout(() => { ctx.close().catch(() => {}); }, 350);
  }

  function muteAd() {
    const v = boundVideo;
    if (!v || v.muted) return;
    v.muted = true;
    if (!adMuted.includes(v)) adMuted.push(v);
  }

  function renderAd() {
    const v = boundVideo;
    const left = v && isFinite(v.duration) && v.duration > 0 ? v.duration - v.currentTime : NaN;
    ui.adClock.textContent = isFinite(left) ? fmtTime(Math.ceil(left)) : '';
    // "1 of 2" when YouTube shows several ads in a row. The countdown is for the current one.
    const pod = document.querySelector('#movie_player .video-ads [class*="pod-index"]');
    const m = pod && /(\d+)\D+(\d+)/.exec(pod.textContent || '');
    ui.adLabel.textContent = m ? `Ad ${m[1]} of ${m[2]} ends in` : 'Ad ends in';
    ui.adNoise.textContent = settings.adNoise ? 'Jazz: on' : 'Jazz: off';
    ui.adNoise.setAttribute('aria-pressed', String(settings.adNoise));
  }

  function checkAd() {
    const player = document.getElementById('movie_player');
    const inAd = !!(settings.on && player && player.classList.contains('ad-showing'));
    if (inAd !== adOn) {
      adOn = inAd;
      document.documentElement.classList.toggle('thinstream-ad', inAd);
      if (!inAd) {
        // Only unmute what we muted. If the sound was already off, it stays off.
        for (const v of adMuted) v.muted = false;
        adMuted = [];
        stopNoise();
        lastUserScroll = 0;
        scrollToActive(true);
      }
    }
    if (!adOn) return;
    muteAd();
    if (settings.adNoise) {
      startNoise();
      // Browsers hold audio back until the page has had a click or a key press.
      if (noise && noise.ctx.state === 'suspended') noise.ctx.resume().catch(() => {});
    } else {
      stopNoise();
    }
    renderAd();
  }

  function transcriptText(withTimes) {
    return lines.map((l) => (withTimes ? `[${fmtTime(l.t)}] ${l.s}` : l.s)).join('\n');
  }

  function copyTranscript() {
    if (!lines.length) return;
    navigator.clipboard.writeText(transcriptText(false)).then(() => {
      ui.copy.textContent = 'Copied';
      setTimeout(() => { ui.copy.textContent = 'Copy'; }, 1500);
    }).catch(() => {});
  }

  function downloadTranscript() {
    if (!lines.length) return;
    const name = (video.title || 'transcript').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'transcript';
    const head = `${video.title}\nhttps://www.youtube.com/watch?v=${video.id}\n\n`;
    const url = URL.createObjectURL(new Blob([head + transcriptText(true) + '\n'], { type: 'text/plain' }));
    const a = h('a', { href: url, download: name + '.txt' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ---------- page script bridge ----------

  const send = (type, data) => window.postMessage({ thinstream: 'content', type, data }, location.origin);

  const pageLoaded = () => document.documentElement.hasAttribute('data-thinstream-page');
  let pageWaiters = null;

  // page.js must run in YouTube's own JavaScript world. Chrome does that from the manifest.
  // Safari does not, so ask the background worker, and as a last resort add a script tag.
  function ensurePage(then) {
    if (pageReady || pageLoaded()) {
      pageReady = true;
      then();
      return;
    }
    if (pageWaiters) { pageWaiters.push(then); return; }
    pageWaiters = [then];
    const done = () => {
      pageReady = true;
      const list = pageWaiters || [];
      pageWaiters = null;
      list.forEach((fn) => fn());
    };
    const viaTag = () => {
      try {
        const s = document.createElement('script');
        s.src = api.runtime.getURL('src/page.js');
        s.onload = () => { s.remove(); done(); };
        s.onerror = () => { s.remove(); pageWaiters = null; };
        (document.head || document.documentElement).append(s);
      } catch (_) { pageWaiters = null; }
    };
    Promise.resolve()
      .then(() => api.runtime.sendMessage({ type: 'thinstream-inject' }))
      .then((res) => { if (res && res.ok && pageLoaded()) done(); else viaTag(); })
      .catch(viaTag);
  }

  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.thinstream !== 'page') return;
    const { type, data } = e.data;
    if (type === 'video') {
      video = { id: data.videoId, title: data.title, duration: data.duration, sizes: data.sizes };
      lines = [];
      status = 'loading';
      tracks = [];
      trackIndex = -1;
      renderMeta();
      renderTracks();
      renderLines();
    } else if (type === 'tracks') {
      if (data.videoId !== video.id) return;
      tracks = data.tracks;
      trackIndex = data.index;
      renderTracks();
    } else if (type === 'transcript') {
      if (data.videoId !== video.id) return;
      status = data.status;
      lines = data.lines || [];
      renderLines();
    } else if (type === 'quality') {
      quality = data.height;
      renderMeta();
    }
  });

  // ---------- settings ----------

  function save(patch) {
    settings = { ...settings, ...patch };
    apply();
    api.storage.local.set(patch);
  }

  function apply() {
    const root = document.documentElement;
    root.classList.toggle('thinstream-on', settings.on);
    root.classList.toggle('thinstream-hide-extras', settings.on && settings.hideExtras);
    root.classList.toggle('thinstream-mobile', MOBILE);
    root.style.setProperty('--thinstream-font', settings.fontSize + 'px');
    ui.button.setAttribute('aria-pressed', String(settings.on));
    ui.button.title = settings.on ? 'Show video (Thinstream)' : 'Listen mode (Thinstream)';
    ui.fab.classList.toggle('ts-active', settings.on);
    if (settings.on || pageReady) ensurePage(() => send('set', { on: settings.on, lang: settings.lang }));
    mount();
    checkAd();
  }

  function mount() {
    const root = document.documentElement;
    root.classList.toggle('thinstream-watch', location.pathname === '/watch');
    const player = document.getElementById('movie_player');
    if (!player) return;
    const controls = player.querySelector('.ytp-right-controls-left') || player.querySelector('.ytp-right-controls');
    if (controls && ui.button.parentNode !== controls) controls.prepend(ui.button);
    if (MOBILE && !ui.fab.isConnected && document.body) document.body.append(ui.fab);
    // On phones the video player swallows taps (Safari shows its own player options),
    // so the panel sits in the page below the player instead of on top of it.
    const host = MOBILE ? document.body : player;
    if (settings.on && host && ui.panel.parentNode !== host) host.append(ui.panel);
    const v = player.querySelector('video');
    if (v && v !== boundVideo) {
      if (boundVideo) boundVideo.removeEventListener('timeupdate', onTime);
      boundVideo = v;
      lastTime = v.currentTime;
      v.addEventListener('timeupdate', onTime);
    }
  }

  function flushStats() {
    if (pendingSeconds < 1) return;
    const bytes = pendingBytes;
    const seconds = pendingSeconds;
    pendingBytes = 0;
    pendingSeconds = 0;
    api.storage.local.get({ savedBytes: 0, listenSeconds: 0 }).then((v) => api.storage.local.set({
      savedBytes: Math.round(v.savedBytes + bytes),
      listenSeconds: Math.round(v.listenSeconds + seconds),
    })).catch(() => {});
  }

  // ---------- start ----------

  build();
  api.storage.local.get(DEFAULTS).then((s) => {
    settings = { ...DEFAULTS, ...s };
    apply();
  });
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let changed = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (changes[key] && changes[key].newValue !== settings[key]) {
        settings[key] = changes[key].newValue ?? DEFAULTS[key];
        changed = true;
      }
    }
    if (changed) apply();
  });
  setInterval(mount, 1000);
  setInterval(checkAd, 500);
  setInterval(flushStats, 15000);
  document.addEventListener('yt-navigate-finish', mount);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushStats(); });
  window.addEventListener('pagehide', flushStats);
})();
