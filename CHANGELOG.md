# Changelog

## Unreleased (on main, not in the 1.0.0 zips)

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
