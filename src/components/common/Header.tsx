import React from 'react';
import { Eye,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  RefreshCw,
  Sparkles,
  Users,
  Sun,
  Moon,
  Building2,
  LogOut,
  Lock,
} from 'lucide-react';
import type { LanguageCode, AuthUser } from '../../types/clinical';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from '../../services/i18n';
import { storage } from '../../services/storage';

interface HeaderProps {
  currentMode: 'kiosk' | 'reception' | 'doctor';
  onModeChange: (mode: 'kiosk' | 'reception' | 'doctor') => void;
  currentUser: AuthUser | null;
  onRequestLogin: (role: 'reception' | 'doctor') => void;
  onLogout: () => void;
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  
  highContrast: boolean;
  onToggleHighContrast: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  isSpeaking: boolean;
  waitingCount: number;
  emergencyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentMode,
  onModeChange,
  currentUser,
  onRequestLogin,
  onLogout,
  currentLanguage,
  onLanguageChange,
  highContrast,
  onToggleHighContrast,
  theme,
  onToggleTheme,
  waitingCount,
  emergencyCount,
}) => {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;
  const [backendOnline, setBackendOnline] = React.useState(storage.isBackendOnline());

  React.useEffect(() => {
    const check = () => setBackendOnline(storage.isBackendOnline());
    const unsub = storage.subscribe(check);
    const interval = setInterval(check, 2500);
    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  const handleReset = () => {
    if (window.confirm('Reset all hospital patient cases to default simulation data?')) {
      storage.resetToDefaults();
    }
  };

  const handleRoleSelect = (role: 'kiosk' | 'reception' | 'doctor') => {
    if (role === 'kiosk') {
      onModeChange('kiosk');
      return;
    }

    if (role === 'reception') {
      if (currentUser?.role === 'reception') {
        onModeChange('reception');
      } else {
        onRequestLogin('reception');
      }
      return;
    }

    if (role === 'doctor') {
      if (currentUser?.role === 'doctor') {
        onModeChange('doctor');
      } else {
        alert('Access Restricted: Reception staff cannot access the Doctor Dashboard. Doctor login required.');
        onRequestLogin('doctor');
      }
      return;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200/90 dark:border-slate-800 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
              <span className="text-2xl">🏥</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
                  <span>{t.appName}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-bold border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    AI OPD
                  </span>
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  ABDM / ABHA Ready
                </span>
                <span
                  title={backendOnline ? 'Express REST & Central DB Live' : 'Offline local database cache active'}
                  className={`hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                    backendOnline
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{backendOnline ? 'Central DB & HIS Live' : 'Local Persistence'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                Hospital Patient-Record &amp; AI Clinical Case-Taking System
              </p>
            </div>
          </div>

          {/* 3 User Roles Mode Switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100/90 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
              {/* 1. Patient Kiosk (No login needed) */}
              <button
                onClick={() => handleRoleSelect('kiosk')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  currentMode === 'kiosk'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Patient Kiosk</span>
              </button>

              {/* 2. Reception Desk */}
              <button
                onClick={() => handleRoleSelect('reception')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  currentMode === 'reception'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Building2 className="w-4 h-4" />
                <span>Reception</span>
                {currentUser?.role !== 'reception' && (
                  <Lock className="w-3 h-3 text-slate-400" />
                )}
              </button>

              {/* 3. Doctor Workstation */}
              <button
                onClick={() => handleRoleSelect('doctor')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black transition-all relative ${
                  currentMode === 'doctor'
                    ? 'bg-sky-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Stethoscope className="w-4 h-4" />
                <span>Doctor</span>
                {currentUser?.role !== 'doctor' && (
                  <Lock className="w-3 h-3 text-slate-400" />
                )}
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center gap-0.5">
                  <Users className="w-2.5 h-2.5" />
                  {waitingCount}
                </span>
                {emergencyCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse">
                    {emergencyCount}
                  </span>
                )}
              </button>
            </div>

            {/* Active Staff User Badge & Logout */}
            {currentUser && currentMode !== 'kiosk' && (
              <div className="hidden sm:flex items-center gap-2 pl-1">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700 truncate max-w-[140px]">
                  {currentUser.role === 'doctor' ? '🩺' : '👤'} {currentUser.name.split(' ')[0]}
                </span>
                <button
                  onClick={onLogout}
                  title="Log out of staff session"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Accessibility & Language Controls */}
          <div className="flex items-center gap-2">
            {/* Audio Voice Assistant Toggle Removed */}

            {/* High Contrast Toggle */}
            <button
              onClick={onToggleHighContrast}
              title={t.highContrast}
              className={`p-1.5 rounded-xl border text-xs font-bold transition-all ${
                highContrast
                  ? 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Dark / Light Mode Switcher */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Dark</span>
                </>
              )}
            </button>

            {/* Language Selector */}
            <select
              value={currentLanguage}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>

            {/* Reset Demo Data Button */}
            <button
              onClick={handleReset}
              title="Reset OPD Demo Records"
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
