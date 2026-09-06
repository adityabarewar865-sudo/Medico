import React, { useState } from 'react';
import { X, CheckCircle, Shield, QrCode, Smartphone, Sparkles } from 'lucide-react';
import type { AbhaDetails } from '../../types/clinical';

interface AbhaCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientName: string;
  patientPhone: string;
  currentAbha: AbhaDetails;
  onSelectAbha: (abha: AbhaDetails) => void;
}

export const AbhaCardModal: React.FC<AbhaCardModalProps> = ({
  isOpen,
  onClose,
  patientName,
  patientPhone,
  currentAbha,
  onSelectAbha,
}) => {
  const [step, setStep] = useState<'options' | 'otp' | 'card'>('options');
  const [isVerifying, setIsVerifying] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setStep('otp');
    }, 600);
  };

  const handleVerifyOtp = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setStep('card');
    }, 700);
  };

  const handleApplyAbha = () => {
    const cleanName = (patientName || 'Ramesh Kumar').toLowerCase().replace(/\s+/g, '.');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const generatedAbha: AbhaDetails = {
      abhaNumber: `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${randomSuffix}`,
      abhaAddress: `${cleanName}@abdm`,
      status: 'verified',
      kycStatus: 'KYC_VERIFIED',
      linkedCareContextsCount: 2,
    };
    onSelectAbha(generatedAbha);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-xl overflow-hidden border border-slate-200">
        {/* Light Clean Header */}
        <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-teal-50 px-6 py-4 border-b border-blue-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center border border-blue-200 shadow-2xs">
              <Shield className="w-5 h-5 text-blue-700" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900">Ayushman Bharat Digital Mission</h3>
              <p className="text-[11px] font-semibold text-blue-700">ABHA (Ayushman Bharat Health Account) Portal</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {step === 'options' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50/80 rounded-2xl border border-blue-100 flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-950 font-medium leading-relaxed">
                  Link your 14-digit ABHA ID to automatically access your previous hospital prescriptions, lab investigations, and government health benefits securely.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Patient Mobile Number for OTP:</label>
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-bold text-slate-800">+91 {patientPhone || '9876543210'}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2.5">
                <button
                  onClick={handleSendOtp}
                  disabled={isVerifying}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-2xl shadow-sm shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                >
                  {isVerifying ? 'Sending NHA OTP...' : 'Send OTP via Aadhaar / Mobile'}
                </button>
                <button
                  onClick={handleApplyAbha}
                  className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all"
                >
                  Instant Simulate Verified ABHA Card
                </button>
              </div>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <div className="text-center py-2">
                <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-full flex items-center justify-center mx-auto mb-2 border border-blue-200">
                  <Smartphone className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-slate-900 text-sm">Enter 4-Digit NHA Verification OTP</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Sent to +91 {patientPhone || '9876543210'} (Demo auto-filled: 4829)
                </p>
              </div>

              <div className="flex justify-center gap-2">
                {['4', '8', '2', '9'].map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    readOnly
                    value={digit}
                    className="w-12 h-12 text-center text-lg font-black bg-slate-50 border-2 border-blue-500 text-blue-900 rounded-2xl shadow-2xs"
                  />
                ))}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={isVerifying}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {isVerifying ? 'Authenticating with ABDM Gateway...' : 'Verify OTP & Fetch Health Card'}
              </button>
            </div>
          )}

          {step === 'card' && (
            <div className="space-y-4">
              {/* Authentic Looking ABHA Card - Light Theme */}
              <div className="relative rounded-3xl p-5 bg-gradient-to-br from-white via-sky-50/40 to-teal-50/40 border-2 border-blue-400 shadow-sm overflow-hidden">
                {/* Header ribbon */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl">🇮🇳</span>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-950">
                        National Health Authority
                      </div>
                      <div className="text-[9px] font-semibold text-slate-500">Ministry of Health &amp; Family Welfare</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-emerald-600" />
                    KYC Verified
                  </span>
                </div>

                {/* Card Body */}
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-2xs shrink-0">
                    👤
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="font-black text-sm text-slate-900 truncate">
                      {patientName || 'Ramesh Kumar'}
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">DOB: 12/04/1968 | Male</p>
                    <p className="text-xs font-mono font-bold text-blue-700 mt-0.5">
                      {currentAbha.abhaAddress || `${(patientName || 'ramesh').toLowerCase()}@abdm`}
                    </p>
                  </div>
                  <div className="w-14 h-14 bg-white p-1 rounded-xl border border-slate-200 flex flex-col items-center justify-center shrink-0 shadow-2xs">
                    <QrCode className="w-10 h-10 text-slate-800" />
                    <span className="text-[7px] font-black text-slate-400">SCAN</span>
                  </div>
                </div>

                {/* ABHA Number Bar */}
                <div className="bg-sky-100/80 border border-sky-200 text-blue-950 p-2.5 rounded-2xl text-center">
                  <div className="text-[9px] uppercase tracking-wider font-extrabold text-blue-800">ABHA Number</div>
                  <div className="text-base font-mono font-black tracking-widest text-blue-900">
                    {currentAbha.abhaNumber || '91-4521-8890-1234'}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleApplyAbha}
                  className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-2xl shadow-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <CheckCircle className="w-4 h-4" />
                  Apply &amp; Link This ABHA
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
