import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
  getThresholdHistory,
  getTotalSessionCount,
  getStreak,
  getLatestThreshold,
  getBaselines,
  getSessionsByType,
} from '../utils/storage';

// Exercise config for rendering cards
const EXERCISES = [
  {
    id: 'gap',
    type: 'gap_detection',
    title: 'Gap Detection',
    icon: '〰️',
    description: 'Detect silent gaps in white noise. Trains temporal resolution.',
    thresholdLabel: 'Gap',
    unit: 'ms',
    color: '#6366f1',
    cardClass: 'gap-card',
    unlockWeek: 1,
  },
  {
    id: 'toj',
    type: 'temporal_order_judgment',
    title: 'Temporal Order',
    icon: '🎧',
    description: 'Identify which tone came first. Trains hemispheric synchronization.',
    thresholdLabel: 'SOA',
    unit: 'ms',
    color: '#a855f7',
    cardClass: 'toj-card',
    unlockWeek: 1,
  },
  {
    id: 'dichotic_spatial',
    type: 'dichotic_toj_spatial',
    title: 'Dichotic TOJ (Spatial)',
    icon: '🎧',
    description: 'Identify which ear heard the tone first. Tests pure hemispheric synchronization.',
    thresholdLabel: 'SOA',
    unit: 'ms',
    color: '#8b5cf6',
    cardClass: 'dichotic-spatial-card',
    unlockWeek: 3,
  },
  {
    id: 'duration',
    type: 'duration_reproduction',
    title: 'Duration Repro',
    icon: '⏱️',
    description: 'Reproduce heard durations. Trains internal timing representation.',
    thresholdLabel: 'Accuracy',
    unit: '%',
    color: '#22c55e',
    cardClass: 'duration-card',
    unlockWeek: 3,
  },
  {
    id: 'pitch',
    type: 'pitch_discrimination',
    title: 'Pitch Discrimination',
    icon: '🎵',
    description: 'Detect pitch changes in sequences. Trains sequential pitch encoding.',
    thresholdLabel: 'PDT',
    unit: ' ST',
    color: '#f59e0b',
    cardClass: 'pitch-card',
    unlockWeek: 5,
  },
  {
    id: 'pattern',
    type: 'pattern_detection',
    title: 'Pattern Detection',
    icon: '🧩',
    description: 'Identify patterns in tone sequences with noise. Trains pattern recognition.',
    thresholdLabel: 'Level',
    unit: '',
    color: '#ec4899',
    cardClass: 'pattern-card',
    unlockWeek: 7,
  },
];

// Baseline key mapping (storage uses camelCase keys)
const BASELINE_KEYS = {
  gap_detection: 'gapDetection',
  temporal_order_judgment: 'temporalOrderJudgment',
  dichotic_toj_spatial: 'dichoticTojSpatial',
  duration_reproduction: 'durationReproduction',
  pitch_discrimination: 'pitchDiscrimination',
  pattern_detection: 'patternDetection',
};

export default function Dashboard() {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const baselines = getBaselines();
    const totalSessions = getTotalSessionCount();
    const streak = getStreak();

    const exerciseStats = {};
    for (const ex of EXERCISES) {
      const history = getThresholdHistory(ex.type);
      const threshold = getLatestThreshold(ex.type);
      const baselineKey = BASELINE_KEYS[ex.type];
      const hasBaseline = !!baselines[baselineKey];
      const sessionCount = getSessionsByType(ex.type).length;

      exerciseStats[ex.id] = {
        history,
        threshold,
        hasBaseline,
        baseline: baselines[baselineKey],
        sessionCount,
      };
    }

    return {
      totalSessions,
      streak,
      baselines,
      exerciseStats,
    };
  }, []);

  const targetSessions = 36;
  const progressPercent = Math.min(100, (stats.totalSessions / targetSessions) * 100);

  // Determine which exercises are unlocked (for progressive rollout)
  // For simplicity, unlock all exercises but show recommended schedule
  const getWeekNumber = () => {
    // Approximate week based on total sessions (assuming ~3/week)
    return Math.max(1, Math.ceil(stats.totalSessions / 3));
  };

  const currentWeek = getWeekNumber();

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="app-title">EarSync</h1>
          <p className="app-subtitle">Auditory Temporal Processing Trainer</p>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/settings')}>
          ⚙️ Settings
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card accent">
          <span className="stat-value">{stats.totalSessions}</span>
          <span className="stat-label">Sessions</span>
          <div className="stat-progress">
            <div className="stat-progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>
          <span className="stat-detail">{Math.max(0, targetSessions - stats.totalSessions)} to goal</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.streak}</span>
          <span className="stat-label">Day Streak</span>
        </div>
        {stats.exerciseStats.gap.threshold && (
          <div className="stat-card">
            <span className="stat-value">{stats.exerciseStats.gap.threshold}ms</span>
            <span className="stat-label">Gap Threshold</span>
          </div>
        )}
        {stats.exerciseStats.toj.threshold && (
          <div className="stat-card">
            <span className="stat-value">{stats.exerciseStats.toj.threshold}ms</span>
            <span className="stat-label">TOJ Threshold</span>
          </div>
        )}
      </div>

      {/* Training Schedule Banner */}
      {stats.totalSessions > 0 && stats.totalSessions < targetSessions && (
        <div className="schedule-banner">
          <div className="schedule-info">
            <span className="schedule-week">Week {currentWeek} of 12</span>
            <span className="schedule-hint">
              {currentWeek <= 2 && 'Focus: Gap Detection + TOJ'}
              {currentWeek >= 3 && currentWeek <= 4 && 'Adding: Duration Reproduction'}
              {currentWeek >= 5 && currentWeek <= 6 && 'Adding: Pitch Discrimination'}
              {currentWeek >= 7 && 'Full protocol: All 5 exercises'}
            </span>
          </div>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="exercise-cards-grid">
        {EXERCISES.map((ex) => {
          const exStats = stats.exerciseStats[ex.id];
          const isRecommended = currentWeek >= ex.unlockWeek || stats.totalSessions === 0;

          return (
            <div
              key={ex.id}
              className={`exercise-card ${ex.cardClass} ${!isRecommended ? 'upcoming' : ''}`}
            >
              {!isRecommended && (
                <div className="upcoming-badge">Week {ex.unlockWeek}+</div>
              )}
              <div className="card-header">
                <div className="card-icon">{ex.icon}</div>
                <h3>{ex.title}</h3>
              </div>
              <p className="card-description">{ex.description}</p>
              <div className="card-stats">
                {exStats.threshold != null && (
                  <span>Current: {exStats.threshold}{ex.unit}</span>
                )}
                {exStats.hasBaseline && exStats.baseline && (
                  <span>Baseline: {exStats.baseline.finalThreshold}{ex.unit}</span>
                )}
                {exStats.sessionCount > 0 && (
                  <span>{exStats.sessionCount} sessions</span>
                )}
              </div>
              <div className="card-actions">
                {!exStats.hasBaseline ? (
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/baseline/${ex.id}`)}
                  >
                    Run Baseline
                  </button>
                ) : (
                  <button
                    className="btn-primary"
                    onClick={() => navigate(`/exercise/${ex.id}`)}
                  >
                    Start Training
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Charts */}
      {EXERCISES.some(ex => stats.exerciseStats[ex.id].history.length > 0) && (
        <div className="charts-section">
          <h2 className="section-title">Progress</h2>

          {EXERCISES.map(ex => {
            const history = stats.exerciseStats[ex.id].history;
            if (history.length === 0) return null;

            const gradId = `grad_${ex.id}`;
            const isAccuracyBased = ex.type === 'duration_reproduction';

            return (
              <div key={ex.id} className="chart-card">
                <h3>{ex.title} {isAccuracyBased ? 'Accuracy' : 'Threshold'}</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={history}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ex.color} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={ex.color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                    <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={11}
                      unit={isAccuracyBased ? '%' : ex.unit}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1e1e2e',
                        border: '1px solid #3a3a5c',
                        borderRadius: '8px',
                        color: '#e2e8f0',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="threshold"
                      stroke={ex.color}
                      fill={`url(#${gradId})`}
                      strokeWidth={2}
                      dot={{ fill: ex.color, r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            );
          })}
        </div>
      )}

      {/* Getting Started / Onboarding */}
      {stats.totalSessions === 0 && (
        <div className="onboarding-card">
          <h3>Getting Started</h3>
          <p>Run a baseline measurement for each exercise to establish your starting point. Then train 3-5x per week for 12 weeks.</p>
          <div className="onboarding-steps">
            <div className="step">
              <span className="step-number">1</span>
              <span>Gap Detection + TOJ baselines (~15 min each)</span>
            </div>
            <div className="step">
              <span className="step-number">2</span>
              <span>Duration + Pitch + Pattern baselines</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span>Start daily training! 36 sessions over 12 weeks</span>
            </div>
          </div>

          <div className="schedule-card">
            <h4>12-Week Training Schedule</h4>
            <div className="schedule-grid">
              <div className="schedule-phase">
                <span className="phase-weeks">Weeks 1-2</span>
                <span className="phase-exercises">Gap Detection + TOJ</span>
              </div>
              <div className="schedule-phase">
                <span className="phase-weeks">Weeks 3-4</span>
                <span className="phase-exercises">+ Duration Reproduction</span>
              </div>
              <div className="schedule-phase">
                <span className="phase-weeks">Weeks 5-6</span>
                <span className="phase-exercises">+ Pitch Discrimination</span>
              </div>
              <div className="schedule-phase">
                <span className="phase-weeks">Weeks 7-12</span>
                <span className="phase-exercises">All 5 exercises (full protocol)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
