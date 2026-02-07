/**
 * Adaptive difficulty algorithm for EarSync exercises
 *
 * Implements a modified staircase procedure:
 * - If accuracy >= 75% over N trials: decrease parameter (harder)
 * - If accuracy < 60% over N trials: increase parameter (easier)
 * - Otherwise: stay at current level
 */

// Gap Detection step sizes (ms)
export const GAP_STEPS = [32, 24, 16, 12, 8, 6, 4, 3, 2];
export const GAP_TRIALS_PER_LEVEL = 10;
export const GAP_ADVANCE_THRESHOLD = 0.75;
export const GAP_RETREAT_THRESHOLD = 0.60;
export const GAP_MAX_TRIALS = 150;
export const GAP_MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes

// TOJ Spectral (frequency-based) step sizes (ms)
export const TOJ_STEPS = [150, 100, 70, 50, 35, 25, 20, 15, 12];
export const TOJ_TRIALS_PER_LEVEL = 15;
export const TOJ_ADVANCE_THRESHOLD = 0.75;
export const TOJ_RETREAT_THRESHOLD = 0.60;
export const TOJ_MAX_TRIALS = 150;
export const TOJ_MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes

// Dichotic TOJ Spatial (same frequency, pure spatial) step sizes (ms)
// Research-based: matches published methodology for direct comparison
// Target: ~66.5ms for young adults (Fostick & Babkoff, 2022)
export const DICHOTIC_TOJ_STEPS = [150, 100, 70, 50, 35, 25, 20, 15, 12];
export const DICHOTIC_TOJ_TRIALS_PER_LEVEL = 15;
export const DICHOTIC_TOJ_ADVANCE_THRESHOLD = 0.75;
export const DICHOTIC_TOJ_RETREAT_THRESHOLD = 0.60;
export const DICHOTIC_TOJ_MAX_TRIALS = 150;
export const DICHOTIC_TOJ_MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes

// Duration Reproduction
export const DURATION_LEVELS = [68, 150, 300, 450, 600, 800, 1000, 1400, 2000]; // ms
export const DURATION_TRIALS_PER_LEVEL = 3;
export const DURATION_TOTAL_TRIALS = DURATION_LEVELS.length * DURATION_TRIALS_PER_LEVEL; // 27
export const DURATION_PASS_ACCURACY = 0.85; // 85% accuracy to consider "mastered"
export const DURATION_MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes

// Pitch Discrimination in Sequence (semitones)
export const PITCH_STEPS = [2.0, 1.0, 0.5, 0.25, 0.125, 0.0625]; // semitones
export const PITCH_TRIALS_PER_LEVEL = 12;
export const PITCH_ADVANCE_THRESHOLD = 0.75;
export const PITCH_RETREAT_THRESHOLD = 0.60;
export const PITCH_MAX_TRIALS = 150;
export const PITCH_MAX_TIME_MS = 20 * 60 * 1000; // 20 minutes
export const PITCH_BASE_FREQ = 440; // Hz (A4)

// Pattern Detection in Noise
export const PATTERN_LEVELS = [1, 2, 3, 4, 5, 6];
export const PATTERN_TRIALS_PER_LEVEL = 15;
export const PATTERN_ADVANCE_THRESHOLD = 0.70;
export const PATTERN_RETREAT_THRESHOLD = 0.55;
export const PATTERN_MAX_TRIALS = 120;
export const PATTERN_MAX_TIME_MS = 25 * 60 * 1000; // 25 minutes

// Pentatonic scale frequencies for pattern generation (C, E, G, B, D)
export const PATTERN_FREQS = [262, 330, 392, 494, 587];

/**
 * Get the next difficulty level based on recent accuracy
 * @param {number[]} steps - Array of step values (descending = easier to harder)
 * @param {number} currentStepIndex - Current index in the steps array
 * @param {number} accuracy - Accuracy from 0-1 over recent trials
 * @param {number} advanceThreshold - Accuracy needed to advance (default 0.75)
 * @param {number} retreatThreshold - Accuracy below which to retreat (default 0.60)
 * @returns {{ stepIndex: number, value: number, action: 'advance' | 'retreat' | 'stay' }}
 */
export function getNextLevel(steps, currentStepIndex, accuracy, advanceThreshold = 0.75, retreatThreshold = 0.60) {
  if (accuracy >= advanceThreshold) {
    // Advance to harder (next index = shorter gap/SOA)
    const newIndex = Math.min(currentStepIndex + 1, steps.length - 1);
    return {
      stepIndex: newIndex,
      value: steps[newIndex],
      action: newIndex === currentStepIndex ? 'stay' : 'advance',
    };
  } else if (accuracy < retreatThreshold) {
    // Retreat to easier (previous index = longer gap/SOA)
    const newIndex = Math.max(currentStepIndex - 1, 0);
    return {
      stepIndex: newIndex,
      value: steps[newIndex],
      action: newIndex === currentStepIndex ? 'stay' : 'retreat',
    };
  }
  return {
    stepIndex: currentStepIndex,
    value: steps[currentStepIndex],
    action: 'stay',
  };
}

/**
 * Calculate accuracy from recent trials
 * @param {Array} trials - Array of trial objects with 'correct' boolean
 * @param {number} count - Number of recent trials to consider
 * @returns {number} Accuracy from 0-1
 */
export function calculateAccuracy(trials, count) {
  const recent = trials.slice(-count);
  if (recent.length === 0) return 0;
  const correct = recent.filter((t) => t.correct).length;
  return correct / recent.length;
}

/**
 * Check if session should end
 * @param {number} trialCount - Total trials completed
 * @param {number} elapsedMs - Time elapsed in ms
 * @param {number} maxTrials - Max trials allowed
 * @param {number} maxTimeMs - Max time allowed in ms
 * @returns {boolean}
 */
export function shouldEndSession(trialCount, elapsedMs, maxTrials, maxTimeMs) {
  return trialCount >= maxTrials || elapsedMs >= maxTimeMs;
}

/**
 * Generate a balanced random sequence of trials
 * 50% positive, 50% negative, shuffled
 * @param {number} count - Number of trials
 * @returns {boolean[]} Array where true = stimulus present
 */
export function generateTrialSequence(count) {
  const half = Math.floor(count / 2);
  const sequence = [];
  for (let i = 0; i < count; i++) {
    sequence.push(i < half);
  }
  // Fisher-Yates shuffle
  for (let i = sequence.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
  }
  return sequence;
}

/**
 * Calculate duration reproduction accuracy
 * accuracy = 100 - (|target - response| / target * 100)
 * Clamped to 0-100
 * @param {number} targetMs
 * @param {number} responseMs
 * @returns {number} 0-100
 */
export function calculateDurationAccuracy(targetMs, responseMs) {
  const error = Math.abs(targetMs - responseMs);
  const accuracy = 100 - (error / targetMs) * 100;
  return Math.max(0, Math.min(100, accuracy));
}

/**
 * Get color rating for duration accuracy
 * @param {number} accuracy 0-100
 * @returns {'green' | 'yellow' | 'red'}
 */
export function getDurationRating(accuracy) {
  if (accuracy >= 85) return 'green';
  if (accuracy >= 75) return 'yellow';
  return 'red';
}

/**
 * Convert semitones to frequency
 * @param {number} baseFreq
 * @param {number} semitones (can be negative for lower)
 * @returns {number} frequency in Hz
 */
export function semitoneToFreq(baseFreq, semitones) {
  return baseFreq * Math.pow(2, semitones / 12);
}

/**
 * Generate a shuffled array of duration trial targets
 * Each duration repeated N times, shuffled
 * @param {number[]} durations
 * @param {number} repeats
 * @returns {number[]}
 */
export function generateDurationTrialOrder(durations, repeats) {
  const trials = [];
  for (const d of durations) {
    for (let i = 0; i < repeats; i++) {
      trials.push(d);
    }
  }
  // Fisher-Yates shuffle
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }
  return trials;
}

/**
 * Pattern generation for Pattern Detection exercise
 */
export const PATTERN_TYPES = {
  REPEATING_AB: 'repeating_AB',
  REPEATING_ABC: 'repeating_ABC',
  ASCENDING: 'ascending',
  DESCENDING: 'descending',
  RANDOM: 'random',
};

/**
 * Generate a tone sequence pattern
 * @param {string} patternType
 * @param {number} length - 4, 5, or 6 tones
 * @param {number[]} freqs - available frequencies
 * @returns {{ sequence: number[], type: string, hasPattern: boolean }}
 */
export function generatePattern(patternType, length, freqs) {
  const sorted = [...freqs].sort((a, b) => a - b);

  switch (patternType) {
    case PATTERN_TYPES.REPEATING_AB: {
      const a = freqs[Math.floor(Math.random() * freqs.length)];
      let b;
      do { b = freqs[Math.floor(Math.random() * freqs.length)]; } while (b === a);
      const seq = [];
      for (let i = 0; i < length; i++) seq.push(i % 2 === 0 ? a : b);
      return { sequence: seq, type: patternType, hasPattern: true };
    }
    case PATTERN_TYPES.REPEATING_ABC: {
      const indices = [];
      while (indices.length < 3) {
        const idx = Math.floor(Math.random() * freqs.length);
        if (!indices.includes(idx)) indices.push(idx);
      }
      const abc = indices.map(i => freqs[i]);
      const seq = [];
      for (let i = 0; i < length; i++) seq.push(abc[i % 3]);
      return { sequence: seq, type: patternType, hasPattern: true };
    }
    case PATTERN_TYPES.ASCENDING: {
      const start = Math.floor(Math.random() * Math.max(1, sorted.length - length + 1));
      const seq = sorted.slice(start, start + length);
      while (seq.length < length) seq.push(sorted[sorted.length - 1]);
      return { sequence: seq, type: patternType, hasPattern: true };
    }
    case PATTERN_TYPES.DESCENDING: {
      const start = Math.floor(Math.random() * Math.max(1, sorted.length - length + 1));
      const seq = sorted.slice(start, start + length).reverse();
      while (seq.length < length) seq.push(sorted[0]);
      return { sequence: seq, type: patternType, hasPattern: true };
    }
    case PATTERN_TYPES.RANDOM:
    default: {
      const seq = [];
      for (let i = 0; i < length; i++) {
        seq.push(freqs[Math.floor(Math.random() * freqs.length)]);
      }
      return { sequence: seq, type: patternType, hasPattern: false };
    }
  }
}

/**
 * Get pattern configuration for a given difficulty level
 * @param {number} level 1-6
 * @returns {{ toneCount: number, snrDb: number | null, patternTypes: string[] }}
 */
export function getPatternLevelConfig(level) {
  const configs = {
    1: { toneCount: 4, snrDb: null, patternTypes: [PATTERN_TYPES.REPEATING_AB] },
    2: { toneCount: 5, snrDb: null, patternTypes: [PATTERN_TYPES.REPEATING_AB, PATTERN_TYPES.REPEATING_ABC] },
    3: { toneCount: 6, snrDb: null, patternTypes: [PATTERN_TYPES.ASCENDING, PATTERN_TYPES.DESCENDING, PATTERN_TYPES.REPEATING_ABC] },
    4: { toneCount: 5, snrDb: 20, patternTypes: [PATTERN_TYPES.REPEATING_AB, PATTERN_TYPES.REPEATING_ABC, PATTERN_TYPES.ASCENDING] },
    5: { toneCount: 6, snrDb: 10, patternTypes: [PATTERN_TYPES.ASCENDING, PATTERN_TYPES.DESCENDING, PATTERN_TYPES.REPEATING_ABC] },
    6: { toneCount: 6, snrDb: 10, patternTypes: [PATTERN_TYPES.REPEATING_AB, PATTERN_TYPES.REPEATING_ABC, PATTERN_TYPES.ASCENDING, PATTERN_TYPES.DESCENDING] },
  };
  return configs[level] || configs[1];
}

/**
 * Get a summary of a completed exercise session
 * @param {Array} trials - All trials from the session
 * @param {number[]} steps - The step values used
 * @param {number} finalStepIndex - Final step index
 * @returns {Object} Session summary
 */
export function getSessionSummary(trials, steps, finalStepIndex) {
  const totalCorrect = trials.filter((t) => t.correct).length;
  const totalTrials = trials.length;
  const reactionTimes = trials.filter((t) => t.reactionTimeMs > 0).map((t) => t.reactionTimeMs);
  const avgReactionTime = reactionTimes.length > 0
    ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
    : 0;

  return {
    trialsCompleted: totalTrials,
    overallAccuracy: totalTrials > 0 ? totalCorrect / totalTrials : 0,
    finalThreshold: steps[finalStepIndex],
    finalStepIndex,
    averageReactionTimeMs: Math.round(avgReactionTime),
    bestThreshold: steps[Math.max(...trials.map((t) => t.stepIndex || 0))],
  };
}
