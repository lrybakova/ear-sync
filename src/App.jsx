import { Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import ExercisePage from './components/ExercisePage';
import Baseline from './components/Baseline';
import Settings from './components/Settings';

export default function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/exercise/:type" element={<ExercisePage />} />
        <Route path="/baseline/:type" element={<Baseline />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </div>
  );
}
