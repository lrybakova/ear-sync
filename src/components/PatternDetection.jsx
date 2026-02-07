import { useState, useCallback, useEffect, useRef } from 'react';
import { generateUUID } from '../utils/uuid';
import { getAudioContext, playPatternSequence } from '../audio/audioEngine';
import {
  PATTERN_LEVELS,
  PATTERN_TRIALS_PER_LEVEL,
  PATTERN_ADVANCE_THRESHOLD,
  PATTERN_RETREAT_THRESHOLD,
  PATTERN_MAX_TRIALS,
  PATTERN_MAX_TIME_MS,
  PATTERN_FREQS,
  PATTERN_TYPES,
  generatePattern,
  getPatternLevelConfig,
  getNextLevel,
  calculateAccuracy,
  shouldEndSession,
} from '../utils/adaptive';
import { saveSession, saveTrial } from '../utils/storage';

/**
 * Pattern Detection in Noise Exercise
 * Identify whether a tone sequence contains a pattern or is random
 * Optionally identify the pattern type
 */
export default function PatternDetection({ isBaseline = false, onComplete }) {
  const [phase, setPhase] = useState('ready');
  // ready | playing | responding | bonus | feedback | paused | complete
  const [currentLevelIndex, setCurrentLevelIndex] = useState(0);
  const [trialNumber, setTrialNumber] = useState(0);
  const [levelTrials, setLevelTrials] = useState([]);
  const [allTrials, setAllTrials] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [levelAction, setLevelAction] = useState(null);
  const [sessionId] = useState(() => generateUUID());
  const [sessionStartTime] = useState(() => Date.now());
  const [currentStimulus, setCurrentStimulus] = useState(null);

  const stimulusStartRef = useRef(0);
  const feedbackTimeoutRef = useRef(null);
  const respondedRef = useRef(false);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    };
  }, []);

  const currentLevel = PATTERN_LEVELS[currentLevelIndex];
  const elapsed = Date.now() - sessionStartTime;
  const timeRemainingMs = Math.max(0, PATTERN_MAX_TIME_MS - elapsed);
  const minutes = Math.floor(timeRemainingMs / 60000);
  const seconds = Math.floor((timeRemainingMs % 60000) / 1000);
  const overallAccuracy = allTrials.length > 0
    ? allTrials.filter(t => t.correct).length / allTrials.length
    : 0;

  const playStimulus = useCallback(() => {
    if (shouldEndSession(trialNumber, elapsed, PATTERN_MAX_TRIALS, PATTERN_MAX_TIME_MS)) {
      setPhase('complete');
      return;
    }

    getAudioContext();
    setPhase('playing');
    setLastResult(null);
    setLevelAction(null);
    respondedRef.current = false;

    const config = getPatternLevelConfig(currentLevel);

    // 60% pattern, 40% random
    const showPattern = Math.random() < 0.6;

    let patternResult;
    if (showPattern) {
      // Pick a random pattern type from this level's available types
      const pType = config.patternTypes[Math.floor(Math.random() * config.patternTypes.length)];
      patternResult = generatePattern(pType, config.toneCount, PATTERN_FREQS);
    } else {
      patternResult = generatePattern(PATTERN_TYPES.RANDOM, config.toneCount, PATTERN_FREQS);
    }

    stimulusStartRef.current = performance.now();

    const { totalDurationMs } = playPatternSequence(
      patternResult.sequence,
      150, // tone duration
      100, // ISI
      config.snrDb
    );

    const stimulus = {
      ...patternResult,
      level: currentLevel,
      snrDb: config.snrDb,
    };

    setTimeout(() => {
      setCurrentStimulus(stimulus);
      setPhase('responding');
    }, totalDurationMs + 150);
  }, [trialNumber, elapsed, currentLevel]);

  const handlePatternResponse = useCallback((response) => {
    if (phase !== 'responding' || respondedRef.current) return;
    respondedRef.current = true;

    const reactionTimeMs = Math.round(performance.now() - stimulusStartRef.current);
    const correctAnswer = currentStimulus.hasPattern ? 'pattern' : 'random';
    const correct = response === correctAnswer;

    // If user said "pattern" and was correct, go to bonus question
    if (response === 'pattern' && correct) {
      setPhase('bonus');
      // Store partial result for bonus
      setLastResult({
        userResponse: response,
        correctAnswer,
        correct,
        reactionTimeMs,
        bonusPending: true,
      });
      return;
    }

    finalizeTrial(response, correctAnswer, correct, reactionTimeMs, null);
  }, [phase, currentStimulus]);

  const handleBonusResponse = useCallback((patternGuess) => {
    if (!lastResult || !lastResult.bonusPending) return;

    // Check if pattern type guess is correct (simplified: check category)
    const actualType = currentStimulus.type;
    let bonusCategory;
    if (actualType === PATTERN_TYPES.REPEATING_AB || actualType === PATTERN_TYPES.REPEATING_ABC) {
      bonusCategory = 'repeating';
    } else if (actualType === PATTERN_TYPES.ASCENDING) {
      bonusCategory = 'ascending';
    } else if (actualType === PATTERN_TYPES.DESCENDING) {
      bonusCategory = 'descending';
    }

    const bonusCorrect = patternGuess === bonusCategory;

    finalizeTrial(
      lastResult.userResponse,
      lastResult.correctAnswer,
      lastResult.correct,
      lastResult.reactionTimeMs,
      { patternGuess, bonusCorrect, actualType: bonusCategory }
    );
  }, [lastResult, currentStimulus]);

  const finalizeTrial = useCallback((userResponse, correctAnswer, correct, reactionTimeMs, bonus) => {
    const trial = {
      exerciseType: 'pattern_detection',
      timestamp: Date.now(),
      trialNumber: trialNumber + 1,
      level: currentLevel,
      sequence: currentStimulus.sequence,
      patternType: currentStimulus.type,
      hasPattern: currentStimulus.hasPattern,
      snrDb: currentStimulus.snrDb,
      userResponse,
      correctAnswer,
      correct,
      reactionTimeMs,
      bonus,
      sessionId,
    };

    saveTrial(trial);
    const newLevelTrials = [...levelTrials, trial];
    const newAllTrials = [...allTrials, trial];

    setLastResult({ correct, reactionTimeMs, bonus });
    setAllTrials(newAllTrials);
    setLevelTrials(newLevelTrials);
    setTrialNumber(n => n + 1);
    setPhase('feedback');

    // Evaluate level change
    if (newLevelTrials.length >= PATTERN_TRIALS_PER_LEVEL) {
      const acc = calculateAccuracy(newLevelTrials, PATTERN_TRIALS_PER_LEVEL);
      const next = getNextLevel(
        PATTERN_LEVELS,
        currentLevelIndex,
        acc,
        PATTERN_ADVANCE_THRESHOLD,
        PATTERN_RETREAT_THRESHOLD
      );
      setCurrentLevelIndex(next.stepIndex);
      setLevelAction(next.action);
      setLevelTrials([]);
    }

    // Auto-advance
    feedbackTimeoutRef.current = setTimeout(() => {
      const newElapsed = Date.now() - sessionStartTime;
      if (shouldEndSession(trialNumber + 1, newElapsed, PATTERN_MAX_TRIALS, PATTERN_MAX_TIME_MS)) {
        const totalCorrect = newAllTrials.filter(t => t.correct).length;
        saveSession({
          sessionId,
          exerciseType: 'pattern_detection',
          timestamp: Date.now(),
          startTime: sessionStartTime,
          duration: newElapsed,
          trialsCompleted: newAllTrials.length,
          overallAccuracy: newAllTrials.length > 0 ? totalCorrect / newAllTrials.length : 0,
          finalThreshold: currentLevel,
          finalStepIndex: currentLevelIndex,
          averageReactionTimeMs: Math.round(
            newAllTrials.reduce((s, t) => s + t.reactionTimeMs, 0) / newAllTrials.length
          ),
          isBaseline,
        });
        setPhase('complete');
      } else {
        setPhase('ready');
      }
    }, 1800);
  }, [trialNumber, currentLevel, currentLevelIndex, currentStimulus, levelTrials, allTrials, sessionId, sessionStartTime, isBaseline]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (phase === 'ready') playStimulus();
      }
      if (phase === 'responding') {
        if (e.key === 'p' || e.key === 'P' || e.key === '1') handlePatternResponse('pattern');
        if (e.key === 'r' || e.key === 'R' || e.key === '2') handlePatternResponse('random');
      }
      if (phase === 'bonus') {
        if (e.key === 'a' || e.key === 'A' || e.key === '1') handleBonusResponse('ascending');
        if (e.key === 'd' || e.key === 'D' || e.key === '2') handleBonusResponse('descending');
        if (e.key === 'r' || e.key === 'R' || e.key === '3') handleBonusResponse('repeating');
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [phase, playStimulus, handlePatternResponse, handleBonusResponse]);

  // Auto-start next trial
  useEffect(() => {
    if (phase === 'ready' && trialNumber > 0) {
      const timer = setTimeout(() => playStimulus(), 500);
      return () => clearTimeout(timer);
    }
  }, [phase, trialNumber, playStimulus]);

  const endSession = useCallback(() => {
    if (allTrials.length > 0) {
      const totalCorrect = allTrials.filter(t => t.correct).length;
      saveSession({
        sessionId,
        exerciseType: 'pattern_detection',
        timestamp: Date.now(),
        startTime: sessionStartTime,
        duration: Date.now() - sessionStartTime,
        trialsCompleted: allTrials.length,
        overallAccuracy: allTrials.length > 0 ? totalCorrect / allTrials.length : 0,
        finalThreshold: currentLevel,
        finalStepIndex: currentLevelIndex,
        averageReactionTimeMs: Math.round(
          allTrials.reduce((s, t) => s + (t.reactionTimeMs || 0), 0) / allTrials.length
        ),
        isBaseline,
        earlyEnd: true,
      });
    }
    setPhase('complete');
  }, [allTrials, sessionId, sessionStartTime, currentLevel, currentLevelIndex, isBaseline]);

  // Frequency to note name helper
  const freqToNote = (f) => {
    const map = { 262: 'C', 330: 'E', 392: 'G', 494: 'B', 587: 'D' };
    return map[f] || '?';
  };

  if (phase === 'complete') {
    const totalCorrect = allTrials.filter(t => t.correct).length;
    const acc = allTrials.length > 0 ? totalCorrect / allTrials.length : 0;
    const avgRT = allTrials.length > 0
      ? Math.round(allTrials.reduce((s, t) => s + (t.reactionTimeMs || 0), 0) / allTrials.length)
      : 0;

    return (
      <div className="session-complete">
        <div className="complete-header">
          <div className="complete-icon">🎉</div>
          <h2>{isBaseline ? 'Baseline Complete!' : 'Session Complete!'}</h2>
          <p className="complete-subtitle">Pattern Detection</p>
        </div>
        <div className="stats-grid">
          <div className="stat-card highlight">
            <span className="stat-value">Lvl {currentLevel}</span>
            <span className="stat-label">Final Level</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{Math.round(acc * 100)}%</span>
            <span className="stat-label">Accuracy</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{allTrials.length}</span>
            <span className="stat-label">Trials</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{totalCorrect}</span>
            <span className="stat-label">Correct</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{avgRT}ms</span>
            <span className="stat-label">Avg RT</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{getPatternLevelConfig(currentLevel).snrDb ?? 'None'}
            </span>
            <span className="stat-label">Noise (SNR dB)</span>
          </div>
        </div>

        {isBaseline && (
          <div className="baseline-note">
            <p>Baseline recorded! Starting level: {currentLevel}</p>
          </div>
        )}

        <button className="btn-primary btn-large" onClick={onComplete}>
          {isBaseline ? 'Continue' : 'Back to Dashboard'}
        </button>
      </div>
    );
  }

  const levelConfig = getPatternLevelConfig(currentLevel);

  return (
    <div className="exercise-container">
      <div className="exercise-header">
        <h2 className="exercise-title">
          {isBaseline ? '📊 Baseline: ' : ''}Pattern Detection
        </h2>
        <div className="exercise-meta">
          <span className="meta-pill">
            Trial {trialNumber + 1} / {PATTERN_MAX_TRIALS}
          </span>
          <span className="meta-pill">
            Level {currentLevel}
          </span>
          <span className="meta-pill">
            {Math.round(overallAccuracy * 100)}% accurate
          </span>
          <span className="meta-pill">
            {levelConfig.snrDb ? `SNR ${levelConfig.snrDb}dB` : 'No noise'}
          </span>
          <span className="meta-pill timer">
            {minutes}:{seconds.toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      <div className="progress-track">
        <div
          className="progress-fill pattern"
          style={{ width: `${(trialNumber / PATTERN_MAX_TRIALS) * 100}%` }}
        />
      </div>

      {/* Level indicator */}
      <div className="level-steps">
        {PATTERN_LEVELS.map((lvl, i) => (
          <div
            key={lvl}
            className={`level-dot ${i === currentLevelIndex ? 'active' : ''} ${i < currentLevelIndex ? 'passed' : ''}`}
            title={`Level ${lvl}`}
          >
            <span className="level-label">{lvl}</span>
          </div>
        ))}
      </div>

      <div className="exercise-stage">
        {phase === 'ready' && trialNumber === 0 && (
          <div className="stage-prompt">
            <div className="instruction-card">
              <h3>How it works</h3>
              <p>You'll hear a sequence of {levelConfig.toneCount} tones{levelConfig.snrDb ? ' with background noise' : ''}.</p>
              <p>Some sequences have a <strong>pattern</strong> (repeating, ascending, or descending). Others are <strong>random</strong>.</p>
              <p>If you detect a pattern, you'll get a bonus question: what kind?</p>
              <div className="key-hints">
                <span><kbd>P</kbd> or <kbd>1</kbd> = Pattern detected</span>
                <span><kbd>R</kbd> or <kbd>2</kbd> = Random / No pattern</span>
              </div>
            </div>
            <button className="btn-primary btn-large" onClick={playStimulus}>
              Start Exercise
            </button>
          </div>
        )}

        {phase === 'playing' && (
          <div className="stage-active">
            <div className="pattern-visualizer">
              {Array.from({ length: levelConfig.toneCount }).map((_, i) => (
                <div key={i} className="pattern-note-dot playing" style={{ animationDelay: `${i * 0.25}s` }}>
                  ♪
                </div>
              ))}
            </div>
            <p className="stage-label">Listening to sequence...</p>
          </div>
        )}

        {phase === 'responding' && (
          <div className="stage-respond">
            <p className="stage-label">Pattern or Random?</p>
            {/* Show sequence dots */}
            {currentStimulus && (
              <div className="pattern-dots-display">
                {currentStimulus.sequence.map((freq, i) => (
                  <div
                    key={i}
                    className="pattern-note"
                    style={{ '--note-height': `${((freq - 200) / 400) * 60 + 20}px` }}
                  >
                    <span className="note-name">{freqToNote(freq)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="response-buttons">
              <button
                className="btn-response btn-pattern"
                onClick={() => handlePatternResponse('pattern')}
              >
                <span className="btn-icon">🔗</span>
                <span>Pattern</span>
                <kbd>P</kbd>
              </button>
              <button
                className="btn-response btn-random"
                onClick={() => handlePatternResponse('random')}
              >
                <span className="btn-icon">🎲</span>
                <span>Random</span>
                <kbd>R</kbd>
              </button>
            </div>
          </div>
        )}

        {phase === 'bonus' && (
          <div className="stage-respond">
            <p className="stage-label">Bonus: What type of pattern?</p>
            <div className="response-buttons bonus-buttons">
              <button
                className="btn-response btn-sm-response"
                onClick={() => handleBonusResponse('ascending')}
              >
                <span className="btn-icon">📈</span>
                <span>Ascending</span>
                <kbd>A</kbd>
              </button>
              <button
                className="btn-response btn-sm-response"
                onClick={() => handleBonusResponse('descending')}
              >
                <span className="btn-icon">📉</span>
                <span>Descending</span>
                <kbd>D</kbd>
              </button>
              <button
                className="btn-response btn-sm-response"
                onClick={() => handleBonusResponse('repeating')}
              >
                <span className="btn-icon">🔁</span>
                <span>Repeating</span>
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
            {lastResult.bonus && (
              <p className="feedback-detail">
                Pattern type: {lastResult.bonus.bonusCorrect ? '✓' : '✗'} {lastResult.bonus.actualType}
              </p>
            )}
            <p className="feedback-detail">{lastResult.reactionTimeMs}ms</p>
            {levelAction && levelAction !== 'stay' && (
              <p className="level-change">
                {levelAction === 'advance' ? '⬆ Level up!' : '⬇ Level decreased'}
              </p>
            )}
          </div>
        )}

        {phase === 'paused' && (
          <div className="stage-paused">
            <h3>Paused</h3>
            <button className="btn-primary" onClick={() => setPhase('ready')}>Resume</button>
          </div>
        )}
      </div>

      {(phase !== 'ready' || trialNumber > 0) && (
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
