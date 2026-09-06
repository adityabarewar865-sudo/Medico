import React from 'react';
import {
  Volume2,
  VolumeX,
  Eye,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  RefreshCw,
  Sparkles,
  Users,
  Sun,
  Moon,
} from 'lucide-react';
import type { LanguageCode } from '../../types/clinical';
import { SUPPORTED_LANGUAGES, TRANSLATIONS } from '../../services/i18n';
import { storage } from '../../services/storage';

interface HeaderProps {
  currentMode: 'kiosk' | 'doctor';
  onModeChange: (mode: 'kiosk' | 'doctor') => void;
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
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
  currentLanguage,
  onLanguageChange,
  audioEnabled,
  onToggleAudio,
  highContrast,
  onToggleHighContrast,
  theme,
  onToggleTheme,
  isSpeaking,
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
    if (window.confirm('Reset all OPD patient cases to default simulation data?')) {
      storage.resetToDefaults();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/90 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo & Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-teal-600 via-teal-500 to-sky-500 flex items-center justify-center text-white shadow-sm shadow-teal-500/20">
              <span className="text-2xl">🏥</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                  <span>{t.appName}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-bold border border-teal-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-teal-600" />
                    AI OPD
                  </span>
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200">
                  <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
                  ABDM / ABHA Ready
                </span>
                <span
                  title={backendOnline ? 'Express REST & SSE Server connected on Port 5000' : 'Offline local database cache'}
                  className={`hidden lg:inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 rounded-md border transition-all ${
                    backendOnline
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${backendOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  <span>{backendOnline ? 'API & HIS Live' : 'Offline Cache'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                {t.appTagline}
              </p>
            </div>
          </div>

          {/* Mode Switcher Buttons */}
          <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl border border-slate-200 shadow-inner">
            <button
              onClick={() => onModeChange('kiosk')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentMode === 'kiosk'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>{t.kioskMode}</span>
            </button>
            <button
              onClick={() => onModeChange('doctor')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all relative ${
                currentMode === 'doctor'
                  ? 'bg-sky-700 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>{t.doctorStation}</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200/80 text-slate-700 flex items-center gap-0.5">
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

          {/* Accessibility & Language Controls */}
          <div className="flex items-center gap-2">
            {/* Audio Voice Assistant Toggle */}
            <button
              onClick={onToggleAudio}
              title={audioEnabled ? t.audioOn : t.audioOff}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                audioEnabled
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {audioEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-amber-600" />
                  {isSpeaking && (
                    <div className="flex items-end gap-0.5 h-3">
                      <span className="w-1 bg-amber-500 rounded animate-soundwave-1"></span>
                      <span className="w-1 bg-amber-500 rounded animate-soundwave-2"></span>
                      <span className="w-1 bg-amber-500 rounded animate-soundwave-3"></span>
                    </div>
                  )}
                  <span className="hidden lg:inline">{t.audioGuidance}</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span className="hidden lg:inline">{t.audioOff}</span>
                </>
              )}
            </button>

            {/* High Contrast Toggle */}
            <button
              onClick={onToggleHighContrast}
              title={t.highContrast}
              className={`p-1.5 rounded-xl border text-xs font-bold transition-all ${
                highContrast
                  ? 'bg-amber-100 text-amber-900 border-amber-400 ring-2 ring-amber-300'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Dark / Light Mode Switcher */}
            <button
              onClick={onToggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode (White appearance)' : 'Switch to Dark Mode (Night shift)'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                theme === 'dark'
                  ? 'bg-slate-800 text-amber-300 border-slate-700 hover:bg-slate-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 shadow-2xs'
              }`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-slate-700" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {/* Language Selector */}
            <select
              value={currentLanguage}
              onChange={(e) => onLanguageChange(e.target.value as LanguageCode)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-2xs focus:outline-none focus:ring-2 focus:ring-teal-500"
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
              title="Reset OPD Demo Data"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
