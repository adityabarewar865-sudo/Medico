import React from 'react';
import { X, Printer, QrCode, CheckCircle, ShieldCheck } from 'lucide-react';
import type { PatientCaseEncounter } from '../../types/clinical';

interface OpdSlipPrintProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: PatientCaseEncounter;
}

export const OpdSlipPrint: React.FC<OpdSlipPrintProps> = ({
  isOpen,
  onClose,
  encounter,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] shadow-2xl flex flex-col overflow-hidden border border-slate-300">
        {/* Modal Controls (Hidden in print) */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-3 text-slate-800 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <span className="text-lg">🖨️</span>
            <span className="font-bold text-sm text-slate-800">OPD Clinical Consultation Sheet &amp; Prescription</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow transition-all flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Print OPD Slip</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable OPD Slip Body */}
        <div className="p-8 bg-white overflow-auto flex-1 font-sans text-slate-900 text-xs sm:text-sm space-y-4 select-text">
          {/* Hospital Header */}
          <div className="border-b-2 border-slate-900 pb-3 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-teal-800 text-white flex items-center justify-center text-2xl font-bold">
                🏥
              </div>
              <div>
                <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
                  {encounter.hospitalName?.toUpperCase() || (localStorage.getItem('medico_current_user') ? JSON.parse(localStorage.getItem('medico_current_user')!).hospitalName?.toUpperCase() : 'DISTRICT HOSPITAL')}
                </h1>
                <p className="text-xs font-bold text-teal-900">
                  {encounter.hospitalAddress || localStorage.getItem('medico_hospital_address') || 'Hospital Complex, Main Road, Civil Lines'}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-teal-800 font-semibold mt-0.5">
                  <span>Department of Outpatient Clinical Services</span>
                  <span>•</span>
                  <span>ABDM Enabled HIP/HIU</span>
                  <span>•</span>
                  <span>National Health Mission (NHM)</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs font-bold uppercase text-slate-500">OPD Token #</div>
              <div className="text-2xl font-black text-slate-900 font-mono">
                {encounter.opdToken}
              </div>
              <div className="text-[11px] font-semibold text-slate-600">
                {encounter.opdRoom}
              </div>
            </div>
          </div>

          {/* Patient Details & ABHA Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block">Patient Name:</span>
              <span className="font-bold text-slate-900">{encounter.demographics.fullName}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Age / Gender:</span>
              <span className="font-bold text-slate-900">
                {encounter.demographics.age} Yrs / {encounter.demographics.gender.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Contact Phone:</span>
              <span className="font-bold text-slate-900">+91 {encounter.demographics.phone || '9876543210'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Encounter Date:</span>
              <span className="font-bold text-slate-900">
                {new Date(encounter.createdAt).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </div>
            <div className="sm:col-span-3 pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-semibold block">ABHA Number / Address:</span>
              <span className="font-mono font-bold text-blue-800">
                {encounter.demographics.abha.abhaAddress || encounter.demographics.abha.abhaNumber || 'Verified in OPD Session'}
              </span>
            </div>
            <div className="pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-semibold block">Triage Priority:</span>
              <span
                className={`font-black uppercase px-2 py-0.5 rounded text-[10px] ${
                  encounter.triagePriority === 'emergency'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : encounter.triagePriority === 'urgent'
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                {encounter.triagePriority}
              </span>
            </div>

            {/* Accompanying Person Row */}
            {encounter.accompanyingPerson?.name && (
              <div className="sm:col-span-2 pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-semibold block">Person Accompanying Patient:</span>
                <span className="font-bold text-slate-900">
                  {encounter.accompanyingPerson.name} ({encounter.accompanyingPerson.relation}) • Mobile: {encounter.accompanyingPerson.phone || 'N/A'}
                </span>
              </div>
            )}

            {/* Allergy Status Row */}
            {encounter.knownAllergies && (
              <div className="sm:col-span-2 pt-1 border-t border-slate-200">
                <span className="text-slate-500 font-semibold block">Allergy Status:</span>
                <span className={`font-bold ${
                  encounter.knownAllergies.hasAllergy === 'yes'
                    ? 'text-rose-700'
                    : encounter.knownAllergies.hasAllergy === 'not_sure'
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}>
                  {encounter.knownAllergies.hasAllergy === 'yes'
                    ? `YES — ${encounter.knownAllergies.details || 'Specified'}`
                    : encounter.knownAllergies.hasAllergy === 'not_sure'
                    ? 'NOT SURE (Caution: Verify before prescribing)'
                    : 'NO (No known drug/food allergies)'}
                </span>
              </div>
            )}
          </div>

          {/* Chief Complaint & HPI */}
          <div className="space-y-1">
            <div className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
              Chief Complaint &amp; History of Present Illness (HPI)
            </div>
            <p className="text-xs leading-relaxed text-slate-800 font-medium">
              {encounter.clinicalSummary.historyOfPresentIllness}
            </p>
          </div>

          {/* Past Morbidities & Reconciled Meds */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                Documented Past Medical History
              </div>
              <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                {encounter.clinicalSummary.pastMedicalHistory.map((m, idx) => (
                  <li key={idx} className="font-medium">{m}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-black uppercase tracking-wider text-slate-800 border-b border-slate-200 pb-1">
                Active Medications (Pre-consultation)
              </div>
              {encounter.clinicalSummary.activeMedications.length > 0 ? (
                <ul className="list-disc list-inside text-xs text-slate-700 space-y-0.5">
                  {encounter.clinicalSummary.activeMedications.map((med) => (
                    <li key={med.id} className="font-medium">
                      {med.name} {med.dosage} ({med.frequency})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">None documented in prior records.</p>
              )}
            </div>
          </div>

          {/* Doctor's Assessment & Clinical Impression */}
          <div className="space-y-1 pt-1 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
            <div className="text-xs font-black uppercase tracking-wider text-amber-950">
              Doctor's Clinical Impression &amp; Diagnosis
            </div>
            <p className="text-xs font-bold text-slate-900">
              {encounter.doctorReview.finalImpression ||
                encounter.doctorReview.differentialDiagnosis?.join(', ') ||
                'Clinical impression under observation.'}
            </p>
            {encounter.doctorReview.doctorNotes && (
              <p className="text-xs text-slate-700 mt-1">
                <span className="font-bold">Doctor Notes:</span> {encounter.doctorReview.doctorNotes}
              </p>
            )}
          </div>

          {/* Prescription ℞ */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2 text-base font-black text-teal-800">
              <span>℞</span>
              <span className="text-xs uppercase tracking-wider text-slate-900">
                Prescription (Advised Medications)
              </span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
              <thead className="bg-slate-100 font-bold text-slate-700">
                <tr>
                  <th className="p-2 border-b border-slate-200">Medicine Name</th>
                  <th className="p-2 border-b border-slate-200">Dosage</th>
                  <th className="p-2 border-b border-slate-200">Frequency</th>
                  <th className="p-2 border-b border-slate-200">Duration</th>
                  <th className="p-2 border-b border-slate-200">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {(encounter.doctorReview.prescribedMedications || []).length > 0 ? (
                  encounter.doctorReview.prescribedMedications!.map((rx, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-bold text-slate-900">{rx.name}</td>
                      <td className="p-2">{rx.dosage}</td>
                      <td className="p-2 font-semibold text-slate-700">{rx.frequency}</td>
                      <td className="p-2">{rx.duration}</td>
                      <td className="p-2 text-slate-600">{rx.instructions}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400">
                      Standard symptomatic advice or refer to attending physician.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Recommended Investigations */}
          {encounter.doctorReview.recommendedTests && encounter.doctorReview.recommendedTests.length > 0 && (
            <div className="text-xs">
              <span className="font-bold text-slate-800">Advised Lab Tests / Investigations: </span>
              <span className="text-slate-700">{encounter.doctorReview.recommendedTests.join(', ')}</span>
            </div>
          )}

          {/* Footer with Digital Verification & QR */}
          <div className="pt-4 border-t-2 border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="w-14 h-14 text-slate-900" />
              <div className="text-[10px] text-slate-600 space-y-0.5">
                <div className="font-bold text-slate-800">ABDM CARE CONTEXT:</div>
                <div className="font-mono">{encounter.abdmCareContextRef}</div>
                <div className="flex items-center gap-1 text-emerald-700 font-bold">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Linked to Ayushman Bharat Digital Mission</span>
                </div>
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="font-bold text-xs text-slate-900">
                Attending Doctor: {encounter.doctorReview.verifiedBy === 'Attending Doctor' || encounter.doctorReview.verifiedBy === 'Attending Physician' ? (localStorage.getItem('medico_current_user') ? JSON.parse(localStorage.getItem('medico_current_user')!).name : 'Not Assigned') : encounter.doctorReview.verifiedBy}
              </div>
              <div className="text-[10px] text-slate-500">
                Medical Officer / Consultant Physician
              </div>
              <div className="text-[9px] text-emerald-700 font-bold flex items-center justify-end gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-600" />
                <span>Digitally Verified &amp; Signed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
