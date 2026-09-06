import React, { useState } from 'react';
import { X, Copy, Check, Download, ShieldCheck, Code } from 'lucide-react';
import type { PatientCaseEncounter } from '../../types/clinical';
import { generateFhirBundle } from '../../services/fhirAbdm';

interface FhirBundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  encounter: PatientCaseEncounter;
}

export const FhirBundleModal: React.FC<FhirBundleModalProps> = ({
  isOpen,
  onClose,
  encounter,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const fhirBundle = generateFhirBundle(encounter);
  const jsonString = JSON.stringify(fhirBundle, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FHIR-Bundle-${encounter.opdToken}-${encounter.demographics.fullName.replace(/\s+/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 text-slate-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100 text-teal-800 border border-teal-200">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>HL7 FHIR R4 Bundle (ABDM M1/M2 Standard)</span>
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold border border-blue-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-blue-700" />
                  NRCeS Compliant
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Care Context: {encounter.abdmCareContextRef} | Patient ABHA: {encounter.demographics.abha.abhaAddress || encounter.demographics.abha.abhaNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* JSON Viewer */}
        <div className="p-4 bg-slate-50 flex-1 overflow-auto border-b border-slate-200">
          <pre className="font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap select-text">
            {jsonString}
          </pre>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-600">
            Resources included: <span className="font-bold">Bundle, Composition, Patient, Encounter, Condition, MedicationRequest</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied' : 'Copy FHIR JSON'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download Bundle</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
