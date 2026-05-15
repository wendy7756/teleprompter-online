# Teleprompter Online

A lightweight open-source browser version of the macOS Teleprompter app. It is written as a static HTML/CSS/JavaScript app so it can run quickly on GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static file host.

## Features

- Teleprompter mode with play, pause, restart, previous, and next controls.
- Recording mode with camera preview, draggable text overlay, countdown, and WebM export.
- Speed range: 10-500 WPM.
- The WPM speed model follows the macOS app's content-aware calculation: words per second multiplied by measured points per word.
- Text controls for size, line spacing, width, color, background, alignment, and mirror flips.
- Local settings persistence through `localStorage`.
- No build step and no runtime dependencies.

## Run Locally

Open `index.html` directly, or serve the folder so browser camera permissions work reliably:

```bash
python3 -m http.server 8787
```

Then visit:

```text
http://localhost:8787
```

## Browser Notes

Camera and microphone access require HTTPS in production. Localhost is treated as secure by modern browsers. Recording exports a `.webm` file through the browser `MediaRecorder` API.
