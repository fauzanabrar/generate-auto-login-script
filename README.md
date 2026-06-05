# Auto-Login Script Generator

Capture authentication data (cookies and localStorage) from a logged-in browser session and generate a JavaScript snippet that restores that session on demand — useful for automation, testing, and quick re-authentication.

Two approaches are available:

| | CLI (Node.js + Playwright) | Browser Extensions |
|---|---|---|
| How it works | Launches a browser, lets you log in, then saves the session | Runs inside your browser via an extension popup |
| Output | `.js` / `.min.js` script | `.js` script + importable `.json` profile |
| Best for | Headless automation, CI | Manual testing, quick session sharing |

---

## Table of Contents

- [CLI Tool](#cli-tool)
- [Browser Extensions](#browser-extensions)
  - [Chrome Extension](#chrome-extension)
  - [Firefox Extension](#firefox-extension)
  - [Features](#features)
  - [Usage](#usage)
  - [Profile Management](#profile-management)
  - [Download Formats](#download-formats)
  - [Security](#security)
- [Using the Generated Script](#using-the-generated-script)
- [Tips](#tips)

---

## CLI Tool

### Requirements

- Node.js
- npm
- Playwright
- minify (`npm install -g minify`)

### Installation

```bash
npm install
```

### Configuration

Edit `info.js`:

```js
url           = '<URL_WITH_HTTP/HTTPS>'
filename      = '<FILENAME_WITHOUT_EXTENSION>'
authFileName  = '<AUTHFILENAME>'
```

### Run

```bash
npm start
```

A browser window opens for you to log in manually. After login the auth file is saved and the script is generated under:

- `auth/<authFileName>` — raw session data
- `login/<filename>.js` — auto-login script
- `login/<filename>.min.js` — minified version

To test the login script:

```bash
npm run try
```

(Edit the url/filename in `services/tryLogin.js` first.)

---

## Browser Extensions

### Chrome Extension

**Manifest V3** — works in Chrome, Edge, Brave, and any Chromium-based browser.

#### Load in Chrome

1. Go to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `extension/` folder in this repo

#### Load in Edge / Brave / Opera

Same steps — use the equivalent extensions management page for each browser.

---

### Firefox Extension

**Manifest V2** — works in Firefox 109+.

#### Load in Firefox

1. Go to `about:debugging` → **This Firefox**
2. Click **Load Temporary Add-on...**
3. Select `firefox/manifest.json`

> **Note:** Temporary add-ons are removed when Firefox restarts. To make it permanent, sign it through [addons.mozilla.org](https://addons.mozilla.org) or use Firefox Developer Edition with signature enforcement disabled.

---

### Features

- **One-click capture** — extracts cookies and localStorage from the active tab
- **Script generation** — produces a compressed, self-contained IIFE
- **Two download formats** — `.js` for console use, `.json` for cross-device profile import
- **Profile management** — save, load, export, import, and delete named profiles
- **Copy to clipboard** — one click to copy the generated script
- **Cross-browser profiles** — `.json` profiles exported from Chrome can be imported into Firefox and vice versa
- **Graceful degradation** — if cookies or localStorage fail, the other source still succeeds

---

### Usage

1. Log in to any website in your browser
2. Click the extension icon in the toolbar
3. Click **Capture Auth Data**
4. The popup shows:
   - Cookie count and localStorage item count
   - The generated compressed script
5. Choose what to do with it:
   - **Copy to Clipboard** — paste into browser console
   - **⬇ .js** — download the script as a runnable `.js` file
   - **⬇ .json** — download as an importable profile (see below)

---

### Profile Management

Profiles store the full authentication data so you can regenerate the script later without recapturing.

| Action | How |
|--------|-----|
| **Save** | Enter a name in the input field after capturing, click Save Profile |
| **Load** | Click a profile in the list to regenerate its script |
| **Export** | Click **⬇** next to a profile — downloads a `.json` file |
| **Import** | Click **⬆ Import** — pick a `.json` profile file |
| **Delete** | Click **Delete** next to a profile (requires confirmation) |

Profiles are stored in `chrome.storage.local` / `browser.storage.local` and persist across browser restarts. Maximum 50 profiles.

---

### Download Formats

#### `.js` — Auto-Login Script

A compressed, self-contained IIFE. Paste it directly into the browser console (or save as a bookmarklet) to restore the session:

```js
(function(){var d=document,ls=localStorage;d.cookie.split(";").forEach(...); ls.setItem(...);})();
```

The script:
1. Clears all existing cookies
2. Sets all captured cookies with their original attributes (path, domain, expires, secure, SameSite)
3. Restores all localStorage items

#### `.json` — Importable Profile

A structured file containing the full `authData`. Can be imported into the extension on any device or browser:

```json
{
  "exportVersion": "1.0",
  "name": "my-profile",
  "domain": "example.com",
  "timestamp": 1234567890000,
  "authData": {
    "cookies": [...],
    "localStorage": [...]
  }
}
```

Import it with the **⬆ Import** button in the Saved Profiles section.

---

### Security

- Auth data contains live session tokens — treat it like a password
- Do not share `.js` or `.json` files publicly
- The generated script has full access to the page when executed
- `httpOnly` cookies are captured via the browser cookies API (not accessible from JS directly), but they are included in the generated script — the script sets them as regular cookies, so `httpOnly` will not be re-set

---

## Using the Generated Script

**Browser console:**

Open DevTools (`F12`) on the target site, paste the script into the Console tab, and press Enter.

**Bookmarklet:**

```
javascript:<PASTE_SCRIPT_HERE>
```

Save as a bookmark URL. Click it on the target site to restore the session.

**Playwright / Puppeteer:**

```js
await page.evaluate(scriptContent);
```

---

## Tips

- If the script doesn't work, try a different browser — cookie policies vary
- Some sites bind sessions to IP address or User-Agent; the script won't help in those cases
- For sites with short-lived tokens, recapture before the session expires
- Use the `.json` export to share sessions between team members for testing

---

## Project Structure

```
.
├── src/services/          # CLI tool services (Playwright-based)
├── index.js               # CLI entry point
├── info.js                # CLI configuration
├── extension/             # Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── background/        # Service worker
│   ├── content/           # Content script (localStorage access)
│   ├── lib/               # Core logic (cookies, storage, generator, compressor)
│   ├── utils/             # Profile storage manager
│   └── popup/             # Extension popup UI
└── firefox/               # Firefox extension (Manifest V2)
    ├── manifest.json
    ├── background/        # Bundled background script
    ├── content/           # Content script
    └── popup/             # Extension popup UI
```

---

## License

ISC
