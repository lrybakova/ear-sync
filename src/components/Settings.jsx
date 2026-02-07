import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAudioContext, playTestTone, setVolume, getVolume } from '../audio/audioEngine';
import {
  getProfile, saveProfile,
  getSettings, saveSettings,
  exportAllData, clearAllData,
  getTotalSessionCount,
} from '../utils/storage';

export default function Settings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(getProfile);
  const [settings, setSettingsState] = useState(getSettings);
  const [volume, setVolumeState] = useState(getVolume());
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleProfileChange = (field, value) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    saveProfile(updated);
  };

  const handleSettingChange = (field, value) => {
    const updated = { ...settings, [field]: value };
    setSettingsState(updated);
    saveSettings(updated);
  };

  const handleVolumeChange = (e) => {
    const v = parseFloat(e.target.value);
    setVolumeState(v);
    setVolume(v);
    saveSettings({ volume: v });
  };

  const handleTestTone = () => {
    getAudioContext();
    playTestTone('center', 440, 500);
  };

  const handleExport = () => {
    const data = exportAllData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earsync-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    clearAllData();
    setShowClearConfirm(false);
    navigate('/');
  };

  return (
    <div className="settings-page">
      <div className="settings-header">
        <button className="btn-ghost" onClick={() => navigate('/')}>
          ← Back
        </button>
        <h2>Settings</h2>
      </div>

      {/* Volume */}
      <section className="settings-section">
        <h3>Audio</h3>
        <div className="setting-row">
          <label>Volume</label>
          <div className="volume-control">
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={handleVolumeChange}
            />
            <span>{Math.round(volume * 100)}%</span>
          </div>
        </div>
        <div className="setting-row">
          <label>Test Sound</label>
          <button className="btn-secondary btn-sm" onClick={handleTestTone}>
            Play Test Tone
          </button>
        </div>
        <div className="setting-row">
          <label>Show Feedback</label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.showFeedback}
              onChange={(e) => handleSettingChange('showFeedback', e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>
      </section>

      {/* Profile */}
      <section className="settings-section">
        <h3>Profile</h3>
        <div className="setting-row">
          <label>Age</label>
          <input
            type="number"
            className="input-field"
            placeholder="Your age"
            value={profile.age || ''}
            onChange={(e) => handleProfileChange('age', e.target.value ? parseInt(e.target.value) : null)}
          />
        </div>
        <div className="setting-row">
          <label>ADHD Diagnosis</label>
          <select
            className="input-field"
            value={profile.adhdDiagnosis || ''}
            onChange={(e) => handleProfileChange('adhdDiagnosis', e.target.value || null)}
          >
            <option value="">Not specified</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
            <option value="suspected">Suspected</option>
          </select>
        </div>
        <div className="setting-row">
          <label>Notes</label>
          <textarea
            className="input-field textarea"
            placeholder="Any relevant notes (medications, hearing conditions, etc.)"
            value={profile.notes || ''}
            onChange={(e) => handleProfileChange('notes', e.target.value)}
          />
        </div>
      </section>

      {/* Data */}
      <section className="settings-section">
        <h3>Data</h3>
        <div className="setting-row">
          <label>Total Sessions: {getTotalSessionCount()}</label>
        </div>
        <div className="setting-row">
          <button className="btn-secondary" onClick={handleExport}>
            Export All Data (JSON)
          </button>
        </div>
        <div className="setting-row danger">
          {!showClearConfirm ? (
            <button className="btn-danger" onClick={() => setShowClearConfirm(true)}>
              Clear All Data
            </button>
          ) : (
            <div className="confirm-clear">
              <p>Are you sure? This will delete ALL session data permanently.</p>
              <div className="confirm-buttons">
                <button className="btn-danger" onClick={handleClear}>
                  Yes, Delete Everything
                </button>
                <button className="btn-secondary" onClick={() => setShowClearConfirm(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
