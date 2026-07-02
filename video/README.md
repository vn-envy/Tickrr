# Tickrr — Feature Reel (Remotion)

A ~98-second, **1920×1080 @ 30fps** promo built with [Remotion](https://github.com/remotion-dev/remotion),
using the **real terminal screenshots**. It has **no baked audio** — pacing leaves headroom so you can
overlay a voice-over track afterward.

## What's in it

| # | Scene | Screenshot | Beat |
|---|-------|-----------|------|
| — | Intro | — | Logo → "The Bloomberg Terminal for prediction markets" |
| 01 | Real-time radar | `terminal.png` | Dislocations the moment they open |
| 02 | Cross-venue | `nba.png` | Polymarket vs Kalshi, side by side |
| 03 | Coverage | `hero.png` | Every market, one board (sports/politics/macro/crypto) |
| 04 | Grounded AI | `terminal.png` | "Why did it move?" — Gemini + Google Search, cited |
| 05 | Deliberation room | `room.png` | An AI room that argues both sides (Pro) |
| 06 | Runs itself | `growth.png` | AI-native operations |
| 07 | Your edge | `myspace.png` | Watchlist + catalyst calendar |
| 08 | Comparison | — | Tickrr vs raw venues / news aggregators / dashboards |
| — | CTA | — | "Trade on information, not vibes. Intel only, never picks." |

## Render

```bash
cd video
npm install
npm run render          # → out/tickrr.mp4  (h.264, ready for audio overlay)
```

Other outputs:

```bash
npm run studio                              # live preview / scrub in the browser
npm run still -- --frame=2450               # a single PNG (e.g. the comparison table)
npm run render -- --codec=h265              # smaller file, if you prefer HEVC
```

## Overlay a voice-over

The video has no audio track. Record VO to the on-screen beats (each scene holds ~9s;
the comparison table holds ~18s), then mux:

```bash
ffmpeg -i out/tickrr.mp4 -i voiceover.wav -c:v copy -c:a aac -shortest out/tickrr_vo.mp4
```

Or drop `out/tickrr.mp4` + your VO into any editor (CapCut, Premiere, DaVinci) and export.

## Re-shoot the screenshots

The shots live in `public/`. To refresh them from the running app
(`web` on :3000, `backend` on :8000):

```bash
cd ../web && node scripts/shoot.mjs      # writes fresh PNGs into ../video/public
```

## Edit copy / timing

Everything is in [`src/Tickrr.tsx`](src/Tickrr.tsx):

- **Scene durations** — the `DUR` array (frames @ 30fps). `TOTAL_FRAMES` is their sum.
- **Feature copy** — the `scenes` array (eyebrow / title / line / tag / img / side).
- **Comparison table** — the `COLS` and `ROWS` constants (`yes` / `part` / `no`).
- **Theme** — the `C` color map.

> Keep it intel-only: no "bet / buy / sell / size", no outcome promises. Kalshi = derived
> analytics + attributed link only.
