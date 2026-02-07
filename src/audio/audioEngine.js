/**
 * Core Audio Engine for EarSync
 * Uses Web Audio API for sample-accurate timing
 */

let audioContext = null;
let masterGain = null;

/**
 * Initialize or resume the AudioContext
 * Must be called from a user gesture (click/tap)
 */
export function getAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
    });
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.7; // ~70dB comfortable level
    masterGain.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

export function getMasterGain() {
  getAudioContext();
  return masterGain;
}

/**
 * Set master volume (0-1)
 */
export function setVolume(value) {
  const gain = getMasterGain();
  gain.gain.setValueAtTime(Math.max(0, Math.min(1, value)), getAudioContext().currentTime);
}

/**
 * Get current volume
 */
export function getVolume() {
  return masterGain ? masterGain.gain.value : 0.7;
}

/**
 * Create a white noise buffer of given duration
 * @param {number} durationSec - Duration in seconds
 * @returns {AudioBuffer}
 */
export function createWhiteNoiseBuffer(durationSec) {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const bufferSize = Math.floor(sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * Create white noise with a silent gap at the center
 * @param {number} totalDurationMs - Total noise duration in ms (default 500)
 * @param {number} gapDurationMs - Gap duration in ms
 * @returns {AudioBuffer}
 */
export function createGappedNoiseBuffer(totalDurationMs = 500, gapDurationMs = 16) {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor((totalDurationMs / 1000) * sampleRate);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);

  // Gap centered in the noise burst
  const gapStartSample = Math.floor(totalSamples / 2) - Math.floor(((gapDurationMs / 1000) * sampleRate) / 2);
  const gapSamples = Math.floor((gapDurationMs / 1000) * sampleRate);
  const gapEndSample = gapStartSample + gapSamples;

  // Apply short fade (1ms) at gap edges to avoid clicks
  const fadeSamples = Math.floor(sampleRate * 0.001); // 1ms fade

  for (let i = 0; i < totalSamples; i++) {
    if (i >= gapStartSample && i < gapEndSample) {
      // Silent gap
      data[i] = 0;
    } else {
      // White noise
      let amplitude = 1;

      // Fade out before gap
      if (i >= gapStartSample - fadeSamples && i < gapStartSample) {
        amplitude = (gapStartSample - i) / fadeSamples;
      }
      // Fade in after gap
      if (i >= gapEndSample && i < gapEndSample + fadeSamples) {
        amplitude = (i - gapEndSample) / fadeSamples;
      }
      // Fade in at start
      if (i < fadeSamples) {
        amplitude = i / fadeSamples;
      }
      // Fade out at end
      if (i >= totalSamples - fadeSamples) {
        amplitude = (totalSamples - i) / fadeSamples;
      }

      data[i] = (Math.random() * 2 - 1) * amplitude;
    }
  }

  return buffer;
}

/**
 * Create continuous white noise (no gap) - for control trials
 * @param {number} totalDurationMs
 * @returns {AudioBuffer}
 */
export function createContinuousNoiseBuffer(totalDurationMs = 500) {
  const ctx = getAudioContext();
  const sampleRate = ctx.sampleRate;
  const totalSamples = Math.floor((totalDurationMs / 1000) * sampleRate);
  const buffer = ctx.createBuffer(1, totalSamples, sampleRate);
  const data = buffer.getChannelData(0);
  const fadeSamples = Math.floor(sampleRate * 0.001);

  for (let i = 0; i < totalSamples; i++) {
    let amplitude = 1;
    if (i < fadeSamples) amplitude = i / fadeSamples;
    if (i >= totalSamples - fadeSamples) amplitude = (totalSamples - i) / fadeSamples;
    data[i] = (Math.random() * 2 - 1) * amplitude;
  }
  return buffer;
}

/**
 * Play an AudioBuffer through master gain
 * @param {AudioBuffer} buffer
 * @param {number} delay - Delay in seconds before playing
 * @returns {AudioBufferSourceNode}
 */
export function playBuffer(buffer, delay = 0) {
  const ctx = getAudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(getMasterGain());
  source.start(ctx.currentTime + delay);
  return source;
}

/**
 * Play a pure sine tone
 * @param {number} frequency - Hz
 * @param {number} durationMs - Duration in ms
 * @param {number} pan - Stereo pan (-1 = left, 0 = center, 1 = right)
 * @param {number} delayMs - Delay before playing in ms
 * @returns {{ oscillator: OscillatorNode, gain: GainNode }}
 */
export function playTone(frequency, durationMs, pan = 0, delayMs = 0) {
  const ctx = getAudioContext();
  const startTime = ctx.currentTime + delayMs / 1000;
  const duration = durationMs / 1000;
  const fadeDuration = 0.005; // 5ms fade to prevent clicks

  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.5, startTime + fadeDuration);
  gainNode.gain.setValueAtTime(0.5, startTime + duration - fadeDuration);
  gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

  // Stereo panning
  const panner = ctx.createStereoPanner();
  panner.pan.setValueAtTime(pan, startTime);

  oscillator.connect(gainNode);
  gainNode.connect(panner);
  panner.connect(getMasterGain());

  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.01);

  return { oscillator, gain: gainNode };
}

/**
 * Play a TOJ trial - two tones with SOA
 * @param {boolean} highFirst - If true, high tone plays first
 * @param {number} soaMs - Stimulus Onset Asynchrony in ms
 * @param {number} toneDurationMs - Each tone's duration (default 50ms)
 * @returns {{ order: string, totalDurationMs: number }}
 */
export function playTOJTrial(highFirst, soaMs, toneDurationMs = 50) {
  const highFreq = 1000; // Hz - right ear
  const lowFreq = 500;   // Hz - left ear

  if (highFirst) {
    // High tone (right ear) first, then low tone (left ear)
    playTone(highFreq, toneDurationMs, 1, 0);      // Right ear, immediate
    playTone(lowFreq, toneDurationMs, -1, soaMs);   // Left ear, delayed
  } else {
    // Low tone (left ear) first, then high tone (right ear)
    playTone(lowFreq, toneDurationMs, -1, 0);       // Left ear, immediate
    playTone(highFreq, toneDurationMs, 1, soaMs);   // Right ear, delayed
  }

  return {
    order: highFirst ? 'high_first' : 'low_first',
    totalDurationMs: soaMs + toneDurationMs,
  };
}

/**
 * Play a Dichotic TOJ trial (Spatial) - IDENTICAL tones to each ear
 * Research-grade methodology matching Fostick & Babkoff (2022)
 * 
 * Key difference from playTOJTrial: Uses SAME frequency (1000Hz) for both tones
 * This eliminates pitch cues and tests pure temporal/spatial discrimination
 * 
 * @param {boolean} leftFirst - If true, left ear tone plays first
 * @param {number} soaMs - Stimulus Onset Asynchrony in ms
 * @param {number} toneDurationMs - Each tone's duration (default 50ms)
 * @returns {{ order: string, totalDurationMs: number }}
 */
export function playDichoticTOJSpatialTrial(leftFirst, soaMs, toneDurationMs = 50) {
  const frequency = 1000; // Hz - IDENTICAL for both ears

  if (leftFirst) {
    // Left ear first, then right ear
    playTone(frequency, toneDurationMs, -1, 0);      // Left ear, immediate
    playTone(frequency, toneDurationMs, 1, soaMs);   // Right ear, delayed
  } else {
    // Right ear first, then left ear
    playTone(frequency, toneDurationMs, 1, 0);       // Right ear, immediate
    playTone(frequency, toneDurationMs, -1, soaMs);  // Left ear, delayed
  }

  return {
    order: leftFirst ? 'left_first' : 'right_first',
    totalDurationMs: soaMs + toneDurationMs,
  };
}

/**
 * Play a test tone for headphone/volume check
 * @param {'left' | 'right' | 'center'} channel
 * @param {number} frequency
 * @param {number} durationMs
 */
export function playTestTone(channel = 'center', frequency = 440, durationMs = 500) {
  const pan = channel === 'left' ? -1 : channel === 'right' ? 1 : 0;
  return playTone(frequency, durationMs, pan, 0);
}

/**
 * Play a reference tone for duration reproduction
 * @param {number} frequency - Hz (default 440)
 * @param {number} durationMs - Duration in ms
 * @returns {Promise} Resolves when tone finishes
 */
export function playReferenceTone(frequency = 440, durationMs = 500) {
  const { oscillator } = playTone(frequency, durationMs, 0, 0);
  return new Promise((resolve) => {
    oscillator.onended = () => resolve();
    // Fallback timeout in case onended doesn't fire
    setTimeout(resolve, durationMs + 50);
  });
}

/**
 * Start a sustained tone for duration reproduction (user holds key)
 * Returns a stop function
 * @param {number} frequency
 * @returns {{ stop: () => number }} stop returns the duration in ms
 */
export function startSustainedTone(frequency = 440) {
  const ctx = getAudioContext();
  const startTime = ctx.currentTime;
  const fadeDuration = 0.005;

  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, startTime);

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, startTime);
  gainNode.gain.linearRampToValueAtTime(0.5, startTime + fadeDuration);

  oscillator.connect(gainNode);
  gainNode.connect(getMasterGain());
  oscillator.start(startTime);

  const holdStart = performance.now();

  return {
    stop: () => {
      const holdDuration = performance.now() - holdStart;
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(gainNode.gain.value, now);
      gainNode.gain.linearRampToValueAtTime(0, now + fadeDuration);
      oscillator.stop(now + fadeDuration + 0.01);
      return Math.round(holdDuration);
    },
  };
}

/**
 * Play a pitch discrimination sequence: 3 reference tones + 1 target
 * @param {number} baseFreq - Reference frequency in Hz
 * @param {number} targetFreq - Target frequency in Hz
 * @param {number} toneDurationMs - Each tone's duration (default 250)
 * @param {number} isiMs - Inter-stimulus interval (default 250)
 * @returns {{ totalDurationMs: number }}
 */
export function playPitchSequence(baseFreq, targetFreq, toneDurationMs = 250, isiMs = 250) {
  const stepMs = toneDurationMs + isiMs; // 500ms per tone+gap

  // 3 reference tones
  playTone(baseFreq, toneDurationMs, 0, 0);
  playTone(baseFreq, toneDurationMs, 0, stepMs);
  playTone(baseFreq, toneDurationMs, 0, stepMs * 2);

  // 1 target tone
  playTone(targetFreq, toneDurationMs, 0, stepMs * 3);

  const totalDurationMs = stepMs * 3 + toneDurationMs;
  return { totalDurationMs };
}

/**
 * Play a pattern sequence (for Pattern Detection exercise)
 * @param {number[]} frequencies - Array of frequencies to play
 * @param {number} toneDurationMs - Each tone duration (default 150)
 * @param {number} isiMs - Gap between tones (default 100)
 * @param {number|null} snrDb - If not null, mix with background noise at this SNR
 * @returns {{ totalDurationMs: number }}
 */
export function playPatternSequence(frequencies, toneDurationMs = 150, isiMs = 100, snrDb = null) {
  const ctx = getAudioContext();
  const stepMs = toneDurationMs + isiMs;
  const totalDurationMs = frequencies.length * stepMs - isiMs; // no ISI after last tone

  // If we need background noise, create a buffer and play it
  if (snrDb !== null) {
    const totalDurationSec = totalDurationMs / 1000 + 0.1; // small buffer
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * totalDurationSec);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // White noise at reduced level based on SNR
    // SNR = 20 * log10(signalAmp / noiseAmp)
    // noiseAmp = signalAmp / 10^(SNR/20)
    const signalAmplitude = 0.5; // our tone amplitude
    const noiseAmplitude = signalAmplitude / Math.pow(10, snrDb / 20);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * noiseAmplitude;
    }

    // Fade in/out
    const fadeSamples = Math.floor(sampleRate * 0.01); // 10ms fade
    for (let i = 0; i < fadeSamples; i++) {
      data[i] *= i / fadeSamples;
      data[bufferSize - 1 - i] *= i / fadeSamples;
    }

    playBuffer(buffer);
  }

  // Play each tone in the sequence
  frequencies.forEach((freq, i) => {
    playTone(freq, toneDurationMs, 0, i * stepMs);
  });

  return { totalDurationMs };
}

/**
 * Get the current audio context time (for reaction time measurement)
 */
export function getCurrentTime() {
  return getAudioContext().currentTime;
}

/**
 * Clean up audio context
 */
export function closeAudio() {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    masterGain = null;
  }
}
