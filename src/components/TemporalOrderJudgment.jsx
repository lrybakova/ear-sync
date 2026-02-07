import { useState, useCallback, useEffect, useRef } from 'react';
import { useExercise } from '../hooks/useExercise';
import { getAudioContext, playTOJTrial } from '../audio/audioEngine';
import {
  TOJ_STEPS,
  TOJ_TRIALS_PER_LEVEL,
  TOJ_ADVANCE_THRESHOLD,
  TOJ_RETREAT_THRESHOLD,
  TOJ_MAX_TRIALS,
  TOJ_MAX_TIME_MS,
} from '../utils/adaptive';
import { ConstrainedRandomizer } from '../utils/constrainedRandom';
import SessionComplete from './SessionComplete';

export default function TemporalOrderJudgment({ isBaseline = false, onComplete }) {
  const exercise = useExercise({
    exerciseType: 'temporal_order_judgment',
    steps: TOJ_STEPS,
    trialsPerLevel: TOJ_TRIALS_PER_LEVEL,
    advanceThreshold: TOJ_ADVANCE_THRESHOLD,
    retreatThreshold: TOJ_RETREAT_THRESHOLD,
    maxTrials: isBaseline ? TOJ_MAX_TRIALS : TOJ_MAX_TRIALS,
    maxTimeMs: isBaseline ? TOJ_MAX_TIME_MS : TOJ_MAX_TIME_MS,
    isBaseline,
  });

  const [actualOrder, setActualOrder] = useState(null); // 'high_first' or 'low_first'
  const [isPlaying, setIsPlaying] = useState(false);
  const respondedRef = useRef(false);
  const randomizerRef = useRef(new ConstrainedRandomizer());

  const {
    phase, currentValue, trialNumber, allTrials,
    lastResult, accuracy, levelAction, timeRemainingMs,
    startTrial, markStimulusStart, enableResponse,
    recordResponse, pause, resume, endSession, setPhase,
  } = exercise;

  // Reset randomizer at session start
  useEffect(() => {
    if (trialNumber === 0 && phase === 'ready') {
      randomizerRef.current.reset();
    }
  }, [trialNumber, phase]);

  // Play the audio stimulus
  const playStimulus = useCallback(() => {
    getAudioContext(); // Ensure context is running

    const config = startTrial();
    if (!config) return;

    // Use constrained randomization: max 2 consecutive identical trials
    const highFirst = randomizerRef.current.next();
    const order = highFirst ? 'high_first' : 'low_first';
    setActualOrder(order);
    setIsPlaying(true);
    respondedRef.current = false;

    markStimulusStart();

    // Play the TOJ stimulus
    const result = playTOJTrial(highFirst, config.value);

    // After both tones finish, enable response
    const totalDuration = result.totalDurationMs + 100; // small buffer
    setTimeout(() => {
      setIsPlaying(false);
      enableResponse({ order, soaMs: config.value });
    }, totalDuration);
  }, [startTrial, markStimulusStart, enableResponse]);

  // Handle user response
  const handleResponse = useCallback(
    (response) => {
      if (phase !== 'responding' || respondedRef.current) return;
      respondedRef.current = true;
      recordResponse(response, actualOrder);
    },
    [phase, actualOrder, recordResponse]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'ready') {
          playStimulus();
        }
      }
      if (phase === 'responding') {
        if (e.key === 'h' || e.key === 'H' || e.key === '1') {
          handleResponse('high_first');
        } else if (e.key === 'l' || e.key === 'L' || e.key === '2') {
          handleResponse('low_first');
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, playStimulus, handleResponse]);

  // Auto-start next trial after feedback
  useEffect(() => {
    if (phase === 'ready' && trialNumber > 0) {
      const timer = setTimeout(() => playStimulus(), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, trialNumber, playStimulus]);

  const minutes = Math.floor(timeRemainingMs / 60000);
  const seconds = Math.floor((timeRemainingMs % 60000) / 1000);

  if (phase === 'complete') {
    return (
      <SessionComplete
        exerciseType="temporal_order_judgment"
        exerciseLabel="Temporal Order Judgment"
        trials={allTrials}
        accuracy={accuracy}
        finalThreshold={currentValue}
        isBaseline={isBaseline}
        onDone={onComplete}
      />
    );
  }

  return (
    <div className="exercise-container">
      <div className="exercise-header">
        <h2 className="exercise-title">
          {isBaseline ? '📊 Baseline: ' : ''}Temporal Order Judgment
        </h2>
        <div className="exercise-meta">
          <span className="meta-pill">
            Trial {trialNumber + 1} / {TOJ_MAX_TRIALS}
          </span>
          <span className="meta-pill">
            SOA: {currentValue}ms
          </span>
          <span className="meta-pill">
            {Math.round(accuracy * 100)}% accurate
          </span>
          <span className="meta-pill timer">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Headphone warning */}
      <div className="headphone-notice">
        🎧 Headphones required for this exercise
      </div>

      {/* Progress bar */}
      <div className="progress-track">
        <div
          className="progress-fill toj"
          style={{ width: `${(trialNumber / TOJ_MAX_TRIALS) * 100}%` }}
        />
      </div>

      {/* Level indicator */}
      <div className="level-steps">
        {TOJ_STEPS.map((step, i) => (
          <div
            key={step}
            className={`level-dot ${i === exercise.currentStepIndex ? 'active' : ''} ${i < exercise.currentStepIndex ? 'passed' : ''}`}
            title={`${step}ms`}
          >
            <span className="level-label">{step}</span>
          </div>
        ))}
      </div>

      {/* Main exercise area */}
      <div className="exercise-stage">
        {phase === 'ready' && trialNumber === 0 && (
          <div className="stage-prompt">
            <div className="instruction-card">
              <h3>How it works</h3>
              <p>You'll hear two tones in quick succession: a <strong>high tone</strong> (1000Hz, right ear) and a <strong>low tone</strong> (500Hz, left ear).</p>
              <p>Tell us which tone you heard <strong>first</strong>.</p>
              <div className="key-hints">
                <span><kbd>H</kbd> or <kbd>1</kbd> = High tone first</span>
                <span><kbd>L</kbd> or <kbd>2</kbd> = Low tone first</span>
              </div>
            </div>
            <button className="btn-primary btn-large" onClick={playStimulus}>
              Start Exercise
            </button>
          </div>
        )}

        {phase === 'ready' && trialNumber > 0 && (
          <div className="stage-active">
            <div className="next-trial-indicator">
              <div className="pulse-dot" />
            </div>
            <p className="stage-label">Next trial...</p>
          </div>
        )}

        {phase === 'playing' && (
          <div className="stage-active">
            <div className="toj-visualizer">
              <div className="ear-indicator left">
                <span className="ear-label">L</span>
                <div className="tone-wave low" />
                <span className="freq-label">500Hz</span>
              </div>
              <div className="ear-indicator right">
                <span className="ear-label">R</span>
                <div className="tone-wave high" />
                <span className="freq-label">1000Hz</span>
              </div>
            </div>
            <p className="stage-label">Listening...</p>
          </div>
        )}

        {phase === 'responding' && (
          <div className="stage-respond">
            <p className="stage-label">Which tone came first?</p>
            <div className="response-buttons">
              <button
                className="btn-response btn-high"
                onClick={() => handleResponse('high_first')}
              >
                <span className="btn-icon">♪</span>
                <span>High Tone First</span>
                <span className="btn-subtitle">1000Hz (Right)</span>
                <kbd>H</kbd>
              </button>
              <button
                className="btn-response btn-low"
                onClick={() => handleResponse('low_first')}
              >
                <span className="btn-icon">♫</span>
                <span>Low Tone First</span>
                <span className="btn-subtitle">500Hz (Left)</span>
                <kbd>L</kbd>
              </button>
            </div>
          </div>
        )}

        {phase === 'feedback' && lastResult && (
          <div className={`stage-feedback ${lastResult.correct ? 'correct' : 'incorrect'}`}>
            <div className="feedback-icon">
              {lastResult.correct ? '✓' : '✗'}
            </div>
            <p className="feedback-text">
              {lastResult.correct ? 'Correct!' : 'Incorrect'}
            </p>
            <p className="feedback-detail">
              {lastResult.reactionTimeMs}ms reaction time
            </p>
            {levelAction && levelAction !== 'stay' && (
              <p className="level-change">
                {levelAction === 'advance' ? '⬆ Level up! SOA decreased' : '⬇ SOA increased'}
              </p>
            )}
          </div>
        )}

        {phase === 'paused' && (
          <div className="stage-paused">
            <h3>Paused</h3>
            <button className="btn-primary" onClick={resume}>Resume</button>
          </div>
        )}
      </div>

      {/* Controls */}
      {phase !== 'ready' || trialNumber > 0 ? (
        <div className="exercise-controls">
          {phase !== 'paused' && phase !== 'complete' && (
            <button className="btn-secondary" onClick={pause}>Pause</button>
          )}
          <button className="btn-ghost" onClick={endSession}>End Session</button>
        </div>
      ) : null}
    </div>
  );
}
