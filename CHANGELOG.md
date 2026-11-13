# Changelog

## 1.0.3 (2026-11-13)

- Fixed: the transcript often failed to load on videos where YouTube's player never fills its caption list (common with auto-generated captions). Thinstream now builds the list from the video's own data after a few seconds and loads the track.

## 1.0.2 (2026-11-13)

- Fixed: on phones and tablets the buttons in the transcript panel could not be tapped, because the video player took the taps (Safari showed its own player options). On touch screens the panel is now a sheet at the bottom of the page, in Safari, Chrome and Firefox.
- Shorter extension description, to fit Apple's 112 character limit for Safari.

## 1.0.1 (2026-11-12)

- Fixed: the transcript could fail to load when captions were already on before listen mode was switched on.
- Fixed: the data estimate showed odd labels such as "546p" on wide films. It now uses YouTube's own labels.
- Changed: clicking a transcript line now jumps with the player's own seek call.

## 1.0.0 (2026-11-12)

First release.

- Listen mode button in the YouTube player and in the toolbar popup.
- Holds the video at the lowest quality (144p) and hides the picture.
- Transcript panel that follows the audio. Click a line to jump.
- Caption language picker, text size, copy, save as `.txt`.
- Data estimate for the current video, and a running total in the popup.
- Option to hide recommendations and comments.
- Puts your quality and caption settings back when listen mode is turned off.
- Chrome extension (Manifest V3) and a Safari Xcode project for Mac and iOS.
- Firefox build added to the 1.0.0 release later the same day. Same code, with a Firefox manifest.
