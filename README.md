# EarSync - Train Your Sync

Auditory temporal processing training app built with React + Web Audio API.

## Exercises

- **Gap Detection** - Detect silent gaps in white noise. Trains temporal resolution.
- **Temporal Order Judgment** - Identify which tone came first (stereo). Trains hemispheric synchronization.

## Features

- Adaptive difficulty using staircase procedure
- Baseline measurement protocol
- Progress tracking with charts
- Headphone verification
- Keyboard shortcuts for fast responses
- Data export (JSON)
- Responsive dark theme UI

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000 in your browser. Headphones recommended for TOJ exercise.

## Training Protocol

1. Run baseline for each exercise (~15 min each)
2. Train 3-5 sessions per week
3. Target: 36 sessions total
4. Track threshold improvement over time

## Tech Stack

- React 19 + Vite
- Web Audio API (sample-accurate timing)
- Recharts (progress graphs)
- LocalStorage (data persistence)
