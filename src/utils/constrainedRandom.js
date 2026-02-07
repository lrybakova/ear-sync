/**
 * Constrained Randomizer for preventing pattern learning
 * 
 * Implements anti-clustering logic to prevent more than 2 consecutive identical trials.
 * This ensures participants use actual perceptual judgment rather than pattern matching.
 * 
 * Research rationale:
 * - Pure Math.random() can produce 3+ consecutive identical trials
 * - Humans detect these patterns and respond based on expectation, not perception
 * - Maximum 2 consecutive identical trials maintains randomness while preventing clustering
 */

export class ConstrainedRandomizer {
  constructor() {
    this.recentTrials = [];
  }

  /**
   * Get next random boolean with anti-clustering constraint
   * @returns {boolean} - Random true/false, constrained to max 2 consecutive identical values
   */
  next() {
    // If last 2 trials were identical, force the opposite to prevent clustering
    if (
      this.recentTrials.length >= 2 &&
      this.recentTrials[0] === this.recentTrials[1]
    ) {
      const forcedChoice = !this.recentTrials[0];
      this.updateHistory(forcedChoice);
      return forcedChoice;
    }

    // Otherwise 50/50 random
    const randomChoice = Math.random() < 0.5;
    this.updateHistory(randomChoice);
    return randomChoice;
  }

  /**
   * Update internal history (keeps last 2 trials)
   * @param {boolean} choice
   */
  updateHistory(choice) {
    this.recentTrials.push(choice);
    if (this.recentTrials.length > 2) {
      this.recentTrials.shift(); // keep only last 2
    }
  }

  /**
   * Reset history (call at session start)
   */
  reset() {
    this.recentTrials = [];
  }

  /**
   * Get current history (for debugging)
   * @returns {boolean[]}
   */
  getHistory() {
    return [...this.recentTrials];
  }
}

/**
 * Weighted Constrained Randomizer for non-50/50 distributions
 * Example: Pattern Detection needs 60% pattern / 40% random
 */
export class WeightedConstrainedRandomizer {
  constructor(targetRatio = 0.6) {
    this.targetRatio = targetRatio; // e.g., 0.6 for 60% true
    this.recentTrials = [];
    this.counts = { true: 0, false: 0 };
    this.totalTrials = 0;
  }

  /**
   * Get next random boolean with anti-clustering AND target ratio maintenance
   * @returns {boolean}
   */
  next() {
    this.totalTrials++;

    // Calculate current ratio
    const currentRatio =
      this.totalTrials > 0 ? this.counts.true / this.totalTrials : 0;

    // Anti-clustering check (max 2 consecutive)
    if (
      this.recentTrials.length >= 2 &&
      this.recentTrials[0] === this.recentTrials[1]
    ) {
      const forcedChoice = !this.recentTrials[0];
      this.updateHistory(forcedChoice);
      return forcedChoice;
    }

    // If ratio is too far off target, bias towards correction
    let adjustedProbability = this.targetRatio;
    if (currentRatio < this.targetRatio - 0.1) {
      // Need more 'true' values
      adjustedProbability = Math.min(0.8, this.targetRatio + 0.2);
    } else if (currentRatio > this.targetRatio + 0.1) {
      // Need more 'false' values
      adjustedProbability = Math.max(0.2, this.targetRatio - 0.2);
    }

    const randomChoice = Math.random() < adjustedProbability;
    this.updateHistory(randomChoice);
    return randomChoice;
  }

  updateHistory(choice) {
    this.recentTrials.push(choice);
    this.counts[choice]++;
    if (this.recentTrials.length > 2) {
      this.recentTrials.shift();
    }
  }

  reset() {
    this.recentTrials = [];
    this.counts = { true: 0, false: 0 };
    this.totalTrials = 0;
  }

  getStats() {
    return {
      totalTrials: this.totalTrials,
      trueCount: this.counts.true,
      falseCount: this.counts.false,
      actualRatio: this.totalTrials > 0 ? this.counts.true / this.totalTrials : 0,
      targetRatio: this.targetRatio,
    };
  }
}
