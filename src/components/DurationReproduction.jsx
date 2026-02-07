import { useState, useCallback, useEffect, useRef } from 'react';
import { generateUUID } from '../utils/uuid';
import { useBeforeUnload } from '../hooks/useBeforeUnload';
import {
  getAudioContext,
  playReferenceTone,
  startSustainedTone,
  playTone,
} from '../audio/audioEngine';
import {
  DURATION_LEVELS,
  DURATION_TRIALS_PER_LEVEL,
  DURATION_TOTAL_TRIALS,
  DURATION_PASS_ACCURACY,
  DURATION_MAX_TIME_MS,
  calculateDurationAccuracy,
  getDurationRating,
  generateDurationTrialOrder,
} from '../utils/adaptive';
import { saveSession, saveTrial } from '../utils/storage';
import { getBenchmarkSummary } from '../utils/benchmarks';

/**
 * Duration Reproduction Exercise
 * User listens to a tone, then holds spacebar to reproduce its duration
 */
export default function DurationReproduction({ isBaseline = false, onComplete }) {
  const [phase, setPhase] = useState('ready');
  // ready | listening | delay | reproducing | feedback | paused | complete
  const [trialOrder, setTrialOrder] = useState(() =>
    generateDurationTrialOrder(DURATION_LEVELS, DURATION_TRIALS_PER_LEVEL)
  );
  const [trialIndex, setTrialIndex] = useState(0);
  const [allTrials, setAllTrials] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [sessionId] = useState(() => generateUUID());
  const [sessionStartTime] = useState(() => Date.now());
  const [holdProgress, setHoldProgress] = useState(0); // 0-1 for visual feedback
  const [userDuration, setUserDuration] = useState(0);

  const sustainedToneRef = useRef(null);
  const holdStartRef = useRef(0);
  const animFrameRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);

  // Warn before leaving page mid-session
  useBeforeUnload(trialIndex > 0 && phase !== 'complete');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const currentTarget = trialOrder[trialIndex];
  const elapsed = Date.now() - sessionStartTime;
  const timeRemainingMs = Math.max(0, DURATION_MAX_TIME_MS - elapsed);
  const minutes = Math.floor(timeRemainingMs / 60000);
  const seconds = Math.floor((timeRemainingMs % 60000) / 1000);

  const overallAccuracy = allTrials.length > 0
    ? allTrials.reduce((sum, t) => sum + t.accuracyPercent, 0) / allTrials.length
    : 0;

  // Play the reference tone and advance to reproduction phase
  const playStimulus = useCallback(async () => {
    if (trialIndex >= trialOrder.length || elapsed >= DURATION_MAX_TIME_MS) {
      setPhase('complete');
      return;
    }

    getAudioContext();
    setPhase('listening');
    setLastResult(null);
    setHoldProgress(0);
    setUserDuration(0);

    const target = trialOrder[trialIndex];

    // Play the reference tone
    await playReferenceTone(440, target);

    // 500ms delay
    setPhase('delay');
    setTimeout(() => {
      setPhase('reproducing');
    }, 500);
  }, [trialIndex, trialOrder, elapsed]);

  // --- Shared hold start/stop logic (used by keyboard AND touch) ---

  const beginHold = useCallback(() => {
    if (phase !== 'reproducing' || sustainedToneRef.current) return;
    getAudioContext();
    sustainedToneRef.current = startSustainedTone(440);
    holdStartRef.current = performance.now();

    const maxDisplay = Math.min(currentTarget * 2, 3000);
    const animate = () => {
      const held = performance.now() - holdStartRef.current;
      setHoldProgress(Math.min(1, held / maxDisplay));
      setUserDuration(Math.round(held));
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
  }, [phase, currentTarget]);

  const endHold = useCallback(() => {
    if (phase !== 'reproducing' || !sustainedToneRef.current) return;

    const heldMs = sustainedToneRef.current.stop();
    sustainedToneRef.current = null;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const target = trialOrder[trialIndex];
    const accuracy = calculateDurationAccuracy(target, heldMs);
    const rating = getDurationRating(accuracy);

    const trial = {
      exerciseType: 'duration_reproduction',
      timestamp: Date.now(),
      targetDurationMs: target,
      userDurationMs: heldMs,
      accuracyPercent: Math.round(accuracy),
      rating,
      trialNumber: trialIndex + 1,
      sessionId,
    };

    saveTrial(trial);
    const newAllTrials = [...allTrials, trial];
    setAllTrials(newAllTrials);
    setLastResult(trial);
    setUserDuration(heldMs);
    setPhase('feedback');

    feedbackTimeoutRef.current = setTimeout(() => {
      const nextIndex = trialIndex + 1;
      const newElapsed = Date.now() - sessionStartTime;

      if (nextIndex >= trialOrder.length || newElapsed >= DURATION_MAX_TIME_MS) {
        const avgAccuracy = newAllTrials.reduce((s, t) => s + t.accuracyPercent, 0) / newAllTrials.length;
        saveSession({
          sessionId,
          exerciseType: 'duration_reproduction',
          timestamp: Date.now(),
          startTime: sessionStartTime,
          duration: newElapsed,
          trialsCompleted: newAllTrials.length,
          overallAccuracy: avgAccuracy / 100,
          finalThreshold: Math.round(avgAccuracy),
          finalStepIndex: 0,
          averageReactionTimeMs: 0,
          isBaseline,
        });
        setPhase('complete');
      } else {
        setTrialIndex(nextIndex);
        setPhase('ready');
      }
    }, 2500);
  }, [phase, trialIndex, trialOrder, allTrials, sessionId, sessionStartTime, isBaseline]);

  // --- Keyboard handlers ---

  const handleKeyDown = useCallback((e) => {
    if (e.repeat) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (phase === 'ready' && trialIndex === 0) {
        playStimulus();
        return;
      }
      beginHold();
    }
  }, [phase, trialIndex, playStimulus, beginHold]);

  const handleKeyUp = useCallback((e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      endHold();
    }
  }, [endHold]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // --- Touch handlers for the hold button (mobile) ---

  const handleTouchStart = useCallback((e) => {
    e.preventDefault(); // prevent scroll / long-press menu
    beginHold();
  }, [beginHold]);

  const handleTouchEnd = useCallback((e) => {
    e.preventDefault();
    endHold();
  }, [endHold]);

  // Auto-start next trial
  useEffect(() => {
    if (phase === 'ready' && trialIndex > 0) {
      const timer = setTimeout(() => playStimulus(), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, trialIndex, playStimulus]);

  // Replay comparison in feedback
  const replayComparison = useCallback(async () => {
    if (!lastResult) return;
    getAudioContext();
    await playReferenceTone(440, lastResult.targetDurationMs);
    setTimeout(() => {
      playTone(440, lastResult.userDurationMs, 0, 0);
    }, 300);
  }, [lastResult]);

  const endSession = useCallback(() => {
    if (allTrials.length > 0) {
      const avgAccuracy = allTrials.reduce((s, t) => s + t.accuracyPercent, 0) / allTrials.length;
      saveSession({
        sessionId,
        exerciseType: 'duration_reproduction',
        timestamp: Date.now(),
        startTime: sessionStartTime,
        duration: Date.now() - sessionStartTime,
        trialsCompleted: allTrials.length,
        overallAccuracy: avgAccuracy / 100,
        finalThreshold: Math.round(avgAccuracy),
        finalStepIndex: 0,
        averageReactionTimeMs: 0,
        isBaseline,
        earlyEnd: true,
      });
    }
    setPhase('complete');
  }, [allTrials, sessionId, sessionStartTime, isBaseline]);

  if (phase === 'complete') {
    const avgAcc = allTrials.length > 0
      ? Math.round(allTrials.reduce((s, t) => s + t.accuracyPercent, 0) / allTrials.length)
      : 0;
    const mastered = DURATION_LEVELS.filter(d => {
      const trials = allTrials.filter(t => t.targetDurationMs === d);
      if (trials.length === 0) return false;
      const avg = trials.reduce((s, t) => s + t.accuracyPercent, 0) / trials.length;
      return avg >= DURATION_PASS_ACCURACY * 100;
    });

    return (
      <div className="session-complete">
        <div className="complete-header">
          <div className="complete-icon">🎉</div>
          <h2>{isBaseline ? 'Baseline Complete!' : 'Session Complete!'}</h2>
          <p className="complete-subtitle">Duration Reproduction</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card highlight">
            <span className="stat-value">{avgAcc}%</span>
            <span className="stat-label">Avg Accuracy</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{allTrials.length}</span>
            <span className="stat-label">Trials</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{mastered.length}/{DURATION_LEVELS.length}</span>
            <span className="stat-label">Mastered</span>
          </div>
        </div>

        {/* Per-duration breakdown */}
        <div className="duration-breakdown">
          {DURATION_LEVELS.map(d => {
            const trials = allTrials.filter(t => t.targetDurationMs === d);
            if (trials.length === 0) return null;
            const avg = Math.round(trials.reduce((s, t) => s + t.accuracyPercent, 0) / trials.length);
            const rating = getDurationRating(avg);
            return (
              <div key={d} className={`duration-row rating-${rating}`}>
                <span className="duration-target">{d}ms</span>
                <div className="duration-bar-track">
                  <div className="duration-bar-fill" style={{ width: `${avg}%` }} />
                </div>
                <span className="duration-acc">{avg}%</span>
              </div>
            );
          })}
        </div>

        {/* Research Benchmark */}
        {(() => {
          const benchmark = getBenchmarkSummary('duration_reproduction', avgAcc);
          if (!benchmark) return null;
          return (
            <div className="benchmark-card">
              <div className="benchmark-header">
                <span className="benchmark-dot" style={{ background: benchmark.color }} />
                <span className="benchmark-text" style={{ color: benchmark.color }}>
                  {benchmark.text}
                </span>
              </div>
              <p className="benchmark-detail">{benchmark.detail}</p>
              {benchmark.note && (
                <p className="benchmark-note">{benchmark.note}</p>
              )}
              {benchmark.sourceUrl && (
                <a className="benchmark-source" href={benchmark.sourceUrl} target="_blank" rel="noopener noreferrer">
                  View research →
                </a>
              )}
            </div>
          );
        })()}

        {isBaseline && (
          <div className="baseline-note">
            <p>Baseline recorded! This is your starting point for duration reproduction.</p>
          </div>
        )}

        <button className="btn-primary btn-large" onClick={onComplete}>
          {isBaseline ? 'Continue' : 'Back to Dashboard'}
        </button>
      </div>
    );
  }

  return (
    <div className="exercise-container">
      <div className="exercise-header">
        <h2 className="exercise-title">
          {isBaseline ? '📊 Baseline: ' : ''}Duration Reproduction
        </h2>
        <div className="exercise-meta">
          <span className="meta-pill">
            Trial {trialIndex + 1} / {trialOrder.length}
          </span>
          <span className="meta-pill">
            Target: {currentTarget}ms
          </span>
          <span className="meta-pill">
            {Math.round(overallAccuracy)}% avg
          </span>
          <span className="meta-pill timer">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill duration"
          style={{ width: `${(trialIndex / trialOrder.length) * 100}%` }}
        />
      </div>

      <div className="exercise-stage">
        {phase === 'ready' && trialIndex === 0 && (
          <div className="stage-prompt">
            <div className="instruction-card">
              <h3>How it works</h3>
              <p>1. You'll hear a reference tone for a specific duration.</p>
              <p>2. After a short pause, <strong>hold SPACE</strong> (or press & hold the circle on mobile) to reproduce that same duration.</p>
              <p>3. Release when you think you've matched the length!</p>
              <div className="key-hints">
                <span><kbd>SPACE</kbd> Hold to reproduce duration</span>
              </div>
            </div>
            <button className="btn-primary btn-large" onClick={playStimulus}>
              Start Exercise
            </button>
          </div>
        )}

        {phase === 'ready' && trialIndex > 0 && (
          <div className="stage-active">
            <div className="next-trial-indicator">
              <div className="pulse-dot" />
            </div>
            <p className="stage-label">Next trial...</p>
          </div>
        )}

        {phase === 'listening' && (
          <div className="stage-active">
            <div className="duration-circle listening">
              <div className="duration-ring" />
              <span className="duration-label">Listen</span>
              <span className="duration-ms">{currentTarget}ms</span>
            </div>
            <p className="stage-label">Listening to reference tone...</p>
          </div>
        )}

        {phase === 'delay' && (
          <div className="stage-active">
            <div className="duration-circle waiting">
              <span className="duration-label">Get ready...</span>
            </div>
            <p className="stage-label">Hold SPACE to reproduce</p>
          </div>
        )}

        {phase === 'reproducing' && (
          <div className="stage-respond">
            <div
              className={`duration-circle reproducing ${sustainedToneRef.current ? 'holding' : ''}`}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
              onMouseDown={beginHold}
              onMouseUp={endHold}
              onMouseLeave={() => { if (sustainedToneRef.current) endHold(); }}
              role="button"
              tabIndex={0}
              aria-label="Hold to reproduce duration"
            >
              <svg className="progress-ring" viewBox="0 0 120 120">
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth="6"
                />
                <circle
                  cx="60" cy="60" r="54"
                  fill="none"
                  stroke="url(#durGrad)"
                  strokeWidth="6"
                  strokeDasharray={`${holdProgress * 339.3} 339.3`}
                  strokeLinecap="round"
                  transform="rotate(-90 60 60)"
                />
                <defs>
                  <linearGradient id="durGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="duration-center-text">
                <span className="duration-ms-live">{userDuration}ms</span>
              </div>
            </div>
            <p className="stage-label">
              {sustainedToneRef.current
                ? 'Holding... release when ready!'
                : 'Hold SPACE or press & hold the circle'}
            </p>
          </div>
        )}

        {phase === 'feedback' && lastResult && (
          <div className={`stage-feedback duration-feedback rating-${lastResult.rating}`}>
            <div className="feedback-icon duration-icon">
              {lastResult.rating === 'green' ? '✓' : lastResult.rating === 'yellow' ? '~' : '✗'}
            </div>
            <div className="duration-comparison">
              <div className="dur-compare-row">
                <span className="dur-label">Target:</span>
                <div className="dur-bar target" style={{ width: `${Math.min(100, (lastResult.targetDurationMs / 2000) * 100)}%` }} />
                <span className="dur-value">{lastResult.targetDurationMs}ms</span>
              </div>
              <div className="dur-compare-row">
                <span className="dur-label">You:</span>
                <div className="dur-bar user" style={{ width: `${Math.min(100, (lastResult.userDurationMs / 2000) * 100)}%` }} />
                <span className="dur-value">{lastResult.userDurationMs}ms</span>
              </div>
            </div>
            <p className="feedback-text">
              {lastResult.accuracyPercent}% accurate
            </p>
            <button className="btn-ghost btn-sm" onClick={replayComparison}>
              Replay comparison
            </button>
          </div>
        )}

        {phase === 'paused' && (
          <div className="stage-paused">
            <h3>Paused</h3>
            <button className="btn-primary" onClick={() => setPhase('ready')}>Resume</button>
          </div>
        )}
      </div>

      {(phase !== 'ready' || trialIndex > 0) && (
        <div className="exercise-controls">
          {phase !== 'paused' && phase !== 'complete' && (
            <button className="btn-secondary" onClick={() => {
              if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
              setPhase('paused');
            }}>Pause</button>
          )}
          <button className="btn-ghost" onClick={endSession}>End Session</button>
        </div>
      )}
    </div>
  );
}
