# Personio Attendance Autofill

Chrome/Brave extension that fills your Personio monthly attendance in one click. Supports customizable hours, English & German UI, and automatically skips weekends, holidays, and already-tracked days.

## Features

- One-click fill of all empty workdays in the monthly view
- **Customizable hours** — set your own work and break times via the settings panel
- English & German language support
- Skips weekends, holidays, and off-days automatically
- Skips days that already have tracked hours
- 3-period non-overlapping entry (Work → Break → Work)
- In-page success/error feedback overlay
- Popup with per-day log and summary stats
- Personio brand icon

## Installation

### From source (developer mode)

1. Clone or download this repo
2. Open **Brave** → `brave://extensions` (or **Chrome** → `chrome://extensions`)
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked**
5. Select the `extension/` folder

### From Chrome Web Store (coming soon)

## Usage

1. Navigate to your Personio monthly attendance view:
   `https://{subdomain}.personio.com/attendance/employee/{id}?viewMode=monthly`
2. Click the extension icon in the toolbar
3. Click **"Fill all empty days"** to autofill
4. Click the gear icon ⚙️ to customize your schedule or language

## Default Schedule

| Period  | Start | End   |
|---------|-------|-------|
| Work 1  | 09:00 | 12:00 |
| Break   | 12:00 | 13:00 |
| Work 2  | 13:00 | 18:00 |

Net daily working time: **8 hours** (9h minus 1h break)

## Data Safety

- No data is sent anywhere — all processing happens locally in your browser
- Uses `chrome.storage.sync` only for your local settings (hours, language)
- No external servers, no analytics, no tracking
- The extension only runs on `*.personio.com/attendance/employee/*` pages

## Development

```
extension/
├── content.js      # Core autofill logic (DOM parsing, React spin-fill, save)
├── manifest.json   # Manifest V3 extension config
├── popup.html      # Toolbar popup UI + settings panel
├── popup.js        # Popup logic (settings, i18n, message passing, logging)
└── icons/          # Extension icons (SVG + 16/48/128 PNGs)
```

## Disclaimer

This extension is **not affiliated with, endorsed by, or sponsored by Personio SE & Co. KG**. It is an independent open-source tool that automates interactions with the Personio web interface. Personio® is a registered trademark of Personio SE & Co. KG.

## License

[MIT](LICENSE)
