import { useMemo } from 'react';

export default function SessionComplete({
  exerciseType,
  exerciseLabel,
  trials,
  accuracy,
  finalThreshold,
  isBaseline,
  onDone,
  thresholdUnit,
}) {
  const stats = useMemo(() => {
    const correct = trials.filter((t) => t.correct).length;
    const reactionTimes = trials
      .filter((t) => t.reactionTimeMs > 0 && t.reactionTimeMs < 10000)
      .map((t) => t.reactionTimeMs);
    const avgRT = reactionTimes.length > 0
      ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
      : 0;
    const medianRT = reactionTimes.length > 0
      ? Math.round(reactionTimes.sort((a, b) => a - b)[Math.floor(reactionTimes.length / 2)])
      : 0;

    return {
      total: trials.length,
      correct,
      accuracy: Math.round(accuracy * 100),
      avgReactionTime: avgRT,
      medianReactionTime: medianRT,
    };
  }, [trials, accuracy]);

  const thresholdLabels = {
    gap_detection: 'Gap Threshold',
    temporal_order_judgment: 'SOA Threshold',
    dichotic_toj_spatial: 'SOA Threshold',
    pitch_discrimination: 'Pitch Threshold',
    pattern_detection: 'Level',
    duration_reproduction: 'Avg Accuracy',
  };
  const thresholdLabel = thresholdLabels[exerciseType] || 'Threshold';

  const defaultUnits = {
    gap_detection: 'ms',
    temporal_order_judgment: 'ms',
    dichotic_toj_spatial: 'ms',
    pitch_discrimination: ' ST',
    pattern_detection: '',
    duration_reproduction: '%',
  };
  const unit = thresholdUnit ?? defaultUnits[exerciseType] ?? '';

  return (
    <div className="session-complete">
      <div className="complete-header">
        <div className="complete-icon">🎉</div>
        <h2>{isBaseline ? 'Baseline Complete!' : 'Session Complete!'}</h2>
        <p className="complete-subtitle">{exerciseLabel}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card highlight">
          <span className="stat-value">{finalThreshold}{unit}</span>
          <span className="stat-label">{thresholdLabel}</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.accuracy}%</span>
          <span className="stat-label">Accuracy</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">Trials</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.correct}</span>
          <span className="stat-label">Correct</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.avgReactionTime}ms</span>
          <span className="stat-label">Avg Reaction Time</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.medianReactionTime}ms</span>
          <span className="stat-label">Median RT</span>
        </div>
      </div>

      {isBaseline && (
        <div className="baseline-note">
          <p>✅ Baseline recorded! This will be your reference point to measure progress.</p>
        </div>
      )}

      <button className="btn-primary btn-large" onClick={onDone}>
        {isBaseline ? 'Continue' : 'Back to Dashboard'}
      </button>
    </div>
  );
}
