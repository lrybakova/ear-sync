import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GapDetection from './GapDetection';
import TemporalOrderJudgment from './TemporalOrderJudgment';
import HeadphoneCheck from './HeadphoneCheck';
import { saveBaseline, getBaselines } from '../utils/storage';

export default function Baseline() {
  const navigate = useNavigate();
  const { type } = useParams();
  const [headphoneChecked, setHeadphoneChecked] = useState(type === 'gap');
  const [started, setStarted] = useState(false);

  const isGap = type === 'gap';
  const isToj = type === 'toj';

  const handleHeadphoneComplete = useCallback((passed) => {
    setHeadphoneChecked(true);
  }, []);

  const handleComplete = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // For TOJ, show headphone check first
  if (isToj && !headphoneChecked) {
    return <HeadphoneCheck onComplete={handleHeadphoneComplete} />;
  }

  if (!started) {
    return (
      <div className="baseline-intro">
        <button className="btn-ghost back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="baseline-content">
          <h2>
            📊 Baseline Measurement
          </h2>
          <h3>{isGap ? 'Gap Detection' : 'Temporal Order Judgment'}</h3>
          <div className="baseline-info">
            <p>This baseline session will measure your current ability level. It takes about <strong>15 minutes</strong>.</p>
            <ul>
              <li>The exercise will automatically adjust difficulty</li>
              <li>Your final threshold score will be saved</li>
              <li>This is your reference point for tracking progress</li>
              <li>Try your best, but don't worry about perfection!</li>
            </ul>
            {isToj && (
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

  if (isGap) {
    return <GapDetection isBaseline={true} onComplete={handleComplete} />;
  }

  if (isToj) {
    return <TemporalOrderJudgment isBaseline={true} onComplete={handleComplete} />;
  }

  return null;
}
