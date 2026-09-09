import React, { useState, useEffect } from 'react';
import { Header } from './components/common/Header';
import { PatientKiosk } from './components/patient/PatientKiosk';
import { DoctorDashboard } from './components/doctor/DoctorDashboard';
import { ReceptionDashboard } from './components/reception/ReceptionDashboard';
import { PatientReceiptPage } from './components/patient/PatientReceiptPage';
import { LoginPage } from './components/common/LoginModal';
import type { LanguageCode, AuthUser } from './types/clinical';
import { storage } from './services/storage';

export const App: React.FC = () => {
  // Check if patient opened a secure receipt link (/receipt/:token or ?receipt=:token)
  const [receiptToken, setReceiptToken] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/receipt/')) {
        return path.split('/receipt/')[1]?.split('/')[0]?.split('?')[0] || null;
      }
      const params = new URLSearchParams(window.location.search);
      return params.get('receipt') || null;
    }
    return null;
  });

  // Listen to browser navigation popstate
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname;
      if (path.startsWith('/receipt/')) {
        setReceiptToken(path.split('/receipt/')[1]?.split('/')[0]?.split('?')[0] || null);
      } else {
        const params = new URLSearchParams(window.location.search);
        setReceiptToken(params.get('receipt') || null);
      }
    };
    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  const [currentMode, setCurrentMode] = useState<'kiosk' | 'reception' | 'doctor'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('medico_auth_user');
        if (saved) {
          const user = JSON.parse(saved);
          return user.role === 'doctor' ? 'doctor' : 'reception';
        }
      } catch {
        // ignore
      }
    }
    return 'reception';
  });
  const [currentLanguage, setCurrentLanguage] = useState<LanguageCode>('hi');
  
  const [highContrast, setHighContrast] = useState<boolean>(false);
  const isSpeaking = false;
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [emergencyCount, setEmergencyCount] = useState<number>(0);

  // Staff Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('medico_auth_user');
        if (saved) {
          const user = JSON.parse(saved);
          return user;
        }
      } catch {
        // ignore
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      setCurrentMode(currentUser.role === 'doctor' ? 'doctor' : 'reception');
    }
  }, []);

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

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    try {
      sessionStorage.setItem('medico_auth_user', JSON.stringify(user));
    } catch {
      // ignore
    }
    // Reception logs in -> Redirect directly to Reception Dashboard
    // Doctor logs in -> Redirect directly to Doctor Dashboard
    setCurrentMode(user.role === 'doctor' ? 'doctor' : 'reception');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      sessionStorage.removeItem('medico_auth_user');
    } catch {
      // ignore
    }
    setCurrentMode('reception');
  };

  // Dedicated Mobile Patient Receipt View (Direct Link - No Login Required)
  if (receiptToken) {
    return <PatientReceiptPage token={receiptToken} />;
  }

  // PAGE 1: First page MUST be Doctor / Reception Login when website opens
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col bg-slate-50/80 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200 ${
        highContrast ? 'high-contrast bg-white dark:bg-black' : ''
      }`}
    >
      {/* Top Navigation & Controls */}
      <Header
        currentMode={
          currentMode === 'kiosk'
            ? 'kiosk'
            : currentUser?.role === 'doctor'
            ? 'doctor'
            : 'reception'
        }
        onModeChange={(mode) => {
          if (mode === 'kiosk') {
            setCurrentMode('kiosk');
          } else if (currentUser) {
            setCurrentMode(currentUser.role === 'doctor' ? 'doctor' : 'reception');
          } else {
            setCurrentMode('login' as any);
          }
        }}
        currentUser={currentUser}
        onRequestLogin={() => setCurrentMode('login' as any)}
        onLogout={handleLogout}
        currentLanguage={currentLanguage}
        onLanguageChange={setCurrentLanguage}
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
        {currentMode === 'kiosk' && (
          <PatientKiosk
            currentLanguage={currentLanguage}
            onLanguageChange={setCurrentLanguage}
            hospitalName={currentUser?.hospitalName}
            hospitalAddress={currentUser?.hospitalAddress}
            onPatientCompleted={() => {}}
          />
        )}

        {currentMode === 'reception' && (
          <ReceptionDashboard
            onSendToKiosk={() => setCurrentMode('kiosk')}
            currentUser={currentUser}
          />
        )}

        {currentMode === 'doctor' && (
          currentUser?.role === 'doctor' ? (
            <DoctorDashboard />
          ) : (
            <div className="max-w-md mx-auto my-12 p-8 bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-2xl">
                🔒
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">Doctor Workstation Restricted</h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Reception staff cannot access the Doctor Dashboard. Please sign in with Doctor credentials to access clinical patient records.
              </p>
              <button
                onClick={() => setCurrentMode('reception')}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs"
              >
                Return to Reception
              </button>
            </div>
          )
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white/90 dark:bg-slate-900/90 backdrop-blur border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400 no-print transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-teal-700 dark:text-teal-400">Medikiosk</span>
            <span>•</span>
            <span className="text-slate-600 dark:text-slate-300 font-medium">Hospital Patient-Record &amp; AI Clinical Case-Taking System</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-teal-800 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">
              ABDM M1 &amp; M2 Compliant
            </span>
            <span className="text-[11px] text-blue-800 dark:text-blue-300 font-semibold bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              HL7 FHIR R4 Standard
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-medium">Central Hospital Database Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
