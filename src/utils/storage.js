/**
 * LocalStorage-based data persistence for EarSync MVP
 */

const STORAGE_KEYS = {
  PROFILE: 'earsync_profile',
  SESSIONS: 'earsync_sessions',
  TRIALS: 'earsync_trials',
  BASELINES: 'earsync_baselines',
  SETTINGS: 'earsync_settings',
};

function safeGet(key, fallback = null) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage error:', e);
  }
}

// --- Profile ---

export function getProfile() {
  return safeGet(STORAGE_KEYS.PROFILE, {
    createdAt: null,
    age: null,
    adhdDiagnosis: null,
    notes: '',
  });
}

export function saveProfile(profile) {
  safeSet(STORAGE_KEYS.PROFILE, { ...getProfile(), ...profile });
}

// --- Sessions ---

export function getSessions() {
  return safeGet(STORAGE_KEYS.SESSIONS, []);
}

export function saveSession(session) {
  const sessions = getSessions();
  sessions.push(session);
  safeSet(STORAGE_KEYS.SESSIONS, sessions);
  return session;
}

export function getSessionsByType(exerciseType) {
  return getSessions().filter((s) => s.exerciseType === exerciseType);
}

export function getSessionCount() {
  return getSessions().length;
}

// --- Trials ---

export function getTrials(sessionId) {
  const all = safeGet(STORAGE_KEYS.TRIALS, []);
  return sessionId ? all.filter((t) => t.sessionId === sessionId) : all;
}

export function saveTrial(trial) {
  const trials = safeGet(STORAGE_KEYS.TRIALS, []);
  trials.push(trial);
  safeSet(STORAGE_KEYS.TRIALS, trials);
  return trial;
}

export function saveTrialsBatch(newTrials) {
  const trials = safeGet(STORAGE_KEYS.TRIALS, []);
  trials.push(...newTrials);
  safeSet(STORAGE_KEYS.TRIALS, trials);
}

// --- Baselines ---

export function getBaselines() {
  return safeGet(STORAGE_KEYS.BASELINES, {
    gapDetection: null,
    temporalOrderJudgment: null,
    durationReproduction: null,
    pitchDiscrimination: null,
    patternDetection: null,
    externalTests: [],
  });
}

export function saveBaseline(exerciseType, baselineData) {
  const baselines = getBaselines();
  baselines[exerciseType] = {
    ...baselineData,
    timestamp: Date.now(),
  };
  safeSet(STORAGE_KEYS.BASELINES, baselines);
}

export function addExternalTest(testData) {
  const baselines = getBaselines();
  baselines.externalTests.push({
    ...testData,
    timestamp: Date.now(),
  });
  safeSet(STORAGE_KEYS.BASELINES, baselines);
}

// --- Settings ---

export function getSettings() {
  return safeGet(STORAGE_KEYS.SETTINGS, {
    volume: 0.7,
    headphoneCheckDone: false,
    showFeedback: true,
    darkMode: true,
  });
}

export function saveSettings(settings) {
  safeSet(STORAGE_KEYS.SETTINGS, { ...getSettings(), ...settings });
}

// --- Stats Helpers ---

export function getLatestThreshold(exerciseType) {
  const sessions = getSessionsByType(exerciseType);
  if (sessions.length === 0) return null;
  const latest = sessions[sessions.length - 1];
  return latest.finalThreshold;
}

export function getThresholdHistory(exerciseType) {
  return getSessionsByType(exerciseType).map((s) => ({
    date: new Date(s.timestamp).toLocaleDateString(),
    timestamp: s.timestamp,
    threshold: s.finalThreshold,
    accuracy: s.overallAccuracy,
    trialsCompleted: s.trialsCompleted,
  }));
}

export function getTotalSessionCount() {
  return getSessions().length;
}

export function getStreak() {
  const sessions = getSessions().sort((a, b) => b.timestamp - a.timestamp);
  if (sessions.length === 0) return 0;

  let streak = 1;
  const oneDay = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastSession = new Date(sessions[0].timestamp);
  lastSession.setHours(0, 0, 0, 0);

  // If last session wasn't today or yesterday, streak is 0
  if (today - lastSession > oneDay) return 0;

  for (let i = 1; i < sessions.length; i++) {
    const current = new Date(sessions[i].timestamp);
    current.setHours(0, 0, 0, 0);
    const prev = new Date(sessions[i - 1].timestamp);
    prev.setHours(0, 0, 0, 0);

    if (prev - current <= oneDay && prev - current > 0) {
      streak++;
    } else if (prev.getTime() === current.getTime()) {
      continue; // Same day, don't count twice
    } else {
      break;
    }
  }
  return streak;
}

// --- Export/Clear ---

export function exportAllData() {
  return {
    profile: getProfile(),
    sessions: getSessions(),
    trials: safeGet(STORAGE_KEYS.TRIALS, []),
    baselines: getBaselines(),
    settings: getSettings(),
    exportedAt: new Date().toISOString(),
  };
}

export function clearAllData() {
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}
