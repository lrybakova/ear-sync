# EarSync - Train Your Sync

Auditory temporal processing training app built with React + Web Audio API.

## Exercises

1. **Gap Detection** - Detect silent gaps in white noise (2-32ms). Trains temporal resolution.
2. **Temporal Order Judgment** - Identify which stereo tone came first (12-150ms SOA). Trains hemispheric synchronization.
3. **Duration Reproduction** - Listen then reproduce tone durations by holding spacebar (68-2000ms). Trains internal timing.
4. **Pitch Discrimination** - Detect pitch changes in 4-tone sequences (0.0625-2 semitones). Trains sequential pitch encoding.
5. **Pattern Detection** - Identify patterns in tone sequences with background noise (6 difficulty levels). Trains pattern recognition.

## Features

- Adaptive difficulty using staircase procedures
- Baseline measurement protocol for all 5 exercises
- 12-week progressive training schedule
- Progress tracking with charts (Recharts)
- Headphone verification for stereo exercises
- Keyboard shortcuts for fast responses
- Per-duration accuracy breakdown (Duration Reproduction)
- Bonus pattern identification (Pattern Detection)
- SNR-controlled background noise mixing
- Data export (JSON)
- Responsive dark theme UI

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser. Headphones recommended for TOJ exercise.

## Training Protocol (12 weeks, 36 sessions)

| Weeks | Exercises |
|-------|-----------|
| 1-2 | Gap Detection + TOJ |
| 3-4 | + Duration Reproduction |
| 5-6 | + Pitch Discrimination |
| 7-12 | All 5 exercises (full protocol) |

Target: 3-5 sessions per week, ~30-40 min each.

## Tech Stack

- React 19 + Vite
- Web Audio API (sample-accurate timing at 44.1kHz)
- Recharts (progress graphs)
- LocalStorage (data persistence)
- React Router (navigation)
