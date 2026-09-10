import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  FileDown,
  AlertTriangle,
  Calendar,
  User,
  ShieldCheck,
  Stethoscope,
  Pill,
  Activity,
  HeartHandshake,
  Phone,
  Hospital,
} from 'lucide-react';
import { api } from '../../services/api';
import type { PatientCaseEncounter, PatientRecord } from '../../types/clinical';
import { LiveDateTime } from '../common/LiveDateTime';

interface PatientReceiptPageProps {
  token: string;
}

export const PatientReceiptPage: React.FC<PatientReceiptPageProps> = ({ token }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptData, setReceiptData] = useState<{
    receipt: {
      receiptToken: string;
      patientId: string;
      visitId: string;
      patientName: string;
      phone: string;
      doctorName: string;
      verifiedAt: string;
      receiptUrl: string;
      firebaseStorageUrl?: string;
    };
    patient?: PatientRecord;
    visit?: PatientCaseEncounter;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadReceipt = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getReceiptByToken(token);
        if (isMounted) {
          setReceiptData(data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Sorry, this receipt link is no longer valid.';
          setError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    if (token) {
      loadReceipt();
    } else {
      setError('Sorry, this receipt link is no longer valid.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleDownloadPdf = () => {
    // Direct browser download from the secure endpoint
    window.location.href = `/api/receipts/${token}/download`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-teal-100 flex items-center justify-center text-teal-600 animate-spin">
            <Activity className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Retrieving Your Consultation Receipt...</h2>
          <p className="text-slate-500 text-sm">Verifying secure token. Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl border border-slate-200 text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Sorry, this receipt link is no longer valid.
            </h2>
            <p className="text-slate-500 text-sm">
              The receipt link you followed may have expired, been revoked, or entered incorrectly.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left text-xs text-slate-600 space-y-2">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Hospital className="w-4 h-4 text-teal-600" />
              Need Assistance?
            </p>
            <p>
              Please visit the hospital reception counter with your name or mobile number for any queries.
            </p>
          </div>

          <a
            href="/"
            className="inline-block w-full py-3 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm transition-colors"
          >
            Go to Hospital Home
          </a>
        </div>
      </div>
    );
  }

  const { receipt, patient, visit } = receiptData;
  const visitDateFormatted = visit?.visitDate || (receipt.verifiedAt ? receipt.verifiedAt.split('T')[0] : '2026-09-07');
  const attendingDoctor =
    receipt.doctorName && receipt.doctorName !== 'Attending Doctor' && receipt.doctorName !== 'Not Assigned'
      ? receipt.doctorName
      : visit?.doctorReview?.verifiedBy && visit?.doctorReview?.verifiedBy !== 'Attending Doctor'
      ? visit.doctorReview.verifiedBy
      : visit?.attendingDoctor || 'Dr. S. K. Verma, MD';
  const medicines = visit?.doctorReview?.prescribedMedications || visit?.medicines || [];
  const doctorAdvice = visit?.doctorReview?.doctorAdvice || 'Drink plenty of water, get adequate rest, and take prescribed medicines as directed.';

  return (
    <div className="min-h-screen bg-slate-100/80 py-6 px-3 sm:px-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Live Date, Day and Time Header Bar */}
        <div className="flex justify-between items-center bg-white/80 backdrop-blur px-4 py-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-black tracking-tight text-slate-700 uppercase">Hospital Digital Receipt Portal</span>
          <LiveDateTime variant="compact" />
        </div>

        {/* Hospital Header Ribbon */}
        <div className="bg-gradient-to-r from-teal-700 via-emerald-600 to-teal-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white shrink-0">
              <Hospital className="w-7 h-7" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs uppercase tracking-wider font-bold text-teal-200 block truncate">
                {visit?.hospitalName?.toUpperCase() || 'DISTRICT HOSPITAL'}
              </span>
              <p className="text-xs text-teal-100 font-medium truncate">
                {visit?.hospitalAddress || 'Hospital Complex, Main Road, Civil Lines'}
              </p>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight leading-tight mt-1 break-words">
                Verified Medical Consultation Receipt
              </h1>
            </div>
          </div>

          {/* Verification Pill */}
          <div className="mt-4 inline-flex items-center gap-2 bg-emerald-500/30 backdrop-blur-md px-3.5 py-1 rounded-full border border-emerald-300/40 text-xs font-bold text-emerald-100">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>VERIFIED</span>
          </div>
        </div>

        {/* Primary Download Action Card */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">Your Official Receipt is Ready</h2>
              <p className="text-xs text-slate-500">
                You can download the full signed PDF receipt to your phone or view the verified details below.
              </p>
            </div>
            <button
              onClick={handleDownloadPdf}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2.5 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer shrink-0"
            >
              <FileDown className="w-4 h-4" />
              <span>Download Your Receipt</span>
            </button>
          </div>
        </div>

        {/* Patient & Visit Details Card */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center font-bold shrink-0">
                <User className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-base truncate">{receipt.patientName}</h3>
                <p className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
                  {patient && <span>{patient.age}Y • {patient.gender.toUpperCase()} • </span>}
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  +91 {receipt.phone}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 font-mono font-bold text-xs border border-teal-200">
                {receipt.patientId}
              </span>
              <p className="text-xs font-semibold text-slate-600 mt-0.5">
                Visit {receipt.visitId}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <span className="text-slate-400 font-medium block">Assigned Doctor</span>
              <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1 break-words">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{attendingDoctor}</span>
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
              <span className="text-slate-400 font-medium block">Consultation Date</span>
              <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                <span>{visitDateFormatted}</span>
              </p>
            </div>

            {/* Accompanying Person */}
            {visit?.accompanyingPerson?.name && (
              <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 col-span-2">
                <span className="text-slate-400 font-medium block">Person Accompanying Patient</span>
                <p className="font-bold text-slate-800 mt-0.5 break-words">
                  {visit.accompanyingPerson.name} ({visit.accompanyingPerson.relation}) • Mobile: {visit.accompanyingPerson.phone || 'N/A'}
                </p>
              </div>
            )}

            {/* Known Allergies */}
            {visit?.knownAllergies && (
              <div className={`rounded-2xl p-3 border col-span-2 font-bold ${
                visit.knownAllergies.hasAllergy === 'yes'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : visit.knownAllergies.hasAllergy === 'not_sure'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}>
                <span className="block text-[10px] uppercase tracking-wider font-semibold opacity-80">Allergy Status</span>
                <p className="mt-0.5">
                  {visit.knownAllergies.hasAllergy === 'yes'
                    ? `Known Allergies: ${visit.knownAllergies.details || 'Specified by patient'}`
                    : visit.knownAllergies.hasAllergy === 'not_sure'
                    ? 'Allergy Status: Not sure (Caution: verify before medication)'
                    : 'No known drug or food allergies (NKDA)'}
                </p>
              </div>
            )}
          </div>

          {/* Chief Complaint & Clinical Summary */}
          {visit?.chiefComplaint && (
            <div className="bg-teal-50/50 rounded-2xl p-4 border border-teal-100/70 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5" />
                Reason for Visit / Problem
              </span>
              <p className="font-bold text-slate-900 text-sm">
                {visit.chiefComplaint.title}
              </p>
              {visit.clinicalSummary?.historyOfPresentIllness && (
                <p className="text-xs text-slate-600 pt-1 leading-relaxed">
                  {visit.clinicalSummary.historyOfPresentIllness}
                </p>
              )}
            </div>
          )}

          {/* Bedside Vitals */}
          {visit?.clinicalSummary?.vitals && (
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-2">
                Recorded Bedside Vitals
              </span>
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">BP</span>
                  <span className="text-xs font-bold text-slate-800">{visit.clinicalSummary.vitals.bp}</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Pulse</span>
                  <span className="text-xs font-bold text-slate-800">{visit.clinicalSummary.vitals.pulse} bpm</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">SpO2</span>
                  <span className="text-xs font-bold text-slate-800">{visit.clinicalSummary.vitals.spo2}%</span>
                </div>
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 block">Temp</span>
                  <span className="text-xs font-bold text-slate-800">{visit.clinicalSummary.vitals.temp}°F</span>
                </div>
              </div>
            </div>
          )}

          {/* AYUSH Assessment Summary (If recorded) */}
          {visit?.ayushHistory && (
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                  <span>🌿 AYUSH DASHVIDHA PARIKSHA &amp; LIFESTYLE ASSESSMENT</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Ayurvedic Profile
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-200 text-xs text-slate-800">
                <div>Prakriti: <strong>{visit.ayushHistory.dashavidha.prakriti.split('(')[0]}</strong></div>
                <div>Vikriti: <strong>{visit.ayushHistory.dashavidha.vikriti.split('(')[0]}</strong></div>
                <div>Sara: <strong>{visit.ayushHistory.dashavidha.sara.split('(')[0]}</strong></div>
                <div>Agni: <strong>{visit.ayushHistory.dashavidha.aharaShakti.split('(')[0]}</strong></div>
                <div>Vyayama: <strong>{visit.ayushHistory.dashavidha.vyayamaShakti.split('(')[0]}</strong></div>
                <div>Sattva: <strong>{visit.ayushHistory.dashavidha.sattva.split('(')[0]}</strong></div>
                <div>Diet: <strong>{visit.ayushHistory.ahara.usualDiet.split('(')[0]}</strong></div>
                <div>Sleep: <strong>{visit.ayushHistory.vihara.sleepPattern.split('(')[0]}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Prescriptions & Medicines Card */}
        <div className="bg-white rounded-3xl p-6 shadow-md border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-600" />
              Doctor Prescribed Medicines ({medicines.length})
            </h3>
          </div>

          {medicines.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-2">
              No oral medications prescribed for this visit. Follow general clinical advice below.
            </p>
          ) : (
            <div className="space-y-2.5">
              {medicines.map((med, idx) => (
                <div
                  key={idx}
                  className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm block">
                        {idx + 1}. {med.name}
                      </span>
                      {med.category === 'ayurvedic' ? (
                        <span className="font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                          AYURVEDIC MEDICINES
                        </span>
                      ) : med.category === 'homeopathic' ? (
                        <span className="font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-300">
                          HOMEOPATHIC MEDICINES
                        </span>
                      ) : (
                        <span className="font-mono text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-300">
                          ALLOPATHIC MEDICINES
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      Dosage: <strong className="text-slate-700">{med.dosage}</strong> • Frequency: <strong className="text-slate-700">{med.frequency}</strong>
                    </span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="inline-block px-2 py-0.5 rounded-lg bg-teal-50 text-teal-700 font-semibold text-xs border border-teal-200">
                      {med.duration}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">{med.instructions}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Doctor's Advice Card */}
          <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-200/60 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5 text-amber-700" />
              Doctor's Advice &amp; Lifestyle Care Tips
            </span>
            <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line font-medium">
              {doctorAdvice}
            </p>
          </div>
        </div>

        {/* Action Button Footer */}
        <div className="space-y-3 pt-2">
          <button
            onClick={handleDownloadPdf}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-base shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <FileDown className="w-5 h-5" />
            <span>Download Official PDF Receipt</span>
          </button>

          <p className="text-center text-xs text-slate-400">
            Secure digital consultation receipt • No login required • Keep your consultation link private
          </p>
        </div>
      </div>
    </div>
  );
};
