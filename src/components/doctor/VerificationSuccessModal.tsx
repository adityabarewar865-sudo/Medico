import React, { useState } from 'react';
import {
  CheckCircle2,
  FileDown,
  Eye,
  X,
  Printer,
  Calendar,
  User,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react';
import type { PatientCaseEncounter, PatientRecord } from '../../types/clinical';
import { generateVisitReceiptPdf, downloadVisitReceiptPdf } from '../../services/pdfReceiptService';

interface VerificationSuccessModalProps {
  patient: PatientRecord;
  visit: PatientCaseEncounter;
  onClose: () => void;
  receiptToken?: string;
  receiptUrl?: string;
}

export const VerificationSuccessModal: React.FC<VerificationSuccessModalProps> = ({
  patient,
  visit,
  onClose,
  receiptToken: initialReceiptToken,
  receiptUrl: initialReceiptUrl,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const token = initialReceiptToken || visit.receiptToken;
  const receiptUrl =
    initialReceiptUrl ||
    visit.receiptUrl ||
    (token ? `${window.location.origin}/receipt/${token}` : '');

  const handleDownload = () => {
    downloadVisitReceiptPdf({
      patient,
      visit,
      hospitalName: visit.hospitalName,
    });
  };

  const handleViewReceipt = () => {
    try {
      const doc = generateVisitReceiptPdf({ patient, visit, hospitalName: visit.hospitalName });
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setShowPreview(true);
    } catch (e) {
      console.error('Failed to generate PDF preview:', e);
      handleDownload();
    }
  };

  const handleCopyLink = () => {
    if (!receiptUrl) return;
    navigator.clipboard.writeText(receiptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const visitDateStr = visit.visitDate || visit.createdAt.split('T')[0];
  const attendingDoctor = visit.doctorReview?.verifiedBy || visit.attendingDoctor ;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-in fade-in duration-200 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-6">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 px-6 py-7 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-14 h-14 mx-auto mb-2 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-black tracking-tight">
            Verification Completed Successfully
          </h2>
          <p className="text-emerald-100 text-xs sm:text-sm mt-1 font-medium">
            Medical visit verified &amp; signed. Official receipt generated.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Patient & Visit Summary Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/70 dark:border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center text-teal-700 dark:text-teal-300">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">
                    {patient.fullName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {patient.age}Y • {patient.gender.toUpperCase()} • +91 {patient.phone}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 font-mono font-bold text-xs border border-teal-200 dark:border-teal-800">
                  {patient.patientId}
                </span>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5">
                  Visit {visit.visitId || 'V001'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">Attending Physician:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  {attendingDoctor}
                </p>
              </div>

              <div>
                <span className="text-slate-500 dark:text-slate-400">Visit Date &amp; Token:</span>
                <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  {visitDateStr} ({visit.opdToken})
                </p>
              </div>
            </div>
          </div>

          {/* Secure Receipt Link Card */}
          {receiptUrl && (
            <div className="bg-teal-50/70 dark:bg-teal-950/30 rounded-2xl p-4 border border-teal-200/80 dark:border-teal-800/60 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 dark:text-teal-200 uppercase tracking-wider flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                  Secure Patient Receipt URL
                </span>
                <span className="text-[10px] text-teal-700 dark:text-teal-300 font-mono bg-teal-100 dark:bg-teal-900 px-2 py-0.5 rounded-full">
                  Private Token
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={receiptUrl}
                  className="flex-1 text-xs bg-white dark:bg-slate-900 border border-teal-300 dark:border-teal-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-mono select-all focus:outline-hidden"
                />
                <button
                  onClick={handleCopyLink}
                  className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  title="Copy link to clipboard"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-xl transition-colors shrink-0"
                  title="Open patient view in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          {/* Primary Action Button: Click Here to Download Your Receipt */}
          <div className="space-y-3 pt-1">
            <button
              onClick={handleDownload}
              className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-base shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3 transition-all transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <FileDown className="w-5 h-5" />
              <span>📄 Click Here to Download Your Receipt</span>
            </button>

            {/* Secondary Option: View Receipt */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleViewReceipt}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              >
                <Eye className="w-4 h-4 text-teal-600" />
                <span>👁️ View Receipt (Preview)</span>
              </button>

              <button
                onClick={onClose}
                className="py-2.5 px-5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal if user clicks "View Receipt" */}
      {showPreview && previewUrl && (
        <div className="fixed inset-0 z-60 flex flex-col bg-slate-950/80 backdrop-blur-md p-4 sm:p-6">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 rounded-t-2xl border border-slate-800 text-white">
            <div className="flex items-center gap-2">
              <Printer className="w-4 h-4 text-teal-400" />
              <span className="font-bold text-sm">
                Receipt Preview: {patient.patientId} - {visit.visitId || 'V001'} ({patient.fullName})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="px-3 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5"
              >
                <FileDown className="w-3.5 h-3.5" />
                Download PDF
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-800 rounded-b-2xl overflow-hidden border border-t-0 border-slate-800">
            <iframe
              src={previewUrl}
              title="Visit Receipt Preview"
              className="w-full h-full border-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};
