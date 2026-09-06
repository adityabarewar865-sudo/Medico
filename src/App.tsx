import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { PatientKiosk } from './components/patient/PatientKiosk';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import type { LanguageCode } from './types/clinical';
import { storage } from './services/storage';

export const App: React.FC = () => {
  const [currentMode, setCurrentMode] = useState<'kiosk' | 'doctor'>('kiosk');
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('hi');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const isSpeaking = false;
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [emergencyCount, setEmergencyCount] = useState<number>(0);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('aarogyavani_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  // Sync theme with HTML class and localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('aarogyavani_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Sync queue counts from storage
  useEffect(() => {
    const updateStats = () => {
      const patients = storage.getPatients();
      setWaitingCount(patients.length);
      setEmergencyCount(patients.filter((p) => p.triagePriority === 'emergency').length);
    };

    updateStats();
    const unsubscribe = storage.subscribe(updateStats);
    return () => unsubscribe();
  }, []);

  return (
    <div
      className={`min-h-screen flex flex-col bg-slate-50/80 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 ${
        highContrast ? 'high-contrast bg-white dark:bg-black' : ''
      }`}
    >
      {/* Top Navigation & Controls */}
      <Header
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
        audioEnabled={audioEnabled}
        onToggleAudio={() => setAudioEnabled(!audioEnabled)}
        highContrast={highContrast}
        onToggleHighContrast={() => setHighContrast(!highContrast)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        isSpeaking={isSpeaking}
        waitingCount={waitingCount}
        emergencyCount={emergencyCount}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-12">
        {currentMode === 'kiosk' ? (
          <PatientKiosk
            currentLanguage={currentLanguage}
            onLanguageChange={setCurrentLanguage}
            audioEnabled={audioEnabled}
            onPatientCompleted={() => {}}
          />
        ) : (
          <DoctorDashboard />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 no-print transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-teal-700 dark:text-teal-400">AarogyaVani (आरोग्यवाणी)</span>
            <span>•</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">AI Clinical Case-Taking &amp; Triage Engine</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-teal-800 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              ABDM M1 &amp; M2 Compliant
            </span>
            <span className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              HL7 FHIR R4 Standard
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">National Health Authority Standard</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
