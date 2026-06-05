# Chrome Extension Auto-Login

A Chrome extension that captures authentication data (cookies and localStorage) from the active browser tab and generates compressed JavaScript scripts for auto-login purposes.

## Features

- **One-Click Capture**: Extract cookies and localStorage from any active tab
- **Script Generation**: Automatically generate executable JavaScript for auto-login
- **Script Compression**: Minify scripts for easy copying and sharing
- **Profile Management**: Save and manage multiple authentication profiles
- **Clipboard Integration**: Copy generated scripts with one click
- **Download Support**: Save scripts as .js files

## Project Structure

```
extension/
├── manifest.json              # Extension manifest (MV3)
├── popup/
│   ├── popup.html            # Popup UI
│   ├── popup.js              # Popup logic
│   └── popup.css             # Popup styles
├── background/
│   └── service-worker.js     # Background service worker
├── content/
│   └── content-script.js     # Content script for localStorage access
├── lib/
│   ├── cookie-manager.js     # Cookie extraction logic
│   ├── storage-manager.js    # localStorage extraction logic
│   ├── script-generator.js   # Script generation logic
│   └── compressor.js         # Script compression logic
└── utils/
    └── storage.js            # Profile storage management
```

## Installation

1. Clone this repository
2. Navigate to the extension directory
3. Install dependencies (for testing):
   ```bash
   npm install
   ```
4. Load the extension in Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` directory

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Testing Strategy

This extension uses a dual testing approach:
- **Unit Tests**: Verify specific examples and edge cases
- **Property-Based Tests**: Verify universal properties across randomized inputs using fast-check

## Permissions

The extension requires the following permissions:
- `activeTab`: Access to the currently active tab
- `cookies`: Read cookies from any domain
- `scripting`: Inject content scripts to access localStorage
- `storage`: Store saved authentication profiles
- `clipboardWrite`: Copy generated scripts to clipboard

## Usage

1. Navigate to a website and log in
2. Click the extension icon
3. Click "Capture Auth Data"
4. View the generated script
5. Copy to clipboard or download as a file
6. (Optional) Save as a profile for later use

## Security Considerations

- Authentication data contains sensitive session tokens
- Handle generated scripts with care
- Do not share scripts publicly as they contain your authentication credentials
- Scripts execute in browser console with full access to the page

## Browser Compatibility

Compatible with all Chromium-based browsers:
- Google Chrome
- Microsoft Edge
- Brave
- Opera

## License

ISC
