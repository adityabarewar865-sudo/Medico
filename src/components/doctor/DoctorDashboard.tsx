import React, { useState, useEffect } from 'react';
import {
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  FileText,
  Activity,
  Plus,
  Trash2,
  Edit3,
  Printer,
  Sparkles,
  Calendar,
  Layers,
  Stethoscope,
  Database,
  Pill,
  XCircle,
  AlertCircle,
  History,
  FileDown,
  FileSpreadsheet,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Users,
  HelpCircle,
} from 'lucide-react';
import type {
  PatientCaseEncounter,
  PatientRecord,
  TriagePriority,
  PrescribedRxItem,
  DoctorVerification,
} from '../../types/clinical';
import { hospitalDb } from '../../services/hospitalDatabase';
import { downloadHospitalExcel } from '../../services/excelService';
import { api } from '../../services/api';
import { generateVisitReceiptPdf } from '../../services/pdfReceiptService';
import { FhirBundleModal } from './FhirBundleModal';
import { OpdSlipPrint } from './OpdSlipPrint';
import { VerificationSuccessModal } from './VerificationSuccessModal';

export const DoctorDashboard: React.FC = () => {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedVisitId, setSelectedVisitId] = useState<string>('');
  const [triageFilter, setTriageFilter] = useState<'all' | TriagePriority>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'medicines' | 'timeline' | 'documents'>('summary');

  // Modals
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [showVerificationSuccess, setShowVerificationSuccess] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<{
    receiptToken?: string;
    receiptUrl?: string;
  }>({});
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Edit states for current patient visit
  const [isEditingSummary, setIsEditingSummary] = useState<boolean>(false);
  const [editedHpi, setEditedHpi] = useState<string>('');
  const [editedChiefComplaint, setEditedChiefComplaint] = useState<string>('');
  const [doctorImpression, setDoctorImpression] = useState<string>('');
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [doctorAdvice, setDoctorAdvice] = useState<string>('');
  const [vitals, setVitals] = useState({
    bp: '120/80',
    pulse: '76',
    spo2: '98',
    temp: '98.6',
    rr: '18',
  });

  // Prescription builder state
  const [prescriptions, setPrescriptions] = useState<PrescribedRxItem[]>([]);
  const [newRx, setNewRx] = useState<PrescribedRxItem>({
    name: '',
    dosage: '',
    frequency: '1-0-1 (BD)',
    duration: '5 days',
    instructions: 'After food',
  });

  // Load patients and subscribe to hospital database updates
  useEffect(() => {
    const updateList = () => {
      const list = hospitalDb.getPatients();
      setPatients(list);
      if (list.length > 0 && !selectedPatientId) {
        // Default select Rahul Sharma (P10025) or emergency patient
        const rahul = list.find((p) => p.patientId === 'P10025');
        const emergencyPatient = list.find((p) =>
          p.visits.some((v) => v.triagePriority === 'emergency')
        );
        const target = rahul || emergencyPatient || list[0];
        setSelectedPatientId(target.patientId);
        if (target.visits.length > 0) {
          setSelectedVisitId(target.visits[0].visitId || target.visits[0].id);
        }
      }
    };

    updateList();
    const unsubscribe = hospitalDb.subscribe(updateList);
    return () => unsubscribe();
  }, [selectedPatientId]);

  // Selected Patient Record
  const currentPatientRecord =
    patients.find((p) => p.patientId === selectedPatientId) || patients[0];

  // Selected Visit for the current patient (defaults to latest visit)
  const currentVisit: PatientCaseEncounter | undefined =
    currentPatientRecord?.visits.find(
      (v) => v.visitId === selectedVisitId || v.id === selectedVisitId
    ) || currentPatientRecord?.visits[0];

  // Sync form states whenever currentVisit changes
  useEffect(() => {
    if (currentVisit) {
      setEditedHpi(currentVisit.clinicalSummary.historyOfPresentIllness);
      setEditedChiefComplaint(currentVisit.chiefComplaint.title);
      setDoctorImpression(
        currentVisit.doctorReview.finalImpression ||
          currentVisit.doctorReview.differentialDiagnosis?.join(', ') ||
          ''
      );
      setDoctorNotes(currentVisit.doctorReview.doctorNotes || '');
      setDoctorAdvice(
        currentVisit.doctorReview.doctorAdvice ||
          '• Drink 2.5L warm fluids daily. Maintain hydration.\n• Take prescribed medications strictly after meals.\n• Adequate bed rest for 48 hours. Avoid cold/spicy diet.\n• Immediate Return Warning: If chest pain, breathlessness, or persistent high fever occurs, report to Emergency.'
      );
      setPrescriptions(
        currentVisit.doctorReview.prescribedMedications ||
          currentVisit.medicines?.map((m) => ({
            name: m.name,
            dosage: m.dosage,
            frequency: m.frequency,
            duration: m.duration || '5 days',
            instructions: m.instructions || 'After food',
          })) ||
          []
      );
      if (currentVisit.clinicalSummary.vitals) {
        setVitals({
          bp: currentVisit.clinicalSummary.vitals.bp || '120/80',
          pulse: currentVisit.clinicalSummary.vitals.pulse || '76',
          spo2: currentVisit.clinicalSummary.vitals.spo2 || '98',
          temp: currentVisit.clinicalSummary.vitals.temp || '98.6',
          rr: currentVisit.clinicalSummary.vitals.rr || '18',
        });
      }
      setIsEditingSummary(false);
    }
  }, [currentVisit?.id, currentVisit?.visitId]);

  if (!currentPatientRecord || !currentVisit) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3 animate-spin" />
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">
          Loading OPD Clinical Queue &amp; Hospital Records...
        </h3>
      </div>
    );
  }

  // Filtered patient records for the queue list
  const filteredPatients = patients.filter((patient) => {
    const latestVisit = patient.visits[0];
    const matchesTriage =
      triageFilter === 'all' ||
      (latestVisit && latestVisit.triagePriority === triageFilter);

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesTriage;

    const matchesSearch =
      patient.patientId.toLowerCase().includes(q) ||
      patient.fullName.toLowerCase().includes(q) ||
      patient.phone.toLowerCase().includes(q) ||
      (latestVisit && latestVisit.opdToken.toLowerCase().includes(q)) ||
      (patient.abha?.abhaAddress &&
        patient.abha.abhaAddress.toLowerCase().includes(q));

    return matchesTriage && matchesSearch;
  });

  // Triage counters across active encounters
  const activeEncounters = hospitalDb.getActiveEncounters();
  const emergencyCount = activeEncounters.filter((p) => p.triagePriority === 'emergency').length;
  const urgentCount = activeEncounters.filter((p) => p.triagePriority === 'urgent').length;
  const routineCount = activeEncounters.filter((p) => p.triagePriority === 'routine').length;

  // Medicine history across all visits for this patient
  const patientMedicineHistory = hospitalDb.getPatientMedicineHistory(
    currentPatientRecord.patientId
  );

  // Doctor Action: Verify & Generate Receipt with PDF & Firebase
  const handleVerifyAndGenerateReceipt = async (saveToHis: boolean = true) => {
    setIsVerifying(true);
    currentVisit.clinicalSummary.historyOfPresentIllness = editedHpi;
    currentVisit.chiefComplaint.title = editedChiefComplaint;
    currentVisit.clinicalSummary.vitals = vitals;

    const updatedReview: DoctorVerification = {
      ...currentVisit.doctorReview,
      verified: true,
      verifiedBy: (localStorage.getItem('medico_current_user') ? JSON.parse(localStorage.getItem('medico_current_user')!).name : 'Attending Doctor'),
      verifiedAt: new Date().toISOString(),
      status: 'verified' as const,
      finalImpression: doctorImpression,
      doctorNotes,
      doctorAdvice,
      prescribedMedications: prescriptions,
    };

    // 1. Optimistic local database update
    hospitalDb.updateDoctorReview(
      currentPatientRecord.patientId,
      currentVisit.visitId || currentVisit.id,
      updatedReview,
      saveToHis
    );

    // 2. Generate client-side PDF receipt binary
    let pdfBase64: string | undefined;
    try {
      const doc = generateVisitReceiptPdf({
        patient: currentPatientRecord,
        visit: currentVisit,
        hospitalName: currentVisit.hospitalName,
      });
      pdfBase64 = doc.output('datauristring');
    } catch (e) {
      console.warn('Failed to generate PDF datauri for server upload:', e);
    }

    // 3. Persist verified review to backend and upload to Firebase Storage
    try {
      const result = await api.verifyAndGenerateReceipt(
        currentPatientRecord.patientId,
        currentVisit.visitId || currentVisit.id,
        {
          doctorReview: updatedReview,
          saveToHis,
          pdfBase64,
          hpi: editedHpi,
          chiefComplaint: editedChiefComplaint,
          vitals,
        }
      );

      currentVisit.receiptToken = result.receiptToken;
      currentVisit.receiptUrl = result.receiptUrl;

      setVerificationResult({
        receiptToken: result.receiptToken,
        receiptUrl: result.receiptUrl,
      });
    } catch (err) {
      console.error('API verify and generate receipt failed (local state preserved):', err);
      const fallbackToken = currentVisit.receiptToken || `rec_${Date.now()}`;
      currentVisit.receiptToken = fallbackToken;
      currentVisit.receiptUrl = `${window.location.origin}/receipt/${fallbackToken}`;
      setVerificationResult({
        receiptToken: fallbackToken,
        receiptUrl: currentVisit.receiptUrl,
      });
    } finally {
      setIsVerifying(false);
      setIsEditingSummary(false);
      setShowVerificationSuccess(true);
    }
  };

  // Doctor Action: Reject AI Summary
  const handleConfirmReject = () => {
    if (!rejectionReasonInput.trim()) {
      alert('Please specify the reason for rejecting the AI-generated clinical summary.');
      return;
    }

    const updatedReview = {
      ...currentVisit.doctorReview,
      verified: false,
      status: 'rejected' as const,
      rejectionReason: rejectionReasonInput.trim(),
      verifiedBy: (localStorage.getItem('medico_current_user') ? JSON.parse(localStorage.getItem('medico_current_user')!).name : 'Attending Doctor'),
      verifiedAt: new Date().toISOString(),
      doctorNotes: doctorNotes ? `${doctorNotes}\n[AI Summary Rejected: ${rejectionReasonInput.trim()}]` : `AI Summary Rejected: ${rejectionReasonInput.trim()}`,
      prescribedMedications: prescriptions,
    };

    hospitalDb.updateDoctorReview(
      currentPatientRecord.patientId,
      currentVisit.visitId || currentVisit.id,
      updatedReview,
      false
    );

    setShowRejectModal(false);
    setRejectionReasonInput('');
    alert(`AI Summary for Visit ${currentVisit.visitId} has been rejected by doctor. Reason recorded.`);
  };

  // Prescription builder handlers
  const handleAddMedication = () => {
    if (!newRx.name.trim()) return;
    const updated = [...prescriptions, { ...newRx }];
    setPrescriptions(updated);

    // Also update current visit immediately
    hospitalDb.updateDoctorReview(
      currentPatientRecord.patientId,
      currentVisit.visitId || currentVisit.id,
      {
        ...currentVisit.doctorReview,
        prescribedMedications: updated,
      }
    );

    setNewRx({
      name: '',
      dosage: '',
      frequency: '1-0-1 (BD)',
      duration: '5 days',
      instructions: 'After food',
    });
  };

  const handleRemoveMedication = (index: number) => {
    const updated = prescriptions.filter((_, idx) => idx !== index);
    setPrescriptions(updated);
    hospitalDb.updateDoctorReview(
      currentPatientRecord.patientId,
      currentVisit.visitId || currentVisit.id,
      {
        ...currentVisit.doctorReview,
        prescribedMedications: updated,
      }
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 space-y-5">
      {/* Workstation Header Bar with Excel Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-600" />
            <span>Doctor Clinical Workstation</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Multi-Visit Patient Records &bull; AI Clinical Verification &bull; Prescription &amp; PDF Receipts
          </p>
        </div>

        <button
          onClick={() => downloadHospitalExcel(patients)}
          className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 shadow-2xs transition-all cursor-pointer"
          title="Download complete hospital patient visits Excel (Hospital_Patient_Records.xlsx)"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          <span>Export Excel (All Visits)</span>
        </button>
      </div>

      {/* Top Clinical Triage Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Active OPD Queue
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-white">
              {activeEncounters.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
              Red Flag Emergency
            </div>
            <div className="text-2xl font-black text-rose-900 dark:text-rose-200">
              {emergencyCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center text-rose-700 font-bold">
            🚨
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-900 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Urgent Priority
            </div>
            <div className="text-2xl font-black text-amber-900 dark:text-amber-200">
              {urgentCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-700 font-bold">
            ⚠️
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-900 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Routine Review
            </div>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
              {routineCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-700 font-bold">
            🟢
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Patient Queue & Search, Right = Clinical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Patient Queue & Search (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Patient ID, Name, Phone..."
                className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Triage Filter Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setTriageFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  triageFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All ({activeEncounters.length})
              </button>
              <button
                onClick={() => setTriageFilter('emergency')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  triageFilter === 'emergency'
                    ? 'bg-rose-600 text-white shadow-2xs'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                🚨 Red Flag ({emergencyCount})
              </button>
              <button
                onClick={() => setTriageFilter('urgent')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  triageFilter === 'urgent'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                Urgent ({urgentCount})
              </button>
            </div>

            {/* Patients List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredPatients.map((patient) => {
                const isSelected = patient.patientId === currentPatientRecord.patientId;
                const latestVisit = patient.visits[0];
                if (!latestVisit) return null;

                return (
                  <button
                    key={patient.patientId}
                    onClick={() => {
                      setSelectedPatientId(patient.patientId);
                      setSelectedVisitId(latestVisit.visitId || latestVisit.id);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${
                      isSelected
                        ? latestVisit.triagePriority === 'emergency'
                          ? 'border-rose-600 bg-rose-50/80 dark:bg-rose-950/40 shadow-sm'
                          : 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/40 shadow-sm'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800">
                          {patient.patientId}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {latestVisit.opdToken}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                          latestVisit.triagePriority === 'emergency'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : latestVisit.triagePriority === 'urgent'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {latestVisit.triagePriority === 'emergency' && '🚨 Emergency'}
                        {latestVisit.triagePriority === 'urgent' && '⚠️ Urgent'}
                        {latestVisit.triagePriority === 'routine' && '🟢 Routine'}
                      </span>
                    </div>

                    <div className="font-black text-sm text-slate-900 dark:text-white truncate">
                      {patient.fullName}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>{patient.age}Y / {patient.gender.toUpperCase()}</span>
                      <span>•</span>
                      <span className="truncate max-w-[140px]">
                        {latestVisit.chiefComplaint.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-[10px]">
                      <span className="text-slate-500 font-mono">
                        {patient.visits.length} {patient.visits.length === 1 ? 'Visit' : 'Total Visits'}
                      </span>
                      {latestVisit.doctorReview.status === 'verified' ? (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      ) : latestVisit.doctorReview.status === 'rejected' ? (
                        <span className="text-rose-700 dark:text-rose-400 font-bold flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          AI Rejected
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          Awaiting Review
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Clinical Case Sheet Workspace (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Patient Header Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-xs font-black px-2.5 py-1 rounded-xl bg-teal-100 dark:bg-teal-900/60 text-teal-900 dark:text-teal-200 border border-teal-300 dark:border-teal-700 shadow-2xs">
                    Patient ID: {currentPatientRecord.patientId}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    {currentPatientRecord.fullName}
                  </h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {currentPatientRecord.age} Yrs / {currentPatientRecord.gender.toUpperCase()}
                  </span>
                  {currentPatientRecord.abha?.status === 'verified' && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-600" />
                      ABHA: {currentPatientRecord.abha.abhaAddress || currentPatientRecord.abha.abhaNumber}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 mt-1.5">
                  <span>Phone: <strong>{currentPatientRecord.phone}</strong></span>
                  <span>•</span>
                  <span>Total Hospital Visits: <strong>{currentPatientRecord.visits.length}</strong></span>
                  <span>•</span>
                  <span>Currently Inspecting: <strong className="font-mono text-teal-700 dark:text-teal-300">{currentVisit.visitId || 'V001'} ({currentVisit.opdToken})</strong></span>
                </div>

                {/* Accompanying Person and Known Allergies Row */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {(currentVisit.accompanyingPerson?.name || currentPatientRecord.accompanyingPerson?.name) && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 border border-teal-200 dark:border-teal-800 text-xs font-bold shadow-2xs">
                      <Users className="w-3.5 h-3.5 text-teal-600" />
                      <span>Attendant: <strong>{(currentVisit.accompanyingPerson || currentPatientRecord.accompanyingPerson)?.name}</strong> ({(currentVisit.accompanyingPerson || currentPatientRecord.accompanyingPerson)?.relation})</span>
                      <span className="text-teal-700 dark:text-teal-400 font-semibold">• Mobile: {(currentVisit.accompanyingPerson || currentPatientRecord.accompanyingPerson)?.phone || 'N/A'}</span>
                    </div>
                  )}

                  {currentVisit.knownAllergies && (
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black border shadow-2xs ${
                      currentVisit.knownAllergies.hasAllergy === 'yes'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-950 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                        : currentVisit.knownAllergies.hasAllergy === 'not_sure'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-950 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                    }`}>
                      <AlertTriangle className={`w-3.5 h-3.5 ${
                        currentVisit.knownAllergies.hasAllergy === 'yes' ? 'text-rose-600' : currentVisit.knownAllergies.hasAllergy === 'not_sure' ? 'text-amber-600' : 'text-emerald-600'
                      }`} />
                      <span>Allergy: </span>
                      <span>
                        {currentVisit.knownAllergies.hasAllergy === 'yes'
                          ? `YES — ${currentVisit.knownAllergies.details || 'Specified by patient'}`
                          : currentVisit.knownAllergies.hasAllergy === 'not_sure'
                          ? 'NOT SURE (Caution: Verify before prescribing antibiotics/NSAIDs)'
                          : 'No known drug or food allergies (NKDA)'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Real-time Firebase + Excel Storage Status Banner */}
                <div className="mt-3 flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                  {currentVisit.firebaseStoredAt ? (
                    <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Firebase: Saved ✓
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800" title="Cloud Firestore not configured or credentials not set in .env">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                      Firebase: Not Connected ✗
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    Excel: Saved ✓
                  </span>

                  <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] sm:ml-auto">
                    Stored at: {new Date(currentVisit.excelStoredAt || currentVisit.createdAt || Date.now()).toLocaleString('en-US', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    })}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print OPD Slip</span>
                </button>
                <button
                  onClick={() => setShowFhirModal(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5 text-blue-700" />
                  <span>ABDM FHIR</span>
                </button>
              </div>
            </div>

            {/* Multi-Visit History Selector Bar */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-teal-600" />
                  <span>Select Visit to Review / Compare:</span>
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">
                  {currentPatientRecord.visits.length} Encounters on Central Record
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {currentPatientRecord.visits.map((visit, idx) => {
                  const isCurrent = (visit.visitId || visit.id) === (currentVisit.visitId || currentVisit.id);
                  return (
                    <button
                      key={visit.id || idx}
                      onClick={() => setSelectedVisitId(visit.visitId || visit.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                        isCurrent
                          ? 'bg-teal-600 text-white border-teal-700 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="font-mono">
                        {visit.visitId || `V00${currentPatientRecord.visits.length - idx}`}
                      </span>
                      <span>•</span>
                      <span>{visit.visitDate || 'Recent'}</span>
                      <span className="text-[10px] opacity-80 truncate max-w-[120px]">
                        ({visit.chiefComplaint.title})
                      </span>
                      {idx === 0 && (
                        <span className="text-[9px] uppercase px-1 rounded bg-white/20">
                          Current
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Triage Priority & Red Flag Alert */}
            <div
              className={`p-4 rounded-2xl border-2 space-y-2 ${
                currentVisit.triagePriority === 'emergency'
                  ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-500 text-rose-950 dark:text-rose-200'
                  : currentVisit.triagePriority === 'urgent'
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 text-amber-950 dark:text-amber-200'
                  : 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-400 text-emerald-950 dark:text-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
                  <span className="font-black text-sm uppercase tracking-wide">
                    {currentVisit.triagePriority === 'emergency' && '🚨 TRIAGE: RED FLAG EMERGENCY ENCOUNTER'}
                    {currentVisit.triagePriority === 'urgent' && '⚠️ TRIAGE: URGENT CLINICAL REVIEW'}
                    {currentVisit.triagePriority === 'routine' && '🟢 TRIAGE: ROUTINE OPD CONSULTATION'}
                  </span>
                </div>
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-900 shadow-2xs">
                  {currentVisit.visitId} • Priority: {currentVisit.triagePriority}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold leading-relaxed">
                {currentVisit.triageRationale}
              </p>

              {/* Red Flags Action Alerts */}
              {(currentVisit.redFlags?.length ?? 0) > 0 && (
                <div className="pt-2 border-t border-rose-200/80 space-y-1.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800 dark:text-rose-300">
                    Immediate Clinical Actions Advised:
                  </div>
                  {currentVisit.redFlags?.map((rf) => (
                    <div
                      key={rf.id}
                      className="text-xs bg-white/80 dark:bg-slate-900/80 p-2 rounded-xl border border-rose-200 flex items-start gap-2"
                    >
                      <span className="text-rose-600 font-bold">•</span>
                      <div>
                        <span className="font-bold text-rose-900 dark:text-rose-300">{rf.title}: </span>
                        <span className="text-slate-800 dark:text-slate-200">{rf.clinicalActionNeeded}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Verified Visit Status Banner */}
            {currentVisit.doctorReview?.verified && (
              <div className="p-4 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border-2 border-emerald-500/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span className="font-black text-sm text-emerald-950 dark:text-emerald-200">
                      ✓ Consultation Verified by {currentVisit.doctorReview.verifiedBy || 'Doctor'}
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                      ({currentVisit.doctorReview.verifiedAt ? new Date(currentVisit.doctorReview.verifiedAt).toLocaleDateString() : 'Verified'})
                    </span>
                  </div>

                  <button
                    onClick={() => setShowVerificationSuccess(true)}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer text-xs"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Receipt Actions</span>
                  </button>
                </div>

                {/* Actions & Secure Link Bar */}
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-800 dark:text-emerald-300 font-semibold">Secure Link:</span>
                    <input
                      type="text"
                      readOnly
                      value={currentVisit.receiptUrl || verificationResult.receiptUrl || (currentVisit.receiptToken ? `${window.location.origin}/receipt/${currentVisit.receiptToken}` : '')}
                      className="text-xs bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 rounded-lg px-2.5 py-1 text-slate-700 dark:text-slate-300 font-mono w-48 sm:w-64 truncate select-all"
                    />
                    <button
                      onClick={() => {
                        const url = currentVisit.receiptUrl || verificationResult.receiptUrl || (currentVisit.receiptToken ? `${window.location.origin}/receipt/${currentVisit.receiptToken}` : '');
                        if (url) {
                          navigator.clipboard.writeText(url);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }
                      }}
                      className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy receipt URL"
                    >
                      {copiedLink ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                    </button>
                    {(currentVisit.receiptUrl || currentVisit.receiptToken) && (
                      <a
                        href={currentVisit.receiptUrl || `${window.location.origin}/receipt/${currentVisit.receiptToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 text-emerald-700 dark:text-emerald-300 hover:text-emerald-900"
                        title="Open receipt in new tab"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'summary'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>AI Case Summary &amp; Review</span>
              </button>

              <button
                onClick={() => setActiveTab('medicines')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'medicines'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Pill className="w-4 h-4" />
                <span>Medicine History ({patientMedicineHistory.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'timeline'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Medical Timeline</span>
              </button>

              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all ${
                  activeTab === 'documents'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Documents &amp; OCR ({currentVisit.documents?.length ?? 0})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: AI Clinical Summary & Doctor Review */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Bedside Vitals Recorder */}
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>Bedside Vitals (Nursing Station / Kiosk)</span>
                  <span className="text-[10px] text-teal-600 font-bold">Recorded for {currentVisit.visitId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">BP (mmHg)</label>
                    <input
                      type="text"
                      value={vitals.bp}
                      onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Pulse (bpm)</label>
                    <input
                      type="text"
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">SpO2 (%)</label>
                    <input
                      type="text"
                      value={vitals.spo2}
                      onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-teal-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Temp (°F)</label>
                    <input
                      type="text"
                      value={vitals.temp}
                      onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Resp Rate (/min)</label>
                    <input
                      type="text"
                      value={vitals.rr}
                      onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Chief Complaint & HPI with Inline Editing */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Chief Complaint &amp; History of Present Illness (HPI)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-teal-600" />
                      AI Synthesized
                    </span>
                  </div>
                  <button
                    onClick={() => setIsEditingSummary(!isEditingSummary)}
                    className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingSummary ? 'Cancel Edit' : 'Edit Narrative'}</span>
                  </button>
                </div>

                {isEditingSummary ? (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Chief Complaint Title:</label>
                      <input
                        type="text"
                        value={editedChiefComplaint}
                        onChange={(e) => setEditedChiefComplaint(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-teal-400 text-xs font-bold bg-teal-50/20"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Clinical Narrative (HPI):</label>
                      <textarea
                        rows={4}
                        value={editedHpi}
                        onChange={(e) => setEditedHpi(e.target.value)}
                        className="w-full p-3 text-xs sm:text-sm font-medium rounded-xl border border-teal-400 bg-teal-50/20 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {currentVisit.chiefComplaint.title}
                    </div>
                    <p className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                      {currentVisit.clinicalSummary.historyOfPresentIllness}
                    </p>
                  </div>
                )}

                {/* Patient Voice Transcript if recorded */}
                {currentVisit.chiefComplaint.voiceInputTranscript && (
                  <div className="p-3 bg-blue-50/70 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900 text-xs text-blue-900 dark:text-blue-300 flex items-start gap-2">
                    <span className="font-bold shrink-0">🗣️ Vernacular Audio Voice Input:</span>
                    <span className="italic">&quot;{currentVisit.chiefComplaint.voiceInputTranscript}&quot;</span>
                  </div>
                )}

                {/* AI Adaptive Follow-up Responses (Cross-Questions) */}
                {currentVisit.adaptiveAnswers && currentVisit.adaptiveAnswers.length > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                        <HelpCircle className="w-4 h-4 text-teal-600" />
                        <span>Cross-Questioning / Adaptive Follow-up Responses ({currentVisit.adaptiveAnswers.length} Questions Answered)</span>
                      </div>
                      <span className="text-[10px] text-teal-700 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded border border-teal-200 dark:border-teal-800">
                        Synthesized in Clinical AI Narrative
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {currentVisit.adaptiveAnswers.map((ans, idx) => (
                        <div
                          key={ans.questionId || idx}
                          className={`p-2.5 rounded-xl border text-xs space-y-0.5 ${
                            ans.isRedFlagIndicator
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-950 dark:text-rose-200'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            {ans.questionText}
                          </div>
                          <div className="font-bold flex items-center justify-between gap-1">
                            <span>{ans.answerText}</span>
                            {ans.isRedFlagIndicator && (
                              <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-100">
                                Red Flag
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor's Impression, Notes & Prescription Authoring */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Doctor&apos;s Clinical Assessment &amp; Notes
                </div>

                <input
                  type="text"
                  value={doctorImpression}
                  onChange={(e) => setDoctorImpression(e.target.value)}
                  placeholder="e.g. Acute tension headache / Rule out secondary cephalea"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />

                <textarea
                  rows={2}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Doctor's clinical examination notes, differential diagnosis, follow-up plan..."
                  className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />

                <div>
                  <label className="block text-[11px] font-bold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Doctor&apos;s Advice &amp; Lifestyle Tips (Included on PDF Receipt)
                  </label>
                  <textarea
                    rows={2}
                    value={doctorAdvice}
                    onChange={(e) => setDoctorAdvice(e.target.value)}
                    placeholder="e.g. Maintain hydration (2.5L daily). Adequate bed rest for 48 hours. Avoid cold/spicy food. Emergency warning: Report if high fever or breathlessness."
                    className="w-full p-3 rounded-xl border border-emerald-300 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 text-xs text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Doctor Prescription Builder */}
              <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-teal-800 dark:text-teal-400">℞</span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Prescribed Medications for Visit {currentVisit.visitId}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {prescriptions.length} items prescribed
                  </span>
                </div>

                {/* Prescriptions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                      <tr>
                        <th className="p-2">Drug Name</th>
                        <th className="p-2">Dose</th>
                        <th className="p-2">Frequency</th>
                        <th className="p-2">Duration</th>
                        <th className="p-2">Instructions</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {prescriptions.map((rx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2 font-bold text-slate-900 dark:text-white">{rx.name}</td>
                          <td className="p-2">{rx.dosage}</td>
                          <td className="p-2 font-semibold text-teal-700 dark:text-teal-400">{rx.frequency}</td>
                          <td className="p-2">{rx.duration}</td>
                          <td className="p-2 text-slate-600 dark:text-slate-400">{rx.instructions}</td>
                          <td className="p-2 text-right">
                            <button
                              onClick={() => handleRemoveMedication(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Add New Rx Row */}
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    placeholder="Medicine Name (e.g. Paracetamol)"
                    value={newRx.name}
                    onChange={(e) => setNewRx({ ...newRx, name: e.target.value })}
                    className="sm:col-span-2 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Dose (e.g. 500 mg)"
                    value={newRx.dosage}
                    onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                    className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Freq (1-0-1 / BD)"
                    value={newRx.frequency}
                    onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
                    className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    placeholder="Duration (5 days)"
                    value={newRx.duration}
                    onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
                    className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                  <button
                    onClick={handleAddMedication}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Rx</span>
                  </button>
                </div>
              </div>

              {/* Doctor Review Actions & HIS Export Bar */}
              <div className="p-5 bg-gradient-to-r from-teal-50 via-sky-50 to-emerald-50 dark:from-slate-800 dark:to-slate-900 rounded-3xl border-2 border-teal-200 dark:border-slate-700 text-slate-900 dark:text-white shadow-xs flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-black flex items-center gap-2">
                    {currentVisit.doctorReview.status === 'verified' ? (
                      <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 bg-emerald-100/80 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-300">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Digitally Verified by {currentVisit.doctorReview.verifiedBy || 'Doctor'}
                      </span>
                    ) : currentVisit.doctorReview.status === 'rejected' ? (
                      <span className="text-rose-800 dark:text-rose-300 flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/60 px-3 py-1 rounded-xl border border-rose-300">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        AI Summary Rejected by Doctor
                      </span>
                    ) : (
                      <span className="text-amber-800 dark:text-amber-300 flex items-center gap-1.5 bg-amber-100/80 dark:bg-amber-950/60 px-3 py-1 rounded-xl border border-amber-300">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Visit Awaiting Doctor Clinical Review
                      </span>
                    )}
                  </div>
                  {currentVisit.doctorReview.rejectionReason && (
                    <div className="text-xs text-rose-700 dark:text-rose-400 font-semibold">
                      Rejection Reason: {currentVisit.doctorReview.rejectionReason}
                    </div>
                  )}
                  <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                    HIS Status: <span className="font-bold">{currentVisit.savedToHis ? 'Synced to Central Hospital DB' : 'Local Record'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowRejectModal(true)}
                    className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Reject AI Summary</span>
                  </button>

                  {currentVisit.doctorReview.status === 'verified' && (
                    <button
                      onClick={() => setShowVerificationSuccess(true)}
                      className="px-3.5 py-2.5 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileDown className="w-4 h-4 text-emerald-700" />
                      <span>Download Receipt (PDF)</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleVerifyAndGenerateReceipt(true)}
                    disabled={isVerifying}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs sm:text-sm rounded-xl shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <FileDown className="w-4 h-4" />
                    )}
                    <span>{isVerifying ? 'Verifying & Generating...' : 'Verify & Generate Receipt'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Complete Medicine History Across All Visits */}
          {activeTab === 'medicines' && (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white flex items-center gap-2">
                    <Pill className="w-5 h-5 text-teal-600" />
                    <span>Complete Medicine History for {currentPatientRecord.fullName}</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    All medications ever prescribed across visits under Patient ID: <strong>{currentPatientRecord.patientId}</strong>
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                  {patientMedicineHistory.length} Total Prescriptions
                </span>
              </div>

              {patientMedicineHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs border border-dashed rounded-2xl">
                  No medication history recorded yet for this patient.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold">
                      <tr>
                        <th className="p-3">Visit ID</th>
                        <th className="p-3">Medicine Name</th>
                        <th className="p-3">Dosage</th>
                        <th className="p-3">Frequency</th>
                        <th className="p-3">Date Prescribed</th>
                        <th className="p-3">Attending Doctor</th>
                        <th className="p-3">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {patientMedicineHistory.map((med, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-bold text-teal-700 dark:text-teal-400">
                            {med.visitId}
                          </td>
                          <td className="p-3 font-black text-slate-900 dark:text-white">
                            {med.name}
                          </td>
                          <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                            {med.dosage}
                          </td>
                          <td className="p-3 font-bold text-teal-700 dark:text-teal-300">
                            {med.frequency}
                          </td>
                          <td className="p-3 text-slate-600 dark:text-slate-400 font-mono">
                            {med.datePrescribed}
                          </td>
                          <td className="p-3 text-slate-800 dark:text-slate-200 font-medium">
                            {med.doctor}
                          </td>
                          <td className="p-3 text-slate-500 italic">
                            {med.instructions || 'Standard'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Chronological Medical Timeline */}
          {activeTab === 'timeline' && (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-base text-slate-900 dark:text-white">
                    Chronological Longitudinal Health Timeline
                  </h3>
                  <p className="text-xs text-slate-500">
                    Patient history compiled across visits and diagnostic document uploads
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                  {currentVisit.timeline?.length ?? 0} Events
                </span>
              </div>

              {/* Timeline Tree */}
              <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-4 space-y-6 pl-6 py-2">
                {(currentVisit.timeline || []).map((event) => (
                  <div key={event.id} className="relative group">
                    <div
                      className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 shadow-xs ${
                        event.criticalFlag
                          ? 'bg-rose-600 ring-4 ring-rose-100'
                          : event.category === 'diagnosis'
                          ? 'bg-blue-600'
                          : event.category === 'medication'
                          ? 'bg-emerald-600'
                          : 'bg-amber-600'
                      }`}
                    />

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold text-slate-500">
                          {event.date}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                          {event.category}
                        </span>
                      </div>
                      <h4 className="font-black text-sm text-slate-900 dark:text-white">
                        {event.title}
                      </h4>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        {event.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: Original Scans & OCR */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {(!currentVisit.documents || currentVisit.documents.length === 0) ? (
                <div className="p-8 bg-white dark:bg-slate-900 rounded-3xl text-center text-slate-400 border border-slate-200 dark:border-slate-800">
                  No previous documents uploaded for Visit {currentVisit.visitId}.
                </div>
              ) : (
                currentVisit.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                      <div>
                        <h4 className="font-black text-base text-slate-900 dark:text-white">{doc.name}</h4>
                        <p className="text-xs text-slate-500">
                          {doc.facilityName} • {doc.doctorName} • Date: {doc.documentDate}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 uppercase">
                        {doc.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Original Scanned Document
                        </span>
                        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 max-h-[380px] flex items-center justify-center">
                          <img
                            src={doc.previewUrl}
                            alt={doc.name}
                            className="w-full h-auto object-contain max-h-[380px]"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          AI &amp; OCR Clinical Extraction
                        </span>
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs leading-relaxed max-h-[380px] overflow-y-auto space-y-3">
                          <div className="text-teal-700 dark:text-teal-400 font-bold border-b border-slate-200 pb-1">
                            --- EXTRACTED CLINICAL ENTITIES ---
                          </div>
                          {doc.extractedDiagnoses.map((d) => (
                            <div key={d.id} className="text-blue-700 dark:text-blue-400 font-semibold">
                              [Diagnosis] {d.condition} (ICD-10: {d.icd10Estimate})
                            </div>
                          ))}
                          {doc.extractedMedications.map((m) => (
                            <div key={m.id} className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              [Medication] {m.name} {m.dosage} - {m.frequency}
                            </div>
                          ))}
                          {doc.extractedLabValues.map((l) => (
                            <div
                              key={l.id}
                              className={
                                l.status === 'critical'
                                  ? 'text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200'
                                  : 'text-slate-700 dark:text-slate-300 font-medium'
                              }
                            >
                              [Lab] {l.testName}: {l.value} {l.unit} ({l.status.toUpperCase()})
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Reject AI Summary */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-200 dark:border-rose-900 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-lg font-black tracking-tight">Reject AI Summary</h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Specify reason for rejecting the AI clinical case summary for {currentPatientRecord.fullName} ({currentVisit.visitId}). This action is logged in the hospital audit trail.
            </p>

            <textarea
              rows={3}
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="e.g. AI hallucinated prior surgical history; clinical presentation is tension headache..."
              className="w-full p-3 rounded-xl border border-rose-300 dark:border-rose-800 text-xs font-medium bg-rose-50/30 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 text-xs font-bold border border-slate-300 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="px-4 py-2 text-xs font-black bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing ABDM FHIR & Print Modals */}
      <FhirBundleModal
        isOpen={showFhirModal}
        onClose={() => setShowFhirModal(false)}
        encounter={currentVisit}
      />
      <OpdSlipPrint
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        encounter={currentVisit}
      />

      {/* Post-Verification Success & PDF Receipt Download Modal */}
      {showVerificationSuccess && currentPatientRecord && currentVisit && (
        <VerificationSuccessModal
          patient={currentPatientRecord}
          visit={currentVisit}
          onClose={() => setShowVerificationSuccess(false)}
          receiptToken={verificationResult.receiptToken || currentVisit.receiptToken}
          receiptUrl={verificationResult.receiptUrl || currentVisit.receiptUrl}
        />
      )}
    </div>
  );
};
