---
name: verify
description: Drive the Plinko game in headless Chromium and screenshot it at multiple viewports to verify UI/gameplay changes.
---

# Verify plinko-game

Dev server: `PATH="$HOME/.local/node24/bin:$PATH" npm run dev` → http://localhost:5173/ (check it isn't already running first).

Drive with playwright-core (no project dep — install it in the session scratchpad, not here) using the globally cached browser at
`~/Library/Caches/ms-playwright/chromium-1181/chrome-mac/Chromium.app/Contents/MacOS/Chromium` (pass as `executablePath`).

Gotchas:
- The app shows a ~2.2s loading screen; `waitForTimeout(2600)` after `goto` before interacting.
- Screenshot with `deviceScaleFactor: 2` — bucket-label rendering bugs are invisible at 1x.
- Key viewports: 1280×800 (desktop header/footer), 390×844 (mobile portrait), 844×390 (short landscape — exercises ScaleBox uniform scaling), 320×568 (tiny), plus a **live setViewportSize resize** desktop→landscape→portrait (ScaleBox re-measure had a stale-height bug once; regression-check it).
- Drop a ball via `.play-btn`; screenshot ~120ms after click to check the spawn sits in the entry hole, and ~2600ms after to catch win banner / bucket flash / history row.
- Auto mode: `.bgc-opt:has-text("Auto")`; mobile header menu: `.hdr-dots`.
- Listen for `pageerror` — silent React errors otherwise.
