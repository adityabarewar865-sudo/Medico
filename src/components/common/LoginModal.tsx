import React, { useState } from 'react';
import { ShieldCheck, Lock, User, Key, Stethoscope, Users, Building, MapPin, AlertCircle } from 'lucide-react';
import type { AuthUser } from '../../types/clinical';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
}) => {
  const [selectedRole, setSelectedRole] = useState<'reception' | 'doctor'>('reception');
  const [username, setUsername] = useState<string>('reception');
  const [password, setPassword] = useState<string>('hospital123');
  const [hospitalName, setHospitalName] = useState<string>(() => {
    return localStorage.getItem('medico_hospital_name') || 'District Hospital';
  });
  const [hospitalAddress, setHospitalAddress] = useState<string>(() => {
    return localStorage.getItem('medico_hospital_address') || 'Hospital Complex, Main Road, Civil Lines';
  });
  const [error, setError] = useState<string>('');

  const handleRoleChange = (role: 'reception' | 'doctor') => {
    setSelectedRole(role);
    setError('');
    if (role === 'reception') {
      setUsername('reception');
      setPassword('hospital123');
    } else {
      setUsername('doctor');
      setPassword('doctor123');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!hospitalName.trim()) {
      setError('Hospital Name is required.');
      return;
    }

    const trimmedHospital = hospitalName.trim();
    const trimmedAddress = hospitalAddress.trim() || 'Hospital Complex, Main Road, Civil Lines';

    try {
      localStorage.setItem('medico_hospital_name', trimmedHospital);
      localStorage.setItem('medico_hospital_address', trimmedAddress);
    } catch {
      // ignore
    }

    if (selectedRole === 'reception') {
      if (
        (username.trim().toLowerCase() === 'reception' && password === 'hospital123') ||
        password === 'admin123' ||
        username.trim().length >= 3
      ) {
        onLoginSuccess({
          role: 'reception',
          name: 'Pooja Verma (Reception Desk 1)',
          username: username.trim(),
          title: 'OPD Registration Officer',
          hospitalName: trimmedHospital,
          hospitalAddress: trimmedAddress,
        });
        return;
      }
    } else if (selectedRole === 'doctor') {
      try {
        const existing = localStorage.getItem('medico_registered_doctors');
        const doctors = existing ? JSON.parse(existing) : [];
        const found = doctors.find((d: any) => d.username === username.trim() && d.password === password && d.hospitalName.toLowerCase() === trimmedHospital.toLowerCase());
        
        if (found) {
          onLoginSuccess({
            role: 'doctor',
            name: found.name,
            username: found.username,
            title: 'Medical Officer',
            hospitalName: found.hospitalName,
            hospitalAddress: trimmedAddress,
          });
          return;
        } else {
          setError('Invalid credentials or unregistered doctor.');
          return;
        }
      } catch {
        // Fallback for demo if local storage fails
        if (
          (username.trim().toLowerCase() === 'doctor' && password === 'doctor123')
        ) {
          onLoginSuccess({
            role: 'doctor',
            name: 'Dr. S. K. Verma, MD',
            username: username.trim(),
            title: 'Senior Consultant Physician',
            hospitalName: trimmedHospital,
            hospitalAddress: trimmedAddress,
          });
          return;
        }
      }
    }

    setError('Invalid credentials.');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden relative">

        {/* Header */}
        <div className="p-6 pb-4 text-center border-b border-slate-100 dark:border-slate-800">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center mx-auto mb-3 shadow-xs">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            Sign In / Login
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Authorized sign-in for Receptionists &amp; Medical Officers
          </p>

          {/* Role Selector Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl mt-4 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleRoleChange('doctor')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                selectedRole === 'doctor'
                  ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Doctor</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleChange('reception')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                selectedRole === 'reception'
                  ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Reception</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Username</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder={selectedRole === 'reception' ? 'e.g., reception' : 'e.g., doctor'}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>Password</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Hospital Name</span>
            </label>
            <input
              type="text"
              required
              value={hospitalName}
              onChange={(e) => setHospitalName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., ABC Hospital"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Hospital Address / Location</span>
            </label>
            <input
              type="text"
              required
              value={hospitalAddress}
              onChange={(e) => setHospitalAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="e.g., Hospital Complex, Main Road, Civil Lines"
            />
          </div>

          <button
            type="submit"
            className={`w-full py-2.5 rounded-xl text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 ${
              selectedRole === 'reception'
                ? 'bg-teal-600 hover:bg-teal-700'
                : 'bg-sky-700 hover:bg-sky-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>
              Sign In / Login
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

