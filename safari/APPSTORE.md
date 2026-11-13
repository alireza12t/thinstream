# Thinstream on the App Store: listing kit

For App Store Connect. Copy the blocks as they are. One app record covers iPhone, iPad and Mac (bundle id `com.alirezatoghiani.thinstream`, add the macOS platform to the same record).

**Before submitting:** the extension has not been run inside Safari yet. Run it on the Mac first, then on a real iPhone through TestFlight. The iPhone layout is cramped and may need work before review.

## App information

- **Name** (30 max): `Thinstream for YouTube` (22). "for YouTube" is the form other apps on the store use.
- **Subtitle** (30 max): `Audio and transcript, low data` (30)
- **Bundle ID:** `com.alirezatoghiani.thinstream`
- **SKU:** `thinstream`
- **Primary category:** Utilities. **Secondary:** Productivity.
- **Price:** Free.
- **Age rating:** answer "None" to every content question. Unrestricted web access: No (it only runs on youtube.com in Safari).
- **Copyright:** `2026 Alireza Toghiani`

Name check on 2026-11-12: the App Store search API returned no app called Thinstream on iPhone or Mac. The closest name was "ThinQ Streaming" by LG, which is unrelated.

## URLs

- **Privacy Policy URL:** https://alireza12t.github.io/thinstream/privacy.html
- **Support URL:** https://github.com/alireza12t/thinstream/issues
- **Marketing URL:** https://alireza12t.github.io/thinstream/

## App Privacy

Data collection: **Data Not Collected**. The app and the extension make no network requests of their own and send nothing anywhere.

## Promotional text (170 max)

```
Slow internet? Don't watch it. Listen and read. One tap on YouTube in Safari holds the video at 144p, hides it, and shows a transcript that follows the audio.
```

## Description

```
Thinstream is a Safari extension for slow or limited internet. It adds a Listen mode button to the YouTube player.

Turn it on and:
• The video drops to the lowest quality YouTube offers, 144p, and stays there
• The picture is hidden
• The full transcript shows in the player, and the current line follows the audio
• Tap a line to jump to that moment
• Pick any caption language the video has, right to left languages included
• Change the text size, copy the transcript, or save it as a text file
• See roughly how much data the video needs in listen mode

How much data
On one 10 minute 35 second test video, listen mode was about 15 MB. The same video was 66 to 97 MB at 720p. The saving depends on the video.

Good to know
• It is not true audio only. YouTube's web player does not offer a separate audio stream, so 144p is the floor.
• The transcript uses the captions YouTube already has for the video. If a video has no captions, the audio still plays.
• It works on youtube.com in Safari, not inside the YouTube app.
• It does not block ads.

Private
No account. No server. No tracking. No AI. Thinstream makes no network requests of its own, and your settings stay on your device.

Thinstream is not affiliated with or endorsed by YouTube or Google. YouTube is a trademark of Google LLC.
```

## Keywords (100 max)

```
listen,captions,subtitles,slow,internet,saver,bandwidth,hotspot,wifi,only,read,safari,extension
```
(95 bytes)

Apple matches the name, subtitle and keywords together, so no word from "Thinstream for YouTube" or "Audio and transcript, low data" is repeated here. Searches like "youtube audio only", "data saver", "low data", "slow internet" and "youtube captions" still match. Changed 2026-11-12 from an older draft that wasted about 30 bytes on repeats. If the draft in App Store Connect still has the old line, paste this one over it.

## What's New (version 1.0.1)

```
First release on the App Store.
```

## Review notes

```
Thinstream is a Safari web extension. The app only explains how to turn the extension on.

How to test:
1. Turn on the extension. Mac: Safari, Settings, Extensions, Thinstream. iPhone and iPad: Settings, Apps, Safari, Extensions, Thinstream.
2. Open any video with captions on youtube.com in Safari, for example https://www.youtube.com/watch?v=R6MlUcmOul8 and allow Thinstream on youtube.com when Safari asks.
3. Mac: press the Thinstream button in the player controls, next to the captions button. iPhone and iPad: tap the "Listen mode" button at the bottom right of the page.
4. The video drops to 144p and is hidden, and the transcript appears and follows the audio. "Show video" turns it off and puts the quality back.

No sign in is needed. The extension only runs on youtube.com. It uses the YouTube player's own quality and caption settings. It does not download video or audio, does not block ads, and collects no data.
```

## Screenshots needed (not made yet)

Take these from Safari with the extension running. They must be real, so they wait until it has been run in Safari.
- **Mac:** 2880 x 1800 or 2560 x 1600. Listen mode with the transcript, the language picker, the popup.
- **iPhone 6.9 inch:** 1320 x 2868. Listen mode on youtube.com in Safari.
- **iPad 13 inch:** 2064 x 2752. Same shots.

## Build and upload

1. Open `safari/Thinstream/Thinstream.xcodeproj` in Xcode.
2. Scheme `Thinstream (macOS)`, Product, Archive, then Distribute App, App Store Connect.
3. Scheme `Thinstream (iOS)`, destination Any iOS Device, Product, Archive, then Distribute App, App Store Connect.
4. Xcode sets the build number on upload. The version is 1.0.1.
5. In TestFlight, add yourself as an internal tester and try it on your iPhone before sending it to review.
