import { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import GapDetection from './GapDetection';
import TemporalOrderJudgment from './TemporalOrderJudgment';
import HeadphoneCheck from './HeadphoneCheck';

export default function ExercisePage() {
  const navigate = useNavigate();
  const { type } = useParams();
  const [headphoneChecked, setHeadphoneChecked] = useState(type === 'gap');

  const isGap = type === 'gap';
  const isToj = type === 'toj';

  const handleComplete = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // For TOJ, show headphone check first
  if (isToj && !headphoneChecked) {
    return <HeadphoneCheck onComplete={() => setHeadphoneChecked(true)} />;
  }

  return (
    <div className="exercise-page">
      <button className="btn-ghost back-btn" onClick={() => navigate('/')}>
        ← Back
      </button>
      {isGap && <GapDetection onComplete={handleComplete} />}
      {isToj && <TemporalOrderJudgment onComplete={handleComplete} />}
    </div>
  );
}
