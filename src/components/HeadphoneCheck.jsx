import { useState, useCallback } from 'react';
import { getAudioContext, playTestTone } from '../audio/audioEngine';

export default function HeadphoneCheck({ onComplete }) {
  const [step, setStep] = useState('intro'); // intro | left | right | done
  const [results, setResults] = useState({ left: null, right: null });

  const playTest = useCallback((channel) => {
    getAudioContext();
    playTestTone(channel, 440, 800);
  }, []);

  const handleConfirm = (channel, heard) => {
    setResults((prev) => ({ ...prev, [channel]: heard }));
    if (channel === 'left') {
      setStep('right');
    } else {
      setStep('done');
    }
  };

  if (step === 'done') {
    const bothWork = results.left && results.right;
    return (
      <div className="headphone-check">
        <div className="check-result">
          {bothWork ? (
            <>
              <div className="check-icon success">✓</div>
              <h3>Headphones working!</h3>
              <p>Both channels confirmed. You're ready to go.</p>
            </>
          ) : (
            <>
              <div className="check-icon warning">⚠</div>
              <h3>Channel Issue Detected</h3>
              <p>
                {!results.left && !results.right
                  ? 'Neither channel detected. Please check your headphones.'
                  : `${!results.left ? 'Left' : 'Right'} channel not detected. Check your headphone connection.`}
              </p>
            </>
          )}
          <button className="btn-primary" onClick={() => onComplete(bothWork)}>
            {bothWork ? 'Continue' : 'Continue Anyway'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="headphone-check">
      <h2>🎧 Headphone Check</h2>

      {step === 'intro' && (
        <div className="check-intro">
          <p>This exercise requires headphones for proper stereo separation.</p>
          <p>Let's make sure your headphones are working correctly.</p>
          <button className="btn-primary" onClick={() => setStep('left')}>
            Check Headphones
          </button>
          <button className="btn-ghost" onClick={() => onComplete(true)}>
            Skip Check
          </button>
        </div>
      )}

      {step === 'left' && (
        <div className="check-channel">
          <div className="ear-graphic left-active">
            <span className="ear-side">LEFT</span>
          </div>
          <p>Playing a tone in your <strong>LEFT</strong> ear...</p>
          <button className="btn-secondary" onClick={() => playTest('left')}>
            Play Left Tone
          </button>
          <div className="confirm-buttons">
            <button className="btn-primary" onClick={() => handleConfirm('left', true)}>
              I heard it in my left ear
            </button>
            <button className="btn-ghost" onClick={() => handleConfirm('left', false)}>
              I didn't hear it
            </button>
          </div>
        </div>
      )}

      {step === 'right' && (
        <div className="check-channel">
          <div className="ear-graphic right-active">
            <span className="ear-side">RIGHT</span>
          </div>
          <p>Playing a tone in your <strong>RIGHT</strong> ear...</p>
          <button className="btn-secondary" onClick={() => playTest('right')}>
            Play Right Tone
          </button>
          <div className="confirm-buttons">
            <button className="btn-primary" onClick={() => handleConfirm('right', true)}>
              I heard it in my right ear
            </button>
            <button className="btn-ghost" onClick={() => handleConfirm('right', false)}>
              I didn't hear it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
