import { useState, useCallback, useEffect, useRef } from 'react';
import { useExercise } from '../hooks/useExercise';
import { getAudioContext, playDichoticTOJSpatialTrial } from '../audio/audioEngine';
import {
  DICHOTIC_TOJ_STEPS,
  DICHOTIC_TOJ_TRIALS_PER_LEVEL,
  DICHOTIC_TOJ_ADVANCE_THRESHOLD,
  DICHOTIC_TOJ_RETREAT_THRESHOLD,
  DICHOTIC_TOJ_MAX_TRIALS,
  DICHOTIC_TOJ_MAX_TIME_MS,
} from '../utils/adaptive';
import { ConstrainedRandomizer } from '../utils/constrainedRandom';
import SessionComplete from './SessionComplete';

export default function DichoticTOJSpatial({ isBaseline = false, onComplete }) {
  const exercise = useExercise({
    exerciseType: 'dichotic_toj_spatial',
    steps: DICHOTIC_TOJ_STEPS,
    trialsPerLevel: DICHOTIC_TOJ_TRIALS_PER_LEVEL,
    advanceThreshold: DICHOTIC_TOJ_ADVANCE_THRESHOLD,
    retreatThreshold: DICHOTIC_TOJ_RETREAT_THRESHOLD,
    maxTrials: isBaseline ? DICHOTIC_TOJ_MAX_TRIALS : DICHOTIC_TOJ_MAX_TRIALS,
    maxTimeMs: isBaseline ? DICHOTIC_TOJ_MAX_TIME_MS : DICHOTIC_TOJ_MAX_TIME_MS,
    isBaseline,
  });

  const [actualOrder, setActualOrder] = useState(null); // 'left_first' or 'right_first'
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
    const leftFirst = randomizerRef.current.next();
    const order = leftFirst ? 'left_first' : 'right_first';
    setActualOrder(order);
    setIsPlaying(true);
    respondedRef.current = false;

    markStimulusStart();

    // Play the Dichotic TOJ Spatial stimulus (IDENTICAL 1000Hz tones to both ears)
    const result = playDichoticTOJSpatialTrial(leftFirst, config.value);

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
        if (e.key === 'l' || e.key === 'L' || e.key === '1') {
          handleResponse('left_first');
        } else if (e.key === 'r' || e.key === 'R' || e.key === '2') {
          handleResponse('right_first');
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
        exerciseType="dichotic_toj_spatial"
        exerciseLabel="Dichotic Temporal Order (Spatial)"
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
          {isBaseline ? '📊 Baseline: ' : ''}Dichotic TOJ (Spatial)
        </h2>
        <div className="exercise-meta">
          <span className="meta-pill">
            Trial {trialNumber + 1} / {DICHOTIC_TOJ_MAX_TRIALS}
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
        🎧 Headphones REQUIRED - This exercise tests spatial hearing
      </div>

      {/* Progress bar */}
      <div className="progress-track">
        <div
          className="progress-fill toj"
          style={{ width: `${(trialNumber / DICHOTIC_TOJ_MAX_TRIALS) * 100}%` }}
        />
      </div>

      {/* Level indicator */}
      <div className="level-steps">
        {DICHOTIC_TOJ_STEPS.map((step, i) => (
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
              <p>You'll hear <strong>two identical tones</strong> (1000Hz) in rapid succession—one to each ear.</p>
              <p><strong>Identify which EAR heard the tone first.</strong></p>
              <p className="research-note">
                ⚗️ Research-grade test: Uses identical frequencies to test pure hemispheric synchronization without pitch cues.
              </p>
              <div className="key-hints">
                <span><kbd>L</kbd> or <kbd>1</kbd> = Left ear first</span>
                <span><kbd>R</kbd> or <kbd>2</kbd> = Right ear first</span>
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
                <div className="tone-wave" />
                <span className="freq-label">1000Hz</span>
              </div>
              <div className="ear-indicator right">
                <span className="ear-label">R</span>
                <div className="tone-wave" />
                <span className="freq-label">1000Hz</span>
              </div>
            </div>
            <p className="stage-label">Listening...</p>
          </div>
        )}

        {phase === 'responding' && (
          <div className="stage-respond">
            <p className="stage-label">Which EAR heard the tone first?</p>
            <div className="response-buttons">
              <button
                className="btn-response btn-left"
                onClick={() => handleResponse('left_first')}
              >
                <span className="btn-icon">👂</span>
                <span>Left Ear First</span>
                <span className="btn-subtitle">1000Hz (Left)</span>
                <kbd>L</kbd>
              </button>
              <button
                className="btn-response btn-right"
                onClick={() => handleResponse('right_first')}
              >
                <span className="btn-icon">👂</span>
                <span>Right Ear First</span>
                <span className="btn-subtitle">1000Hz (Right)</span>
                <kbd>R</kbd>
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
