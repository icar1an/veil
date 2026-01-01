# Veil

Replace YouTube thumbnails with minimal typographic cards. Reduce the dopamine-driven clickbait aesthetic and reclaim your attention.

## Installation

1. Download/clone this folder
2. Open Chrome → `chrome://extensions/`
3. Enable **Developer mode**
4. Click **Load unpacked** → select the `veil` folder

## Modes

**Text** — Pure typography. Dark card with serif title, channel name, and duration. Pre-internet editorial feel.

**Film** — Cinematic treatment. Desaturated, letterboxed thumbnail with film grain and vignette.

**Solid** — Flat color derived from video ID hash. Maximum reduction.

## Customization

- **Typeface**: 
  - **Cormorant**: Elegant serif (Cormorant Garamond)
  - **System**: Modern, clean (SF Pro Display / Segoe UI)
  - **Futura**: Geometric sans-serif (Jost)
  - **Script**: Hand-drawn aesthetic (Dancing Script)
- **Display Options**:
  - **Show channel name**: Toggle visibility of the creator's name on cards.
  - **Show duration**: Toggle visibility of video length.
  - **Noise texture**: Add or remove a subtle grain overlay for a tactile feel.
  - **Color accent from video**: Optionally derive a color accent from the video ID for subtle variety.
  - **Hide channel avatars**: Replace distracting channel profile pictures with consistent typographic initials.

## Structure

```
veil/
├── manifest.json
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── fonts/              # Local web fonts for typography
└── src/
    ├── content.js      # Thumbnail replacement logic
    ├── content.css     # Card styles for all modes
    ├── popup.html      # Settings UI
    ├── popup.css
    ├── popup.js
    └── background.js   # Service worker
```

## How It Works

1. **Observe**: Content script watches YouTube's DOM using `MutationObserver`.
2. **Detect**: Targets both classic and modern (2024+) YouTube thumbnail structures.
3. **Extract**: Pulls video title, channel, duration, and ID from the page.
4. **Transform**: Generates a custom typographic card or cinematic overlay.
5. **Mask**: Overlays the card while preserving the underlying YouTube layout.

## Support

If you find Veil helpful, consider supporting the project:
[Support the project on Ko-fi](https://ko-fi.com/D1D21REFY2)

## Known Issues

- YouTube's DOM changes frequently—selectors may need periodic updates.
- Initial load may occasionally flash original thumbnails before the content script executes.
- Shorts thumbnails have a vertical aspect ratio which may vary in results.

## License

MIT
