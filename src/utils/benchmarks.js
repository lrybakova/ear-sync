/**
 * Research-based benchmarks for EarSync exercises
 *
 * Each exercise has published norms used for context display.
 * These are NOT diagnostic thresholds — individual results vary.
 *
 * Sources cited inline per exercise.
 */

export const BENCHMARKS = {
  gap_detection: {
    label: 'Gap Detection',
    measure: 'Gap threshold',
    unit: 'ms',
    // Lower is better
    direction: 'lower',
    excellent: { value: 2, label: '≤2ms' },
    normal: { low: 3, high: 5, label: '3–5ms' },
    average: 4,
    concern: { value: 10, label: '>10ms' },
    // For chart reference band
    chartBand: { y1: 3, y2: 5 },
    chartTarget: 4,
    source: 'Fostick et al.',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6452600/',
    note: null,
  },

  temporal_order_judgment: {
    label: 'TOJ (Spectral)',
    measure: 'SOA threshold',
    unit: 'ms',
    direction: 'lower',
    excellent: { value: 35, label: '<35ms' },
    normal: { low: 35, high: 50, label: '35–50ms' },
    average: 40,
    concern: { value: 80, label: '>80ms' },
    chartBand: { y1: 35, y2: 50 },
    chartTarget: 40,
    source: 'Estimated',
    sourceUrl: null,
    note: 'Uses pitch cues (500Hz vs 1000Hz) — expected easier than spatial TOJ by ~20-30ms',
  },

  dichotic_toj_spatial: {
    label: 'Dichotic TOJ (Spatial)',
    measure: 'SOA threshold',
    unit: 'ms',
    direction: 'lower',
    excellent: { value: 40, label: '<40ms' },
    normal: { low: 60, high: 70, label: '60–70ms' },
    average: 66.5,
    concern: { value: 100, label: '~100ms (older adults avg)' },
    chartBand: { y1: 60, y2: 70 },
    chartTarget: 66.5,
    source: 'Fostick & Babkoff 2022',
    sourceUrl: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0264831',
    note: '226 participants, dichotic 1000Hz tones. Young adults (18-34): 66.5ms avg.',
  },

  duration_reproduction: {
    label: 'Duration Reproduction',
    measure: 'Accuracy',
    unit: '%',
    // Higher is better
    direction: 'higher',
    excellent: { value: 90, label: '>90%' },
    normal: { low: 80, high: 90, label: '80–90%' },
    average: 85,
    concern: { value: 70, label: '<70%' },
    chartBand: { y1: 80, y2: 90 },
    chartTarget: 85,
    source: 'Multiple studies 2012-2022',
    sourceUrl: 'https://www.biorxiv.org/content/10.1101/2023.08.22.554259v1.full-text',
    note: 'Typical ~13.5% overestimation. Short durations (<500ms) overestimated, long (>1000ms) underestimated.',
  },

  pitch_discrimination: {
    label: 'Pitch Discrimination',
    measure: 'Pitch threshold',
    unit: ' ST',
    direction: 'lower',
    excellent: { value: 0.15, label: '<0.15 ST (musician level)' },
    normal: { low: 0.25, high: 0.5, label: '0.25–0.50 ST' },
    average: 0.25,
    concern: { value: 1.5, label: '>1.5 ST' },
    chartBand: { y1: 0.25, y2: 0.5 },
    chartTarget: 0.25,
    source: 'Seither-Preisler et al. 2011',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3427364/',
    note: 'Non-musicians: ~0.25 ST pure tone. Musicians: ~0.14 ST at 225Hz.',
  },

  pattern_detection: {
    label: 'Pattern Detection',
    measure: 'Accuracy by level',
    unit: '%',
    direction: 'higher',
    excellent: { value: 90, label: '>90% (clean)' },
    normal: { low: 70, high: 85, label: '70–85%' },
    average: 80,
    concern: { value: 55, label: '<55%' },
    chartBand: null, // Level-based, not threshold-based
    chartTarget: null,
    source: 'Multiple pattern detection studies',
    sourceUrl: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8299531/',
    note: 'Lvl 1-3 (clean): expect >85%. Lvl 4-5 (noise): 70-80%. Lvl 6 (complex+noise): 60-70%.',
    levelExpectations: {
      1: { min: 85, label: '>85%' },
      2: { min: 85, label: '>85%' },
      3: { min: 85, label: '>85%' },
      4: { min: 70, label: '70-80%' },
      5: { min: 70, label: '70-80%' },
      6: { min: 60, label: '60-70%' },
    },
  },
};

/**
 * Get a performance rating for a given exercise result
 * @param {string} exerciseType
 * @param {number} value - The threshold/accuracy value
 * @returns {{ rating: 'excellent' | 'normal' | 'below' | 'concern', label: string, color: string }}
 */
export function getBenchmarkRating(exerciseType, value) {
  const bench = BENCHMARKS[exerciseType];
  if (!bench) return { rating: 'unknown', label: '', color: '#64748b' };

  if (bench.direction === 'lower') {
    // Lower is better (thresholds)
    if (value <= bench.excellent.value) {
      return { rating: 'excellent', label: bench.excellent.label, color: '#22c55e' };
    }
    if (value >= bench.normal.low && value <= bench.normal.high) {
      return { rating: 'normal', label: bench.normal.label, color: '#6366f1' };
    }
    if (value < bench.normal.low) {
      return { rating: 'above_normal', label: `Better than avg (${bench.normal.label})`, color: '#22c55e' };
    }
    if (bench.concern && value >= bench.concern.value) {
      return { rating: 'concern', label: bench.concern.label, color: '#ef4444' };
    }
    return { rating: 'below', label: `Above normal range (${bench.normal.label})`, color: '#f59e0b' };
  } else {
    // Higher is better (accuracy)
    if (value >= bench.excellent.value) {
      return { rating: 'excellent', label: bench.excellent.label, color: '#22c55e' };
    }
    if (value >= bench.normal.low && value <= bench.normal.high) {
      return { rating: 'normal', label: bench.normal.label, color: '#6366f1' };
    }
    if (value > bench.normal.high) {
      return { rating: 'above_normal', label: `Better than avg (${bench.normal.label})`, color: '#22c55e' };
    }
    if (bench.concern && value <= bench.concern.value) {
      return { rating: 'concern', label: bench.concern.label, color: '#ef4444' };
    }
    return { rating: 'below', label: `Below normal range (${bench.normal.label})`, color: '#f59e0b' };
  }
}

/**
 * Get benchmark summary text for session complete screen
 * @param {string} exerciseType
 * @param {number} value
 * @returns {{ text: string, detail: string, color: string, source: string }}
 */
export function getBenchmarkSummary(exerciseType, value) {
  const bench = BENCHMARKS[exerciseType];
  if (!bench) return null;

  const rating = getBenchmarkRating(exerciseType, value);

  let text;
  if (rating.rating === 'excellent') {
    text = 'Excellent — beyond typical range';
  } else if (rating.rating === 'above_normal') {
    text = 'Above average';
  } else if (rating.rating === 'normal') {
    text = 'Within normal range';
  } else if (rating.rating === 'concern') {
    text = 'Below typical range';
  } else {
    text = 'Working toward normal range';
  }

  return {
    text,
    detail: `Research benchmark: ${bench.normal.label} (${bench.source})`,
    color: rating.color,
    source: bench.source,
    sourceUrl: bench.sourceUrl,
    note: bench.note,
  };
}
