import { useState, useCallback, useEffect, useRef } from 'react';
import { useExercise } from '../hooks/useExercise';
import {
  getAudioContext,
  createGappedNoiseBuffer,
  createContinuousNoiseBuffer,
  playBuffer,
} from '../audio/audioEngine';
import {
  GAP_STEPS,
  GAP_TRIALS_PER_LEVEL,
  GAP_ADVANCE_THRESHOLD,
  GAP_RETREAT_THRESHOLD,
  GAP_MAX_TRIALS,
  GAP_MAX_TIME_MS,
} from '../utils/adaptive';
import { ConstrainedRandomizer } from '../utils/constrainedRandom';
import SessionComplete from './SessionComplete';

export default function GapDetection({ isBaseline = false, onComplete }) {
  const exercise = useExercise({
    exerciseType: 'gap_detection',
    steps: GAP_STEPS,
    trialsPerLevel: GAP_TRIALS_PER_LEVEL,
    advanceThreshold: GAP_ADVANCE_THRESHOLD,
    retreatThreshold: GAP_RETREAT_THRESHOLD,
    maxTrials: isBaseline ? GAP_MAX_TRIALS : GAP_MAX_TRIALS,
    maxTimeMs: isBaseline ? GAP_MAX_TIME_MS : GAP_MAX_TIME_MS,
    isBaseline,
  });

  const [hasGap, setHasGap] = useState(false);
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
    const gapPresent = randomizerRef.current.next();
    setHasGap(gapPresent);
    setIsPlaying(true);
    respondedRef.current = false;

    // Create and play appropriate buffer
    const buffer = gapPresent
      ? createGappedNoiseBuffer(500, config.value)
      : createContinuousNoiseBuffer(500);

    const source = playBuffer(buffer);

    markStimulusStart();

    // After audio ends, enable response
    source.onended = () => {
      setIsPlaying(false);
      enableResponse({ gapPresent, gapDurationMs: gapPresent ? config.value : 0 });
    };
  }, [startTrial, markStimulusStart, enableResponse]);

  // Handle user response
  const handleResponse = useCallback(
    (detected) => {
      if (phase !== 'responding' || respondedRef.current) return;
      respondedRef.current = true;
      const userResponse = detected ? 'detected' : 'not_detected';
      const correctAnswer = hasGap ? 'detected' : 'not_detected';
      recordResponse(userResponse, correctAnswer);
    },
    [phase, hasGap, recordResponse]
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
        if (e.key === 'y' || e.key === 'Y' || e.key === '1') {
          handleResponse(true);
        } else if (e.key === 'n' || e.key === 'N' || e.key === '2') {
          handleResponse(false);
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
        exerciseType="gap_detection"
        exerciseLabel="Gap Detection"
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
          {isBaseline ? '📊 Baseline: ' : ''}Gap Detection
        </h2>
        <div className="exercise-meta">
          <span className="meta-pill">
            Trial {trialNumber + 1} / {GAP_MAX_TRIALS}
          </span>
          <span className="meta-pill">
            Gap: {currentValue}ms
          </span>
          <span className="meta-pill">
            {Math.round(accuracy * 100)}% accurate
          </span>
          <span className="meta-pill timer">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${(trialNumber / GAP_MAX_TRIALS) * 100}%` }}
        />
      </div>

      {/* Level indicator */}
      <div className="level-steps">
        {GAP_STEPS.map((step, i) => (
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
              <p>You'll hear a burst of white noise. Sometimes it will contain a tiny silent gap in the middle.</p>
              <p>After each sound, tell us if you heard a gap or not.</p>
              <div className="key-hints">
                <span><kbd>Y</kbd> or <kbd>1</kbd> = Gap detected</span>
                <span><kbd>N</kbd> or <kbd>2</kbd> = No gap</span>
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
            <div className="audio-visualizer">
              <div className="wave-animation">
                {[...Array(12)].map((_, i) => (
                  <div key={i} className="wave-bar" style={{ animationDelay: `${i * 0.05}s` }} />
                ))}
              </div>
            </div>
            <p className="stage-label">Listening...</p>
          </div>
        )}

        {phase === 'responding' && (
          <div className="stage-respond">
            <p className="stage-label">Did you hear a gap?</p>
            <div className="response-buttons">
              <button
                className="btn-response btn-yes"
                onClick={() => handleResponse(true)}
              >
                <span className="btn-icon">✓</span>
                <span>Gap Detected</span>
                <kbd>Y</kbd>
              </button>
              <button
                className="btn-response btn-no"
                onClick={() => handleResponse(false)}
              >
                <span className="btn-icon">✗</span>
                <span>No Gap</span>
                <kbd>N</kbd>
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
                {levelAction === 'advance' ? '⬆ Level up! Gap decreased' : '⬇ Gap increased'}
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
