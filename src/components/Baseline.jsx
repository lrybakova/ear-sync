import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GapDetection from './GapDetection';
import TemporalOrderJudgment from './TemporalOrderJudgment';
import DichoticTOJSpatial from './DichoticTOJSpatial';
import DurationReproduction from './DurationReproduction';
import PitchDiscrimination from './PitchDiscrimination';
import PatternDetection from './PatternDetection';
import HeadphoneCheck from './HeadphoneCheck';

/* saveBaseline() is now called automatically inside saveSession()
   when isBaseline is true - no need to call it manually here */

const EXERCISE_LABELS = {
  gap: 'Gap Detection',
  toj: 'Temporal Order Judgment',
  dichotic_spatial: 'Dichotic TOJ (Spatial)',
  duration: 'Duration Reproduction',
  pitch: 'Pitch Discrimination',
  pattern: 'Pattern Detection',
};

const EXERCISE_TIMES = {
  gap: '~15 min',
  toj: '~15 min',
  dichotic_spatial: '~15 min',
  duration: '~12 min',
  pitch: '~15 min',
  pattern: '~20 min',
};

const NEEDS_HEADPHONES = ['toj', 'dichotic_spatial'];

export default function Baseline() {
  const navigate = useNavigate();
  const { type } = useParams();
  const [headphoneChecked, setHeadphoneChecked] = useState(
    !NEEDS_HEADPHONES.includes(type)
  );
  const [started, setStarted] = useState(false);

  const handleHeadphoneComplete = useCallback(() => {
    setHeadphoneChecked(true);
  }, []);

  const handleComplete = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Headphone check for exercises that need stereo
  if (!headphoneChecked) {
    return <HeadphoneCheck onComplete={handleHeadphoneComplete} />;
  }

  const label = EXERCISE_LABELS[type] || type;
  const time = EXERCISE_TIMES[type] || '~15 min';

  if (!started) {
    return (
      <div className="baseline-intro">
        <button className="btn-ghost back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="baseline-content">
          <h2>📊 Baseline Measurement</h2>
          <h3>{label}</h3>
          <div className="baseline-info">
            <p>
              This baseline session will measure your current ability level.
              It takes about <strong>{time}</strong>.
            </p>
            <ul>
              <li>The exercise will automatically adjust difficulty</li>
              <li>Your final score will be saved as your reference point</li>
              <li>This is what you'll compare against after training</li>
              <li>Try your best, but don't stress about perfection!</li>
            </ul>
            {NEEDS_HEADPHONES.includes(type) && (
              <div className="headphone-notice">
                🎧 Keep your headphones on - stereo separation is essential
              </div>
            )}
          </div>
          <button className="btn-primary btn-large" onClick={() => setStarted(true)}>
            Begin Baseline
          </button>
        </div>
      </div>
    );
  }

  const exerciseMap = {
    gap: <GapDetection isBaseline onComplete={handleComplete} />,
    toj: <TemporalOrderJudgment isBaseline onComplete={handleComplete} />,
    dichotic_spatial: <DichoticTOJSpatial isBaseline onComplete={handleComplete} />,
    duration: <DurationReproduction isBaseline onComplete={handleComplete} />,
    pitch: <PitchDiscrimination isBaseline onComplete={handleComplete} />,
    pattern: <PatternDetection isBaseline onComplete={handleComplete} />,
  };

  return exerciseMap[type] || null;
}
