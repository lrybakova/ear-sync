import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
  getThresholdHistory,
  getTotalSessionCount,
  getStreak,
  getLatestThreshold,
  getBaselines,
} from '../utils/storage';

export default function Dashboard() {
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const gapHistory = getThresholdHistory('gap_detection');
    const tojHistory = getThresholdHistory('temporal_order_judgment');
    const totalSessions = getTotalSessionCount();
    const streak = getStreak();
    const gapThreshold = getLatestThreshold('gap_detection');
    const tojThreshold = getLatestThreshold('temporal_order_judgment');
    const baselines = getBaselines();

    return {
      gapHistory,
      tojHistory,
      totalSessions,
      streak,
      gapThreshold,
      tojThreshold,
      baselines,
      hasGapBaseline: !!baselines.gapDetection,
      hasTojBaseline: !!baselines.temporalOrderJudgment,
    };
  }, []);

  const targetSessions = 36;
  const progressPercent = Math.min(100, (stats.totalSessions / targetSessions) * 100);

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
          <span className="stat-detail">{targetSessions - stats.totalSessions} to goal</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.streak}</span>
          <span className="stat-label">Day Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {stats.gapThreshold ? `${stats.gapThreshold}ms` : '—'}
          </span>
          <span className="stat-label">Gap Threshold</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">
            {stats.tojThreshold ? `${stats.tojThreshold}ms` : '—'}
          </span>
          <span className="stat-label">TOJ Threshold</span>
        </div>
      </div>

      {/* Exercise Cards */}
      <div className="exercise-cards">
        <div className="exercise-card gap-card">
          <div className="card-header">
            <div className="card-icon">〰️</div>
            <h3>Gap Detection</h3>
          </div>
          <p className="card-description">
            Detect silent gaps in white noise. Trains temporal resolution.
          </p>
          <div className="card-stats">
            {stats.gapThreshold && (
              <span>Current: {stats.gapThreshold}ms</span>
            )}
            {stats.hasGapBaseline && (
              <span>Baseline: {stats.baselines.gapDetection.finalThreshold}ms</span>
            )}
          </div>
          <div className="card-actions">
            {!stats.hasGapBaseline ? (
              <button
                className="btn-primary"
                onClick={() => navigate('/baseline/gap')}
              >
                Run Baseline First
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => navigate('/exercise/gap')}
              >
                Start Training
              </button>
            )}
          </div>
        </div>

        <div className="exercise-card toj-card">
          <div className="card-header">
            <div className="card-icon">🎧</div>
            <h3>Temporal Order</h3>
          </div>
          <p className="card-description">
            Identify which tone came first. Trains hemispheric synchronization.
          </p>
          <div className="card-stats">
            {stats.tojThreshold && (
              <span>Current: {stats.tojThreshold}ms</span>
            )}
            {stats.hasTojBaseline && (
              <span>Baseline: {stats.baselines.temporalOrderJudgment.finalThreshold}ms</span>
            )}
          </div>
          <div className="card-actions">
            {!stats.hasTojBaseline ? (
              <button
                className="btn-primary"
                onClick={() => navigate('/baseline/toj')}
              >
                Run Baseline First
              </button>
            ) : (
              <button
                className="btn-primary"
                onClick={() => navigate('/exercise/toj')}
              >
                Start Training
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Progress Charts */}
      {(stats.gapHistory.length > 0 || stats.tojHistory.length > 0) && (
        <div className="charts-section">
          <h2 className="section-title">Progress</h2>

          {stats.gapHistory.length > 0 && (
            <div className="chart-card">
              <h3>Gap Detection Threshold</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.gapHistory}>
                  <defs>
                    <linearGradient id="gapGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} unit="ms" />
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
                    stroke="#6366f1"
                    fill="url(#gapGrad)"
                    strokeWidth={2}
                    dot={{ fill: '#6366f1', r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {stats.tojHistory.length > 0 && (
            <div className="chart-card">
              <h3>TOJ Threshold (SOA)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.tojHistory}>
                  <defs>
                    <linearGradient id="tojGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3e" />
                  <XAxis dataKey="date" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} unit="ms" />
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
                    stroke="#a855f7"
                    fill="url(#tojGrad)"
                    strokeWidth={2}
                    dot={{ fill: '#a855f7', r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Baseline info */}
      {!stats.hasGapBaseline && !stats.hasTojBaseline && (
        <div className="onboarding-card">
          <h3>Getting Started</h3>
          <p>Run a baseline measurement for each exercise first. This establishes your starting point so you can track improvement over time.</p>
          <div className="onboarding-steps">
            <div className={`step ${stats.hasGapBaseline ? 'done' : ''}`}>
              <span className="step-number">1</span>
              <span>Gap Detection Baseline (~15 min)</span>
            </div>
            <div className={`step ${stats.hasTojBaseline ? 'done' : ''}`}>
              <span className="step-number">2</span>
              <span>TOJ Baseline (~15 min)</span>
            </div>
            <div className="step">
              <span className="step-number">3</span>
              <span>Start daily training! (3-5x/week)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
