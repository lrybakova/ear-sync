import { useState, useCallback, useEffect, useRef } from 'react';
import { useExercise } from '../hooks/useExercise';
import { getAudioContext, playPitchSequence } from '../audio/audioEngine';
import {
  PITCH_STEPS,
  PITCH_TRIALS_PER_LEVEL,
  PITCH_ADVANCE_THRESHOLD,
  PITCH_RETREAT_THRESHOLD,
  PITCH_MAX_TRIALS,
  PITCH_MAX_TIME_MS,
  PITCH_BASE_FREQ,
  semitoneToFreq,
} from '../utils/adaptive';
import SessionComplete from './SessionComplete';

/**
 * Pitch Discrimination in Sequence Exercise
 * 3 reference tones + 1 target (higher or lower)
 * User identifies if target was higher or lower
 */
export default function PitchDiscrimination({ isBaseline = false, onComplete }) {
  const exercise = useExercise({
    exerciseType: 'pitch_discrimination',
    steps: PITCH_STEPS,
    trialsPerLevel: PITCH_TRIALS_PER_LEVEL,
    advanceThreshold: PITCH_ADVANCE_THRESHOLD,
    retreatThreshold: PITCH_RETREAT_THRESHOLD,
    maxTrials: PITCH_MAX_TRIALS,
    maxTimeMs: PITCH_MAX_TIME_MS,
    isBaseline,
  });

  const [direction, setDirection] = useState(null); // 'higher' or 'lower'
  const [isPlaying, setIsPlaying] = useState(false);
  const respondedRef = useRef(false);

  const {
    phase, currentValue, trialNumber, allTrials,
    lastResult, accuracy, levelAction, timeRemainingMs,
    startTrial, markStimulusStart, enableResponse,
    recordResponse, pause, resume, endSession, setPhase,
  } = exercise;

  const playStimulus = useCallback(() => {
    getAudioContext();
    const config = startTrial();
    if (!config) return;

    // Randomize: 50% higher, 50% lower
    const isHigher = Math.random() < 0.5;
    const dir = isHigher ? 'higher' : 'lower';
    setDirection(dir);
    setIsPlaying(true);
    respondedRef.current = false;

    // Calculate target frequency
    const semitones = isHigher ? config.value : -config.value;
    const targetFreq = semitoneToFreq(PITCH_BASE_FREQ, semitones);

    markStimulusStart();

    const { totalDurationMs } = playPitchSequence(PITCH_BASE_FREQ, targetFreq, 250, 250);

    // After sequence ends, enable response
    setTimeout(() => {
      setIsPlaying(false);
      enableResponse({
        direction: dir,
        semitoneDiff: config.value,
        targetFreqHz: Math.round(targetFreq * 10) / 10,
      });
    }, totalDurationMs + 100);
  }, [startTrial, markStimulusStart, enableResponse]);

  const handleResponse = useCallback(
    (response) => {
      if (phase !== 'responding' || respondedRef.current) return;
      respondedRef.current = true;
      recordResponse(response, direction);
    },
    [phase, direction, recordResponse]
  );

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'ready') playStimulus();
      }
      if (phase === 'responding') {
        if (e.key === 'h' || e.key === 'H' || e.key === '1' || e.key === 'ArrowUp') {
          handleResponse('higher');
        } else if (e.key === 'l' || e.key === 'L' || e.key === '2' || e.key === 'ArrowDown') {
          handleResponse('lower');
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, playStimulus, handleResponse]);

  // Auto-start next trial
  useEffect(() => {
    if (phase === 'ready' && trialNumber > 0) {
      const timer = setTimeout(() => playStimulus(), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, trialNumber, playStimulus]);

  const minutes = Math.floor(timeRemainingMs / 60000);
  const seconds = Math.floor((timeRemainingMs % 60000) / 1000);

  // Display the current semitone diff nicely
  const diffLabel = currentValue >= 1
    ? `${currentValue} ST`
    : `${Math.round(currentValue * 100)} cents`;

  if (phase === 'complete') {
    return (
      <SessionComplete
        exerciseType="pitch_discrimination"
        exerciseLabel="Pitch Discrimination"
        trials={allTrials}
        accuracy={accuracy}
        finalThreshold={currentValue}
        isBaseline={isBaseline}
        onDone={onComplete}
        thresholdUnit=" ST"
      />
    );
  }

  return (
    <div className="exercise-container">
      <div className="exercise-header">
        <h2 className="exercise-title">
          {isBaseline ? '📊 Baseline: ' : ''}Pitch Discrimination
        </h2>
        <div className="exercise-meta">
          <span className="meta-pill">
            Trial {trialNumber + 1} / {PITCH_MAX_TRIALS}
          </span>
          <span className="meta-pill">
            Diff: {diffLabel}
          </span>
          <span className="meta-pill">
            {Math.round(accuracy * 100)}% accurate
          </span>
          <span className="meta-pill timer">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill pitch"
          style={{ width: `${(trialNumber / PITCH_MAX_TRIALS) * 100}%` }}
        />
      </div>

      {/* Level indicator */}
      <div className="level-steps">
        {PITCH_STEPS.map((step, i) => (
          <div
            key={step}
            className={`level-dot ${i === exercise.currentStepIndex ? 'active' : ''} ${i < exercise.currentStepIndex ? 'passed' : ''}`}
            title={`${step} ST`}
          >
            <span className="level-label">{step >= 1 ? step : `${Math.round(step * 100)}c`}</span>
          </div>
        ))}
      </div>

      <div className="exercise-stage">
        {phase === 'ready' && trialNumber === 0 && (
          <div className="stage-prompt">
            <div className="instruction-card">
              <h3>How it works</h3>
              <p>You'll hear <strong>4 tones</strong> in sequence. The first 3 are all the same pitch (440Hz reference).</p>
              <p>The 4th tone is slightly <strong>higher</strong> or <strong>lower</strong>. Your job is to identify which.</p>
              <div className="key-hints">
                <span><kbd>H</kbd> or <kbd>↑</kbd> = Higher</span>
                <span><kbd>L</kbd> or <kbd>↓</kbd> = Lower</span>
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
            <div className="pitch-visualizer">
              <div className="pitch-sequence">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className={`pitch-dot ${n === 4 ? 'target' : 'reference'}`}>
                    <span>{n === 4 ? '?' : '♪'}</span>
                  </div>
                ))}
              </div>
            </div>
            <p className="stage-label">Listening to sequence...</p>
          </div>
        )}

        {phase === 'responding' && (
          <div className="stage-respond">
            <p className="stage-label">Was the 4th tone higher or lower?</p>
            <div className="response-buttons">
              <button
                className="btn-response btn-higher"
                onClick={() => handleResponse('higher')}
              >
                <span className="btn-icon">↑</span>
                <span>Higher</span>
                <kbd>H</kbd>
              </button>
              <button
                className="btn-response btn-lower"
                onClick={() => handleResponse('lower')}
              >
                <span className="btn-icon">↓</span>
                <span>Lower</span>
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
                {levelAction === 'advance' ? '⬆ Level up! Pitch difference decreased' : '⬇ Pitch difference increased'}
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

      {(phase !== 'ready' || trialNumber > 0) && (
        <div className="exercise-controls">
          {phase !== 'paused' && phase !== 'complete' && (
            <button className="btn-secondary" onClick={pause}>Pause</button>
          )}
          <button className="btn-ghost" onClick={endSession}>End Session</button>
        </div>
      )}
    </div>
  );
}
