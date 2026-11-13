# Thinstream handover

Read this first. Update the open items when something finishes.

## What it is

Browser extension for Chrome, Firefox and Safari. On YouTube it holds the video at 144p, hides it, and shows a synced transcript in the player. For slow or metered internet. Repo: github.com/alireza12t/thinstream. Site: alireza12t.github.io/thinstream (GitHub Pages from `docs/`).

## State

- 1.0.0 built and published on 2026-11-12: public repo, GitHub Pages site and release `v1.0.0` with the Chrome zip are live.
- License: PolyForm Noncommercial 1.0.0. Alireza asked for "anyone can use it, nobody can earn money from it".
- Name check: no extension called Thinstream turned up in a web search on 2026-11-12. A fuzzy App Store check has not been done.

## Decisions and why

- **Not true audio only.** Tested on 2026-11-12: the web player uses one combined stream (`serverAbrStreamingUrl`), and formats have no `url`. So the old trick of swapping in the audio URL has nothing to grab. We use `setPlaybackQualityRange` on the player instead. That call also writes `yt-player-quality` in YouTube's localStorage, so the next video starts at 144p.
- **Transcript comes from the player's own caption request.** Fetching the caption `baseUrl` directly returns an empty body (it needs a token only the player has). `page.js` turns the track on, watches `/api/timedtext` and reads the response. Fallback: reuse a signed URL from the performance entries and swap `lang`.
- **Safari does not support `"world": "MAIN"` in the manifest** (the converter warns). So `content.js` asks `background.js` to inject `page.js` with `scripting.executeScript`, and falls back to a script tag. `page.js` exits if it finds itself in the extension world.
- **No innerHTML anywhere.** YouTube enforces Trusted Types.
- **Safari project references `../../../extension`**, nothing is copied. New files under `extension/src` are picked up. The project file is the new `project.xcproj` JSON format.
- **Firefox is the same code with a patched manifest**, made by `scripts/build.sh` into `dist/firefox/` and a zip: `background.scripts` instead of a service worker, plus a gecko id (`thinstream@alireza12t.github.io`), min version 140 and `data_collection_permissions: none`. Firefox supports `"world": "MAIN"`, so it takes the Chrome path. Version stayed 1.0.0 (Alireza did not ask for a bump); the Firefox zip was added to the v1.0.0 release.
- **Caption requests are watched from page load**, not from the moment listen mode turns on. If captions were already on, the player had fetched the track before the patch existed and would not ask again, and the performance entry fallback fails when YouTube's resource timing buffer is full (seen on a long film). Found on 2026-11-12 while recording the demo.
- **Click to jump goes through `player.seekTo`** (message `seek` from `content.js` to `page.js`), not `video.currentTime`.
- **Quality labels come from `qualityLabel`**, not `height`. Wide films have heights like 546 for 720p.
- The data estimate uses the byte sizes in the player response for that video. Baseline is the quality the player was on, else 720p.

## What was tested

- Headless Chrome for Testing with the unpacked extension (`puppeteer-core`): button mount, 144p, panel, restore of quality and captions, popup, and a copy of the extension without the `world` key to exercise the Safari path. All passed.
- Headless Chrome gets an empty caption response from YouTube (bot check), so the transcript was tested by running the same `page.js` and `content.js` on live YouTube in the Claude browser pane: transcript load, language switch, click to seek, video change, turn off. All passed.
- Firefox 160 (test binary from `@puppeteer/browsers`, driven with `puppeteer-core`): add-on installs, button, 144p, hide, restore, transcript rendering, click to seek, text size all passed. `web-ext lint`: 0 errors. Popup not opened in Firefox. To launch Firefox from a sandboxed shell set `CFFIXED_USER_HOME` and `HOME` to a scratch folder, otherwise it dies with "Could not find profile folder".
- Demo footage: `demo/record.mjs` records the real extension in Chrome for Testing (`page.screencast`), replaying the caption file from `demo/captions-tears-of-steel.json` (lines YouTube served for that CC BY film in a normal browser). Limits of a test browser on YouTube, learned the hard way: it only gets about the first 50 seconds of a video, any seek ends in "Something went wrong", and captions come back empty. So each clip starts from a fresh page load and click to jump is not recorded.
- Safari: `Thinstream (macOS)` and `Thinstream (iOS)` compile with `CODE_SIGNING_ALLOWED=NO`. **Not run inside Safari.**
- m.youtube.com in mobile emulation: 144p, panel and the floating button work. The caption response came back empty in emulation, so the transcript on a real phone is unknown.

## Open items

- [ ] Run it in Safari on the Mac once (Xcode, Run, enable in Safari settings) and confirm the transcript loads.
- [ ] Try the iOS build on a real iPhone. The panel is cramped at phone size, it probably wants to sit below the player.
- [ ] Firefox: submit to addons.mozilla.org for signing so it installs for good. It is free but needs Alireza's Mozilla account. Until then it loads as a temporary add-on.
- [ ] Cut 1.0.1 with the three fixes listed under Unreleased in CHANGELOG.md. Needs Alireza's yes (version change).
- [ ] Chrome Web Store listing. Needs the one time $5 developer fee, so it is Alireza's call.
- [ ] Upload `assets/social-preview.png` in the GitHub repo settings (Social preview). There is no API for it.
- [ ] Demo video (separate session).
- [ ] Translated captions (YouTube's auto translate) are ignored for now.

## Handy

- `./scripts/build.sh` makes the Chrome zip, the Firefox zip and `dist/firefox/`.
- `./scripts/publish.sh` creates the repo, topics, Pages and the release. Safe to run again.
- `node scripts/dev-server.mjs` serves the repo on localhost:8767 (also the `thinstream` entry in the parent folder's `.claude/launch.json`).
