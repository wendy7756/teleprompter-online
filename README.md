# Teleprompter Online

Open-source online teleprompter for [teleprompter.works](https://teleprompter.works).

This repository contains the lightweight web version of Teleprompter: a fast, static HTML/CSS/JavaScript app for reading scripts naturally in a browser. It is designed for creators recording TikTok, Reels, YouTube videos, presentations, online courses, interviews, and other scripted content.

## Download The App

For the native iPhone, iPad, and Mac version, download the free app:

[Download Teleprompter on the App Store](https://apps.apple.com/app/teleprompter-scrolling-scripts/id6767148844)

Speak naturally while recording videos. Teleprompter helps you read scripts naturally without memorizing every line. Use Prompter Mode for smooth script reading, or Camera Mode to record videos while reading scripts directly on screen.

## Features

- Prompter Mode for smooth full-screen script reading.
- Recording Mode with 16:9 camera preview and adjustable text overlay.
- Scroll speed from 10 to 500 WPM.
- Text size, line spacing, letter spacing, text color, background color, alignment, mirror, and overlay controls.
- Web-friendly preset layouts for top, bottom, left, right, and center text placement.
- Voice control commands in Teleprompter Mode.
- Local settings persistence with `localStorage`.
- Static app with no build step and no runtime dependencies.

## Run Locally

Open `index.html` directly, or serve the folder so browser camera permissions work reliably:

```bash
python3 -m http.server 8787
```

Then visit:

```text
http://localhost:8787
```

## Deploy

Because this is a static website, it can be deployed to any static host:

- Cloudflare Pages
- GitHub Pages
- Netlify
- Vercel
- Any static file server

## Browser Notes

Camera and microphone access require HTTPS in production. Localhost is treated as secure by modern browsers.

Recording uses the browser `MediaRecorder` API and exports a `.webm` file when supported by the browser.

## Project Scope

This repository is the open-source web/online portion of Teleprompter. The native app for iPhone, iPad, and Mac is distributed separately through the App Store.
