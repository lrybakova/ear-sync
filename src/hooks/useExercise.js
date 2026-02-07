import { useState, useCallback, useRef, useEffect } from 'react';
import { generateUUID } from '../utils/uuid';
import { calculateAccuracy, getNextLevel, shouldEndSession, getSessionSummary } from '../utils/adaptive';
import { saveSession, saveTrial } from '../utils/storage';

/**
 * Shared hook for exercise logic
 *
 * @param {Object} config
 * @param {string} config.exerciseType - 'gap_detection' | 'temporal_order_judgment'
 * @param {number[]} config.steps - Difficulty step values
 * @param {number} config.trialsPerLevel - Trials before evaluating accuracy
 * @param {number} config.advanceThreshold - Accuracy to advance (0-1)
 * @param {number} config.retreatThreshold - Accuracy to retreat (0-1)
 * @param {number} config.maxTrials - Max trials per session
 * @param {number} config.maxTimeMs - Max time per session
 * @param {boolean} config.isBaseline - Whether this is a baseline measurement
 */
export function useExercise(config) {
  const {
    exerciseType,
    steps,
    trialsPerLevel,
    advanceThreshold,
    retreatThreshold,
    maxTrials,
    maxTimeMs,
    isBaseline = false,
  } = config;

  const [phase, setPhase] = useState('ready'); // ready | playing | responding | feedback | paused | complete
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [trialNumber, setTrialNumber] = useState(0);
  const [levelTrials, setLevelTrials] = useState([]); // trials at current level
  const [allTrials, setAllTrials] = useState([]);
  const [lastResult, setLastResult] = useState(null); // { correct, reactionTimeMs }
  const [sessionId] = useState(() => generateUUID());
  const [sessionStartTime] = useState(() => Date.now());
  const [currentStimulus, setCurrentStimulus] = useState(null);
  const [levelAction, setLevelAction] = useState(null); // 'advance' | 'retreat' | 'stay'

  const stimulusStartTime = useRef(0);
  const feedbackTimeout = useRef(null);
  const playingTimeout = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
      if (playingTimeout.current) clearTimeout(playingTimeout.current);
    };
  }, []);

  const currentValue = steps[currentStepIndex];

  const elapsed = Date.now() - sessionStartTime;
  const isSessionOver = shouldEndSession(trialNumber, elapsed, maxTrials, maxTimeMs);
  const reachedMinimum = currentStepIndex === steps.length - 1;

  /**
   * Start a new trial - returns the stimulus config for the exercise to play
   */
  const startTrial = useCallback(() => {
    if (isSessionOver) {
      setPhase('complete');
      return null;
    }
    setPhase('playing');
    setLastResult(null);
    setLevelAction(null);
    return { stepIndex: currentStepIndex, value: currentValue };
  }, [currentStepIndex, currentValue, isSessionOver]);

  /**
   * Mark that audio playback started (for reaction time)
   */
  const markStimulusStart = useCallback(() => {
    stimulusStartTime.current = performance.now();
  }, []);

  /**
   * Transition to responding phase (user can now answer)
   */
  const enableResponse = useCallback((stimulus) => {
    setCurrentStimulus(stimulus);
    setPhase('responding');
  }, []);

  /**
   * Record the user's response
   */
  const recordResponse = useCallback(
    (userResponse, correctAnswer) => {
      const reactionTimeMs = Math.round(performance.now() - stimulusStartTime.current);
      const correct = userResponse === correctAnswer;

      const trial = {
        exerciseType,
        timestamp: Date.now(),
        trialNumber: trialNumber + 1,
        stepIndex: currentStepIndex,
        parameterValue: currentValue,
        stimulus: currentStimulus,
        userResponse,
        correctAnswer,
        correct,
        reactionTimeMs,
        sessionId,
      };

      // Save trial
      saveTrial(trial);

      const newLevelTrials = [...levelTrials, trial];
      const newAllTrials = [...allTrials, trial];

      setLastResult({ correct, reactionTimeMs });
      setAllTrials(newAllTrials);
      setLevelTrials(newLevelTrials);
      setTrialNumber((n) => n + 1);
      setPhase('feedback');

      // Check if we need to evaluate level
      if (newLevelTrials.length >= trialsPerLevel) {
        const accuracy = calculateAccuracy(newLevelTrials, trialsPerLevel);
        const next = getNextLevel(steps, currentStepIndex, accuracy, advanceThreshold, retreatThreshold);

        setCurrentStepIndex(next.stepIndex);
        setLevelAction(next.action);
        setLevelTrials([]); // Reset level trials
      }

      // Auto-advance after feedback
      feedbackTimeout.current = setTimeout(() => {
        const newElapsed = Date.now() - sessionStartTime;
        if (shouldEndSession(trialNumber + 1, newElapsed, maxTrials, maxTimeMs)) {
          // Session complete - save it
          const summary = getSessionSummary(newAllTrials, steps, currentStepIndex);
          saveSession({
            ...summary,
            sessionId,
            exerciseType,
            timestamp: Date.now(),
            startTime: sessionStartTime,
            duration: newElapsed,
            isBaseline,
          });
          setPhase('complete');
        } else {
          setPhase('ready');
        }
      }, 1500); // Show feedback for 1.5s

      return trial;
    },
    [
      exerciseType, trialNumber, currentStepIndex, currentValue,
      currentStimulus, levelTrials, allTrials, sessionId,
      sessionStartTime, steps, trialsPerLevel, advanceThreshold,
      retreatThreshold, maxTrials, maxTimeMs, isBaseline,
    ]
  );

  /**
   * Pause the session
   */
  const pause = useCallback(() => {
    setPhase('paused');
    if (feedbackTimeout.current) clearTimeout(feedbackTimeout.current);
  }, []);

  /**
   * Resume from pause
   */
  const resume = useCallback(() => {
    setPhase('ready');
  }, []);

  /**
   * Force end the session
   */
  const endSession = useCallback(() => {
    if (allTrials.length > 0) {
      const summary = getSessionSummary(allTrials, steps, currentStepIndex);
      saveSession({
        ...summary,
        sessionId,
        exerciseType,
        timestamp: Date.now(),
        startTime: sessionStartTime,
        duration: Date.now() - sessionStartTime,
        isBaseline,
        earlyEnd: true,
      });
    }
    setPhase('complete');
  }, [allTrials, steps, currentStepIndex, sessionId, exerciseType, sessionStartTime, isBaseline]);

  const accuracy = allTrials.length > 0
    ? allTrials.filter((t) => t.correct).length / allTrials.length
    : 0;

  const timeRemainingMs = Math.max(0, maxTimeMs - elapsed);

  return {
    // State
    phase,
    currentValue,
    currentStepIndex,
    trialNumber,
    allTrials,
    lastResult,
    sessionId,
    accuracy,
    levelAction,
    timeRemainingMs,
    isSessionOver,
    reachedMinimum,

    // Actions
    startTrial,
    markStimulusStart,
    enableResponse,
    recordResponse,
    pause,
    resume,
    endSession,
    setPhase,
  };
}
