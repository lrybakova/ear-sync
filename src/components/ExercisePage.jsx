import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GapDetection from './GapDetection';
import TemporalOrderJudgment from './TemporalOrderJudgment';
import DurationReproduction from './DurationReproduction';
import PitchDiscrimination from './PitchDiscrimination';
import PatternDetection from './PatternDetection';
import HeadphoneCheck from './HeadphoneCheck';

const NEEDS_HEADPHONES = ['toj'];

export default function ExercisePage() {
  const navigate = useNavigate();
  const { type } = useParams();
  const [headphoneChecked, setHeadphoneChecked] = useState(
    !NEEDS_HEADPHONES.includes(type)
  );

  const handleComplete = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Headphone check for exercises that need stereo
  if (!headphoneChecked) {
    return <HeadphoneCheck onComplete={() => setHeadphoneChecked(true)} />;
  }

  const exerciseMap = {
    gap: <GapDetection onComplete={handleComplete} />,
    toj: <TemporalOrderJudgment onComplete={handleComplete} />,
    duration: <DurationReproduction onComplete={handleComplete} />,
    pitch: <PitchDiscrimination onComplete={handleComplete} />,
    pattern: <PatternDetection onComplete={handleComplete} />,
  };

  return (
    <div className="exercise-page">
      <button className="btn-ghost back-btn" onClick={() => navigate('/')}>
        ← Back
      </button>
      {exerciseMap[type] || (
        <div className="stage-prompt">
          <p>Unknown exercise type: {type}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>Go Home</button>
        </div>
      )}
    </div>
  );
}
