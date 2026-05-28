# Personio Attendance Autofill

Chrome/Brave extension that fills your Personio monthly attendance with **Work (09:00–12:00 / 13:00–18:00)** and **Break (12:00–13:00)** for all working days — in one click.

## Features

- Fills all empty workdays in the monthly view (Monday–Friday)
- Skips weekends, holidays, and off-days automatically
- Skips days that already have tracked hours
- 3-period non-overlapping entry: Work → Break → Work
- In-page success/error feedback
- Popup with per-day log and summary stats

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
3. Click **"Alle leeren Tage füllen"**
4. Watch the in-page feedback overlay as days are filled

## Schedule

| Period  | Start | End   |
|---------|-------|-------|
| Arbeit  | 09:00 | 12:00 |
| Pause   | 12:00 | 13:00 |
| Arbeit  | 13:00 | 18:00 |

Net daily working time: **8 hours** (9h minus 1h break)

## Data Safety

- No data is sent anywhere — all processing happens locally in your browser
- No external servers, no analytics, no tracking
- The extension only runs on `*.personio.com/attendance/employee/*` pages

## Development

```
extension/
├── content.js      # Core autofill logic (DOM parsing, React spin-fill, save)
├── manifest.json   # Manifest V3 extension config
├── popup.html      # Toolbar popup UI
├── popup.js        # Popup logic (message passing, logging)
└── icons/          # Extension icons (16/48/128 PNGs)
```

## License

[MIT](LICENSE)
