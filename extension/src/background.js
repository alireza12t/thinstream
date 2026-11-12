// Thinstream background worker.
// Only job: load src/page.js into the YouTube page's own JavaScript world when the
// browser does not do it from the manifest (Safari). Chrome never needs this.
const api = globalThis.browser ?? globalThis.chrome;

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'thinstream-inject' || !sender.tab) return undefined;
  api.scripting.executeScript({
    target: { tabId: sender.tab.id },
    files: ['src/page.js'],
    world: 'MAIN',
  }).then(
    () => sendResponse({ ok: true }),
    (err) => sendResponse({ ok: false, error: String(err) }),
  );
  return true;
});
