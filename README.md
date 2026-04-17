# EarSync — Train Your Sync

A browser-based **auditory temporal processing training app**. Research-grade psychoacoustic exercises with adaptive staircase procedures, sample-accurate timing via the Web Audio API, and a 12-week progressive protocol.

## What is this?

The ability to detect very short differences in sound — gaps of milliseconds, which ear heard a tone first, the order of two adjacent pitches — is called **auditory temporal processing**. It's one of the foundations of speech perception in noise, music ability, and auditory attention. It declines with age, is commonly impaired in auditory processing disorders (APD), and can be trained.

EarSync runs six of the most-cited experimental paradigms in the field as a daily training app with baseline measurement, adaptive difficulty, and longitudinal progress tracking.

## Who this is for

- Anyone wanting to train their auditory processing (musicians, language learners, older adults noticing more effort understanding speech in noise)
- Audiologists and SLTs looking for an at-home practice tool between clinic sessions
- Researchers interested in running temporal-processing paradigms outside the lab
- Developers curious about millisecond-precision timing in the browser

No clinical claims. Not a replacement for professional assessment or therapy.

## Exercises

1. **Gap Detection** — detect silent gaps in white noise (2–32 ms). Trains temporal resolution.
2. **Temporal Order Judgment (Spectral)** — identify which tone (high/low frequency) came first at 12–150 ms SOA. Trains hemispheric synchronization with pitch cues.
3. **Dichotic TOJ (Spatial)** — identify which ear heard the identical tone first at 12–150 ms SOA. Research-grade test following [Fostick & Babkoff (2022)](https://pubmed.ncbi.nlm.nih.gov/?term=Fostick+Babkoff+dichotic+temporal+order) for pure hemispheric synchronization. Expected baseline: ~66.5 ms for young adults.
4. **Duration Reproduction** — listen, then reproduce tone durations by holding spacebar (68–2000 ms). Trains internal timing.
5. **Pitch Discrimination** — detect pitch changes in 4-tone sequences (0.0625–2 semitones). Trains sequential pitch encoding.
6. **Pattern Detection** — identify patterns in tone sequences with background noise (6 difficulty levels). Trains pattern recognition.

Each session ends with a **benchmark card** comparing your performance to research norms (excellent / normal / below / concern) with citations to the underlying paper.

## Technical highlights

The interesting engineering lives in three places:

- **Sample-accurate stimulus timing at 44.1 kHz** via `AudioBufferSourceNode` scheduling on the Web Audio clock — not `setTimeout`, which would introduce tens of milliseconds of jitter and make the shorter-SOA exercises scientifically meaningless. See `src/audio/audioEngine.js`.
- **Adaptive staircase procedure** (2-down / 1-up, targeting the 70.7% correct threshold) with configurable minimum reversals before convergence. See `src/utils/adaptive.js`.
- **Constrained randomization** — generates trial sequences with equal class distribution AND a max-consecutive-identical constraint in a single pass, falling back gracefully if a feasible sequence isn't reachable. Prevents participants from pattern-learning the randomizer rather than the underlying discrimination. See `src/utils/constrainedRandom.js`.

Headphone verification via a L/R channel test runs before stereo exercises to ensure results are valid.

## Features

- Adaptive difficulty using staircase procedures
- Baseline measurement protocol across all 6 exercises before training starts
- 12-week progressive training schedule
- Per-exercise progress charts with benchmark overlays (normal range band + research average line)
- Headphone verification for stereo exercises
- Keyboard shortcuts (minimizes motor-response latency confound)
- Per-duration accuracy breakdown (Duration Reproduction)
- Bonus pattern identification (Pattern Detection)
- SNR-controlled background noise mixing
- JSON data export for personal analysis
- Dark theme, responsive UI

## Training Protocol (12 weeks, 36 sessions)

| Weeks | Exercises |
|-------|-----------|
| 1–2   | Gap Detection + TOJ (Spectral) |
| 3–4   | + Dichotic TOJ (Spatial) + Duration Reproduction |
| 5–6   | + Pitch Discrimination |
| 7–12  | All 6 exercises (full protocol) |

Target: 3–5 sessions per week, ~30–40 min each.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. **Headphones required** for stereo exercises.

## Tech Stack

- React 19 + Vite
- Web Audio API (sample-accurate timing at 44.1 kHz)
- Recharts (progress graphs)
- LocalStorage (data persistence, no backend)
- React Router (navigation)

## Status

MVP — built February 2026. Stable for personal daily use. Not actively maintained; happy to answer questions via Issues.

## References

- Fostick, L., & Babkoff, H. (2022). *Dichotic temporal order judgment methodology for hemispheric synchronization.*
- Additional benchmark data sourced from clinical audiology literature. See `src/utils/benchmarks.js` for per-exercise research citations.
