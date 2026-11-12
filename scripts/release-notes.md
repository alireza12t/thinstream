First release of Thinstream, a free listen mode for YouTube.

When the internet is slow, press one button in the YouTube player. The video drops to 144p and hides, and you get the audio with a transcript that follows along.

**What's in it**

- Listen mode button in the player and in the toolbar popup
- Holds the video at 144p and hides the picture
- Transcript that follows the audio, click a line to jump
- Caption language picker, text size, copy, save as `.txt`
- Data estimate for the video you are on
- No account, no server, no tracking

**Install on Chrome, Edge, Brave or Arc**

1. Download `thinstream-chrome-1.0.0.zip` below and unzip it.
2. Open `chrome://extensions` and turn on Developer mode.
3. Click Load unpacked and pick the unzipped folder.

**Safari**

Build the Xcode project in `safari/`. Steps are in the [README](https://github.com/alireza12t/thinstream#safari-on-mac). The Mac and iOS apps compile. The extension has not been run inside Safari yet.

**Good to know**

It is not true audio only. YouTube's web player no longer offers a separate audio stream, so 144p is the floor. On a 10 minute test video that came to about 15 MB instead of 66 to 97 MB at 720p.

Free for noncommercial use under PolyForm Noncommercial 1.0.0.
