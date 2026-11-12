# Thinstream handover

Read this first. Update the open items when something finishes.

## What it is

Browser extension for Chrome and Safari. On YouTube it holds the video at 144p, hides it, and shows a synced transcript in the player. For slow or metered internet. Repo: github.com/alireza12t/thinstream. Site: alireza12t.github.io/thinstream (GitHub Pages from `docs/`).

## State

- 1.0.0 built on 2026-11-12.
- License: PolyForm Noncommercial 1.0.0. Alireza asked for "anyone can use it, nobody can earn money from it".
- Name check: no extension called Thinstream turned up in a web search on 2026-11-12. A fuzzy App Store check has not been done.

## Decisions and why

- **Not true audio only.** Tested on 2026-11-12: the web player uses one combined stream (`serverAbrStreamingUrl`), and formats have no `url`. So the old trick of swapping in the audio URL has nothing to grab. We use `setPlaybackQualityRange` on the player instead. That call also writes `yt-player-quality` in YouTube's localStorage, so the next video starts at 144p.
- **Transcript comes from the player's own caption request.** Fetching the caption `baseUrl` directly returns an empty body (it needs a token only the player has). `page.js` turns the track on, watches `/api/timedtext` and reads the response. Fallback: reuse a signed URL from the performance entries and swap `lang`.
- **Safari does not support `"world": "MAIN"` in the manifest** (the converter warns). So `content.js` asks `background.js` to inject `page.js` with `scripting.executeScript`, and falls back to a script tag. `page.js` exits if it finds itself in the extension world.
- **No innerHTML anywhere.** YouTube enforces Trusted Types.
- **Safari project references `../../../extension`**, nothing is copied. New files under `extension/src` are picked up. The project file is the new `project.xcproj` JSON format.
- The data estimate uses the byte sizes in the player response for that video. Baseline is the quality the player was on, else 720p.

## What was tested

- Headless Chrome for Testing with the unpacked extension (`puppeteer-core`): button mount, 144p, panel, restore of quality and captions, popup, and a copy of the extension without the `world` key to exercise the Safari path. All passed.
- Headless Chrome gets an empty caption response from YouTube (bot check), so the transcript was tested by running the same `page.js` and `content.js` on live YouTube in the Claude browser pane: transcript load, language switch, click to seek, video change, turn off. All passed.
- Safari: `Thinstream (macOS)` and `Thinstream (iOS)` compile with `CODE_SIGNING_ALLOWED=NO`. **Not run inside Safari.**
- m.youtube.com in mobile emulation: 144p, panel and the floating button work. The caption response came back empty in emulation, so the transcript on a real phone is unknown.

## Open items

- [ ] Run it in Safari on the Mac once (Xcode, Run, enable in Safari settings) and confirm the transcript loads.
- [ ] Try the iOS build on a real iPhone. The panel is cramped at phone size, it probably wants to sit below the player.
- [ ] Chrome Web Store listing. Needs the one time $5 developer fee, so it is Alireza's call.
- [ ] Upload `assets/social-preview.png` in the GitHub repo settings (Social preview). There is no API for it.
- [ ] Demo video (separate session).
- [ ] Translated captions (YouTube's auto translate) are ignored for now.

## Handy

- `./scripts/build.sh` makes `dist/thinstream-chrome-<version>.zip`.
- `./scripts/publish.sh` creates the repo, topics, Pages and the release. Safe to run again.
- `node scripts/dev-server.mjs` serves the repo on localhost:8767 (also the `thinstream` entry in the parent folder's `.claude/launch.json`).
