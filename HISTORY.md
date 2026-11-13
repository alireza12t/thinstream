# Thinstream handover

Read this first. Update the open items when something finishes.

## What it is

Browser extension for Chrome, Firefox and Safari. On YouTube it holds the video at 144p, hides it, and shows a synced transcript in the player. For slow or metered internet. Repo: github.com/alireza12t/thinstream. Site: alireza12t.github.io/thinstream (GitHub Pages from `docs/`).

## State

- 1.0.0 built and published on 2026-11-12: public repo, GitHub Pages site and release `v1.0.0`.
- 1.0.1 published the same day with three fixes (see CHANGELOG.md). Alireza said "Yes, cut 1.0.1". Before the release the fixes were checked on live YouTube in the browser pane (transcript in 252 ms with captions already on, a jump from 0:09 to 2:11 with no player error), and the Chrome and Firefox tests were run again.
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

### After Alireza approves the videos (his instruction, 2026-11-12)

Do none of this before he says the videos are approved.

- [ ] Archive the sessions that are no longer needed (the video session and its hook review session).
- [ ] Clean up: working files in `video/` and `demo/footage/` go to the Trash, only what is needed stays.
- [ ] One folder on the Desktop with the final Instagram and YouTube material only: the short, the long video, both covers, titles and descriptions. Nothing else kept.
- [ ] Push everything to GitHub and make a release there. If the extension code has not changed since 1.0.1 there is nothing new to version, so ask him what the release should be before bumping.

### Signing the Safari apps (asked 2026-11-12)

- This Mac has Apple Development certificates and one Apple Distribution certificate. That covers the App Store and TestFlight for both iOS and macOS.
- There is no Developer ID Application certificate, so a notarized Mac app as a direct download on GitHub is not possible until he creates one.
- No App Store Connect API key files were found, so uploads go through Xcode's Organizer or he runs the upload.
- He said "Yes, App Store" on 2026-11-12. Done since: store category, the encryption answer and a copyright line in the project, the app's own screen now explains what it does, privacy page at `docs/privacy.html`, and the listing kit in `safari/APPSTORE.md` (name "Thinstream for YouTube", description, keywords, review notes).
- Signed archives of 1.0.1 built from the command line with automatic signing: `dist/appstore/Thinstream-mac-1.0.1.xcarchive` and `Thinstream-ios-1.0.1.xcarchive` (not in git). The App Store export failed from the command line ("No Accounts", no Mac distribution certificates), so the export and upload happen in Xcode's Organizer with him signed in.
- The development signed Mac app is at `dist/mac/Thinstream.app`. It was launched once, and `pluginkit` lists its extension, so Safari should show Thinstream under Settings, Extensions, waiting to be switched on.
- App Store Connect, done on 2026-11-12 after he signed in: both bundle ids registered (`com.alirezatoghiani.thinstream` and `.Extension`), app record "Thinstream for YouTube" created for iOS and macOS (Apple id 6834242807, SKU `thinstream`, English U.S.). Saved as drafts on both the iOS and macOS 1.0.1 version pages: promotional text, description, keywords, support and marketing URLs, copyright, review notes, sign-in not required, manual release. App information: subtitle, Utilities, Productivity. App Privacy: privacy policy URL saved and "Data Not Collected" chosen, but NOT published, because the stats session was still weighing an opt-in ping.
- Left empty on purpose, his to fill or confirm: the App Review contact name, phone and email, the age rating questions, content rights, pricing and availability, and the Publish button on App Privacy. Nothing was submitted for review.
- Still needed at the Mac: switch the extension on in Safari and try it, real screenshots from Safari, upload both archives from the Organizer, then TestFlight on a real iPhone before review.

### Numbers (asked 2026-11-12)

He asked for a way to see installs and use without intruding on privacy, then said: show the stats on the site for marketing, no dashboard, and hide them until the number is reasonable. The comparison and the reasons are in `STATS.md`.

- Done: `scripts/stats.mjs` prints the GitHub numbers and saves each day to `stats/history.json` (not in git). First reading 2026-11-13 UTC: 4 downloads, 0 stars, 0 repo views.
- Done: the site shows "N downloads from GitHub" under the buttons once N reaches 100 (`MIN_DOWNLOADS` in `docs/index.html`). Adding `#stats` to the site address shows it at any number.
- The extension was not touched. No analytics service was signed up for, and no ping was added. The privacy texts are unchanged.
- Done (he said "Yes, weekly" on 2026-11-12): a launchd job on his Mac runs `scripts/stats.mjs` every Monday at 10:15, so GitHub's 14 day traffic window loses no days. File: `~/Library/LaunchAgents/com.alireza12t.thinstream-stats.plist`, log: `~/Library/Logs/thinstream-stats.log`. Run once by hand through launchd, exit code 0. To remove it: `launchctl bootout gui/$(id -u)/com.alireza12t.thinstream-stats`, then move the plist to the Trash. If the Mac is off on a Monday that week is skipped, so a session working here should still run the script.
- The `thinstream` skill has a "Numbers" section with all of this.
- [ ] When the add-on is on addons.mozilla.org, look at switching the site line to its daily users number (public API, see `STATS.md`).

### SEO (2026-11-12)

Full audit, ranked gaps and his steps: `SEO-AUDIT-2026-11-12.md`. Done with the `seo` skill.

- Done: site FAQ markup and visible FAQ are now the same 12 questions word for word (before, 6 of 7 marked-up questions weren't on the page). Added `og:image:alt`, shorter title.
- Done: rechecked the "nothing else does all three" claim. Still true. YouTube Listen Mode (Chrome) and Transcript Mode for YouTube (Firefox) added to the README and site comparison.
- Done: App Store keyword line in `safari/APPSTORE.md` no longer repeats name or subtitle words (95 bytes).
- Done: store images in `assets/store/` (two 1280x800 screenshots, 440x280 and 1400x560 tiles) and an Edge section in `~/Desktop/Thinstream - Release Pack/FREE-LISTINGS.md`.
- Blind search (5 real-user questions, fresh subagent): Thinstream in 0 of 5. Every hit was a store page. Recheck 2026-11-22.
- [ ] Search Console: Request indexing for the home page once the push is live. Sitemap already submitted.
- [ ] Bing Webmaster Tools: import from Search Console.
- [ ] Edge Add-ons listing (free, text ready).
- [ ] App Store Connect: paste the new keyword line if the draft has the old one.
- [ ] Topic swap `listen-mode` for `web-extension`, waiting on his OK. Change `scripts/publish.sh` in the same commit.
- [ ] `scripts/amo-media.sh` still uploads the old 4:3 and square images; point it at `assets/store/`.

### Other


- [ ] Run it in Safari on the Mac once (Xcode, Run, enable in Safari settings) and confirm the transcript loads.
- [ ] Try the iOS build on a real iPhone. The panel is cramped at phone size, it probably wants to sit below the player.
- [ ] Firefox: submit to addons.mozilla.org for signing so it installs for good. It is free but needs Alireza's Mozilla account. Until then it loads as a temporary add-on.
- [ ] Chrome Web Store listing. Needs the one time $5 developer fee, so it is Alireza's call.
- [x] Upload `assets/social-preview.png` in the GitHub repo settings (Social preview). Live check 2026-11-12: the custom image is set.
- [ ] Demo videos, waiting for Alireza's approval (2026-11-12): `video/thinstream-short-9x16.mp4` (39 s, with a rivals beat) and `video/thinstream-long-16x9.mp4` (5:35, captions in `video/thinstream-long-16x9.srt`). Both use the local Qwen3-TTS voice "ryan" (free). Scripts, voice lines and chapters in `video/SCRIPT.md`, hook review in `video/REVIEW-hook-script.md`. Edits are in ChatCut projects "Thinstream short 9x16" (timeline "Short v4 (rivals)") and "Thinstream long 16x9" (timeline "Long v1 (voice)"). Build scripts in `video/build/`. Keep `video/build/` and the ChatCut projects until he approves; the text-only first short is in `video/build/out/`. New covers `video/covers/cover-*-v2.png` (approved by Alireza 2026-11-12) say "HOTEL WIFI? READ IT." over the real demo transcript (source `video/covers/src/*-v2.html`, rendered by `render-covers.mjs`); the old zoo covers are still beside them. The long video's popup shot shows 1.0.1. The release pack at `~/Desktop/Thinstream - Release Pack/` has both videos, `.en.srt` captions and the chapters.
- [ ] Translated captions (YouTube's auto translate) are ignored for now.

## Handy

- `./scripts/build.sh` makes the Chrome zip, the Firefox zip and `dist/firefox/`.
- `node scripts/stats.mjs` prints downloads, stars and repo traffic from GitHub and saves the day to `stats/history.json`.
- `tests/e2e-chrome.mjs` and `tests/e2e-firefox.mjs` are the browser tests. How to run them is in each file's header.
- The skill `thinstream` (in `~/.claude/skills/thinstream/`) tells a new session how to take over from a fresh clone.
- `./scripts/publish.sh` creates the repo, topics, Pages and the release. Safe to run again.
- `node scripts/dev-server.mjs` serves the repo on localhost:8767 (also the `thinstream` entry in the parent folder's `.claude/launch.json`).

## App Store status (2026-11-12, end of day)

- macOS 1.0.1 (build 2) submitted, Waiting for Review. Manual release: he picks the go-live time after approval.
- Build 1 for Mac failed Apple processing: files had the `com.apple.quarantine` flag (from rendering images). Fix before any Mac archive: `xattr -rd com.apple.quarantine extension safari assets`. Build number is now 2 in the Safari project.
- Apple limits the manifest `description` to 112 characters for Safari. It is 95 now.
- iOS 1.0.1 (build 1) is processed and attached, not submitted. It needs real iPhone and iPad screenshots. He is added to TestFlight; next step is to run it on his iPhone and send screenshots, then submit.
- Declarations made with his OK: Content Rights "Yes, accesses third-party content, and I have the necessary rights"; age rating all No/None (4+); App Privacy published as Data Not Collected; review contact filled.
- Store assets: `demo/store-shots.mjs` makes the Mac screenshots and the 29.5 s preview into `dist/appstore/`.
- Website: the Firefox button downloads the Firefox zip from the latest release. Switch it to the addons.mozilla.org listing once Mozilla approves it.
- 1.0.2 released 2026-11-13 (he said "Yes, cut 1.0.2"): phone and tablet panel fix for Chrome and Firefox. The Safari project stays at 1.0.1 for now, since the Mac 1.0.1 is in review and the iPhone build 3 (with the fix) was archived at 1.0.1.
- 1.0.3 released 2026-11-13 (he said "Yes, cut 1.0.3"): transcript fallback when the player's caption list stays empty. Tested on 6 videos in a normal browser. Not verified on a real phone.
- 2026-11-13: iPhone build 1.0.1 (4) with the phone panel fix and the transcript fallback works on his iPhone through TestFlight (his words: "works"). Next session: take 3 iPhone screenshots, size them for iPhone 6.9 inch and iPad 13 inch, add them to the iOS 1.0.1 version page, attach build 4, and submit. The Mac 1.0.1 (build 2) in review does not have these fixes; ship them in the next Mac update.
