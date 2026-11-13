Three fixes found while filming the demo.

**Fixed**

- The transcript could fail to load when captions were already on before listen mode was switched on. It now shows right away.
- The data estimate showed odd quality labels such as "546p" on wide films. It now uses YouTube's own labels.
- Clicking a transcript line now jumps with the player's own seek call, which is the safer way to move around long videos.

**Install on Chrome, Edge, Brave or Arc**

1. Download `thinstream-chrome-1.0.1.zip` below and unzip it.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click Load unpacked and pick the unzipped folder. If you loaded 1.0.0 before, remove it first.

**Install on Firefox**

1. Download `thinstream-firefox-1.0.1.zip` below.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click Load Temporary Add-on and pick the zip. Firefox removes it on restart, so load it again next time. Needs Firefox 140 or newer.

**Safari**

Build the Xcode project in `safari/`. Steps are in the [README](https://github.com/alireza12t/thinstream#safari-on-mac). The Mac and iOS apps compile. The extension has not been run inside Safari yet.

**Good to know**

It is not true audio only. YouTube's web player no longer offers a separate audio stream, so 144p is the floor. On a 10 minute test video that came to about 15 MB instead of 66 to 97 MB at 720p.

Free for noncommercial use under PolyForm Noncommercial 1.0.0.
