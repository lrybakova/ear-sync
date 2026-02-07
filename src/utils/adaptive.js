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

// TOJ step sizes (ms)
export const TOJ_STEPS = [150, 100, 70, 50, 35, 25, 20, 15, 12];
export const TOJ_TRIALS_PER_LEVEL = 15;
export const TOJ_ADVANCE_THRESHOLD = 0.75;
export const TOJ_RETREAT_THRESHOLD = 0.60;
export const TOJ_MAX_TRIALS = 150;
export const TOJ_MAX_TIME_MS = 15 * 60 * 1000; // 15 minutes

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
