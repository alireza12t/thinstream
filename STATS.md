# Thinstream numbers

How to see how many people get and use Thinstream without touching their privacy. Written 2026-11-12. Terms and limits below were checked on the web that day.

## The pick

1. **Now: GitHub's own numbers.** `node scripts/stats.mjs` prints them. Free, nothing added to the extension, nothing new to disclose.
2. **On the site: the download count, hidden until it is worth showing.** Alireza's call on 2026-11-12: show it for marketing, no dashboard, hide it while it is small. It appears by itself at 100 downloads.
3. **Next: the store listings.** They are the only free way to get real install and active user numbers with no code in the extension. Firefox first, it costs nothing.
4. **Not now: site analytics.** He does not want a dashboard. Notes are below if that changes.
5. **No: a ping from inside the extension.** It would break the promise the project is built on. Details below so the decision is on record.

## Options

| Option | What it counts | How accurate | Privacy | Cost | Effort |
|---|---|---|---|---|---|
| GitHub release downloads | Fetches of each zip, per version | Exact count of fetches. Not people, not installs. Bots and repeats count. Stops meaning much once people install from a store | None. GitHub counts it already | Free | Done |
| GitHub stars, forks, watchers | People who liked or copied the repo | Exact, but only GitHub users | None | Free | Done |
| GitHub repo traffic | Repo page views, clones, where visitors came from | Exact for the repo page. Says nothing about the site or the extension. GitHub drops it after 14 days | None. Only the owner sees it | Free | Done, the script saves it |
| Chrome Web Store dashboard | Installs, uninstalls, weekly users, listing views | Good. Best number for Chrome | None from us. Google counts its own store | $5 once | Listing work, his account |
| addons.mozilla.org statistics | Daily users, downloads | Good. Daily users comes from Firefox's update checks | None from us | Free | Listing work, his Mozilla account |
| App Store Connect | Downloads (units). Usage only from people who agreed to share with developers | Units exact. Usage is a slice, and it counts opening the app, not using the extension in Safari | None from us | Free, he already has the developer account | Already in progress |
| Cookieless site analytics | Visits to the GitHub Pages site, referrers | Fair. Ad blockers hide some visits | Low. No cookies, no personal data stored. A third party script on the site | Free plans exist | 1 sign up, 1 snippet, a dashboard to check |
| Opt in ping from the extension | Browsers with the extension active that week | Low. Only people who switch it on | Breaks "no network requests of its own" | Free tier server | New code, new release, rewrite of every privacy text |

## What exists now

- `scripts/stats.mjs` asks GitHub with `gh` and prints downloads per version and browser, stars, forks, watchers, repo views, clones and referrers.
- Each run saves the day to `stats/history.json`. A second run on the same day refreshes that day. Traffic days that GitHub has already dropped stay in the file, so run it at least once every two weeks.
- The history file stays out of git. It holds traffic numbers that are not public, he wants small numbers hidden, and a commit per run would be noise. The download counts themselves are already public on GitHub, so nothing is lost if the file goes missing except old traffic days.
- `docs/index.html` shows one line under the buttons, "N downloads from GitHub", once N reaches 100 (`MIN_DOWNLOADS`). Stars join it at 20 (`MIN_STARS`). The page reads the live number from GitHub's public API, so there is nothing to update by hand.
- To see the line at any number, open the site with `#stats` on the end: https://alireza12t.github.io/thinstream/#stats
- The wording says downloads, never users. That is what the number is.

First reading, 2026-11-13 UTC: 4 downloads (1 for each zip of 1.0.0 and 1.0.1), 0 stars, 0 forks, 0 repo views. The 4 could be our own checks or bots.

## When the stores are live

- The Chrome Web Store has no public API for user counts, so that number would be typed into the site by hand or left on the store page.
- addons.mozilla.org has a public API with the average daily users of an add-on. The site line could read it the same way it reads GitHub. Check this when the listing exists.
- Then switch the site line from "downloads from GitHub" to a users number, which is the better marketing line.

## Site analytics, if he changes his mind

GoatCounter is the one to use. Checked 2026-11-12 on goatcounter.com:

- Free "for reasonable public usage", paid for by donations. No monthly limit stated, only that millions of views a day is too much.
- No cookies and no unique identifiers. The IP address and browser name are used in memory for 8 hours to tell visits apart and are never written to disk.
- One script, about 3.5 KB.

Cloudflare Web Analytics is the other free one: no cookies, no local storage, no fingerprinting, works with a pasted script and no DNS change, about 6 months of data. It needs a Cloudflare account and its dashboard. Umami Cloud has a free plan too, but its limits could not be confirmed on its own site.

His one step: make a free account at goatcounter.com and pick a code, for example `thinstream`.

The snippet that would go before `</body>` in `docs/index.html`:

```html
<script data-goatcounter="https://thinstream.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
```

The text that would be added to `docs/privacy.html`, as its own section so the extension's promise stays as it is:

> **This website.** The website counts page visits with GoatCounter. It sets no cookies and stores no personal data, no IP address and nothing that identifies you. This is only the website. The extension and the app still collect nothing.

Nothing was signed up for and no script was added.

## A ping from the extension, and why not

The least intrusive version would be:

- Off by default. A switch in the popup, "Share an anonymous weekly count".
- At most one request a week, to one address, with no identifier, no version history, no video data. The only thing kept on the server is a counter for that week, plus the browser name if wanted.
- No IP address stored. The server still sees it for the moment the request arrives. That cannot be avoided.
- It would count browsers with the switch on that were used that week. Without an identifier it cannot tell new users from returning ones.

Cost: a free tier would cover it (a small Cloudflare Worker with a counter). It is still a server to keep alive.

Why not: the number would cover only the few people who switch it on, so it would be a worse number than the store dashboards give for free. And the promise would have to change everywhere:

- `PRIVACY.md` and `docs/privacy.html`: "collects nothing", "no network requests of its own", "no server, no analytics".
- `README.md`: "No account. No server. No tracking." and the "Does it collect any data?" answer.
- `docs/index.html`: the description, the feature list in the page data, the FAQ answer, the "Private" card.
- `docs/llms.txt`: the privacy line.
- `scripts/release-notes.md`.
- `safari/APPSTORE.md`: the App Store answer would stop being "Data Not Collected".
- `scripts/build.sh`: the Firefox manifest says `data_collection_permissions: none`.
- `extension/manifest.json`: a new host permission, which makes browsers show a new permission prompt.
- The Chrome Web Store privacy form, a new version and a new release.

Not built. It is his decision, and the advice is to leave it.
