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
  Save,
  Printer,
  Sparkles,
  Calendar,
  Layers,
  Stethoscope,
  Database,
} from 'lucide-react';
import type {
  PatientCaseEncounter,
  TriagePriority,
  PrescribedRxItem,
} from '../../types/clinical';
import { storage } from '../../services/storage';
import { FhirBundleModal } from './FhirBundleModal';
import { OpdSlipPrint } from './OpdSlipPrint';

export const DoctorDashboard: React.FC = () => {
  const [encounters, setEncounters] = useState<PatientCaseEncounter[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [triageFilter, setTriageFilter] = useState<'all' | TriagePriority>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'summary' | 'timeline' | 'documents'>('summary');

  // Modals
  const [showFhirModal, setShowFhirModal] = useState<boolean>(false);
  const [showPrintModal, setShowPrintModal] = useState<boolean>(false);

  // Edit states for current patient
  const [isEditingSummary, setIsEditingSummary] = useState<boolean>(false);
  const [editedHpi, setEditedHpi] = useState<string>('');
  const [doctorImpression, setDoctorImpression] = useState<string>('');
  const [doctorNotes, setDoctorNotes] = useState<string>('');
  const [vitals, setVitals] = useState({
    bp: '130/85',
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

  // Load and subscribe to updates
  useEffect(() => {
    const updateList = () => {
      const list = storage.getPatients();
      setEncounters(list);
      if (list.length > 0 && !selectedPatientId) {
        // default select highest priority or first
        const emergencyPatient = list.find((p) => p.triagePriority === 'emergency');
        setSelectedPatientId(emergencyPatient ? emergencyPatient.id : list[0].id);
      }
    };

    updateList();
    const unsubscribe = storage.subscribe(updateList);
    return () => unsubscribe();
  }, [selectedPatientId]);

  // Current selected encounter
  const currentPatient = encounters.find((p) => p.id === selectedPatientId) || encounters[0];

  // Sync edit form with current patient
  useEffect(() => {
    if (currentPatient) {
      setEditedHpi(currentPatient.clinicalSummary.historyOfPresentIllness);
      setDoctorImpression(currentPatient.doctorReview.finalImpression || currentPatient.doctorReview.differentialDiagnosis?.join(', ') || '');
      setDoctorNotes(currentPatient.doctorReview.doctorNotes || '');
      setPrescriptions(currentPatient.doctorReview.prescribedMedications || []);
      setIsEditingSummary(false);
    }
  }, [currentPatient?.id]);

  if (!currentPatient) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Activity className="w-12 h-12 text-slate-400 mx-auto mb-3 animate-spin" />
        <h3 className="text-lg font-bold text-slate-700">Loading OPD Clinical Queue...</h3>
      </div>
    );
  }

  // Filtered queue
  const filteredPatients = encounters.filter((p) => {
    const matchesTriage = triageFilter === 'all' || p.triagePriority === triageFilter;
    const matchesSearch =
      p.demographics.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.opdToken.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.demographics.abha.abhaAddress &&
        p.demographics.abha.abhaAddress.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesTriage && matchesSearch;
  });

  // Counters
  const emergencyCount = encounters.filter((p) => p.triagePriority === 'emergency').length;
  const urgentCount = encounters.filter((p) => p.triagePriority === 'urgent').length;
  const routineCount = encounters.filter((p) => p.triagePriority === 'routine').length;

  // Save changes & verify
  const handleSaveAndVerify = (saveToHis: boolean = false) => {
    const updatedReview = {
      ...currentPatient.doctorReview,
      verified: true,
      verifiedBy: 'Dr. S. K. Verma, MD',
      verifiedAt: new Date().toISOString(),
      status: 'verified' as const,
      finalImpression: doctorImpression,
      doctorNotes,
      prescribedMedications: prescriptions,
    };

    // Update patient in storage
    currentPatient.clinicalSummary.historyOfPresentIllness = editedHpi;
    storage.updateDoctorReview(currentPatient.id, updatedReview, saveToHis);
    setIsEditingSummary(false);

    alert(
      saveToHis
        ? `Encounter ${currentPatient.opdToken} successfully signed & saved to Hospital Information System (HIS)!`
        : `AI Clinical Summary verified and signed for ${currentPatient.demographics.fullName}.`
    );
  };

  // Add medicine to prescription list
  const handleAddMedication = () => {
    if (!newRx.name.trim()) return;
    setPrescriptions((prev) => [...prev, { ...newRx }]);
    setNewRx({
      name: '',
      dosage: '',
      frequency: '1-0-1 (BD)',
      duration: '5 days',
      instructions: 'After food',
    });
  };

  const handleRemoveMedication = (index: number) => {
    setPrescriptions((prev) => prev.filter((_, idx) => idx !== index));
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5">
      {/* Top Clinical Triage Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Total OPD Queue
            </div>
            <div className="text-2xl font-black text-slate-900">{encounters.length}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping"></span>
              Red Flag Emergency
            </div>
            <div className="text-2xl font-black text-rose-900">{emergencyCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-700 font-bold">
            🚨
          </div>
        </div>

        <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Urgent Priority
            </div>
            <div className="text-2xl font-black text-amber-900">{urgentCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
            ⚠️
          </div>
        </div>

        <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Routine Review
            </div>
            <div className="text-2xl font-black text-emerald-900">{routineCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold">
            🟢
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Patient Queue, Right = Clinical Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Patient Queue (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
            {/* Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Token, Name, ABHA..."
                className="w-full pl-9 pr-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                onClick={() => setTriageFilter('all')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  triageFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({encounters.length})
              </button>
              <button
                onClick={() => setTriageFilter('emergency')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  triageFilter === 'emergency'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-rose-700 hover:bg-rose-100'
                }`}
              >
                🚨 Red Flag ({emergencyCount})
              </button>
              <button
                onClick={() => setTriageFilter('urgent')}
                className={`flex-1 py-1.5 rounded-lg transition-all ${
                  triageFilter === 'urgent'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-700 hover:bg-amber-100'
                }`}
              >
                Urgent ({urgentCount})
              </button>
            </div>

            {/* Patient Cards List */}
            <div className="space-y-2.5 max-h-[640px] overflow-y-auto pr-1">
              {filteredPatients.map((patient) => {
                const isSelected = patient.id === currentPatient.id;
                return (
                  <button
                    key={patient.id}
                    onClick={() => setSelectedPatientId(patient.id)}
                    className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all duration-200 ${
                      isSelected
                        ? patient.triagePriority === 'emergency'
                          ? 'border-rose-600 bg-rose-50/70 shadow-md ring-2 ring-rose-500/20'
                          : 'border-hospital-700 bg-teal-50/70 shadow-md ring-2 ring-teal-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs font-black text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                        {patient.opdToken}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          patient.triagePriority === 'emergency'
                            ? 'bg-rose-600 text-white animate-pulse'
                            : patient.triagePriority === 'urgent'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {patient.triagePriority === 'emergency' && '🚨 Red Flag'}
                        {patient.triagePriority === 'urgent' && '⚠️ Urgent'}
                        {patient.triagePriority === 'routine' && '🟢 Routine'}
                      </span>
                    </div>

                    <div className="font-extrabold text-sm text-slate-900 truncate">
                      {patient.demographics.fullName}
                    </div>

                    <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>{patient.demographics.age}Y / {patient.demographics.gender.toUpperCase()}</span>
                      <span>•</span>
                      <span className="truncate max-w-[140px]">
                        {patient.chiefComplaint.title}
                      </span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/80 text-[10px]">
                      <span className="text-slate-500 font-mono">
                        {patient.demographics.abha.abhaAddress || 'ABHA Verified'}
                      </span>
                      {patient.doctorReview.verified ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Verified
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">
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
          {/* Patient Overview Banner */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    {currentPatient.demographics.fullName}
                  </h2>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {currentPatient.demographics.age} Yrs / {currentPatient.demographics.gender.toUpperCase()}
                  </span>
                  {currentPatient.demographics.abha.status === 'verified' && (
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-blue-700" />
                      ABHA: {currentPatient.demographics.abha.abhaAddress || currentPatient.demographics.abha.abhaNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Encounter: <span className="font-mono font-bold text-slate-800">{currentPatient.opdToken}</span> • {currentPatient.opdRoom} • Registered {new Date(currentPatient.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print OPD Slip</span>
                </button>
                <button
                  onClick={() => setShowFhirModal(true)}
                  className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                >
                  <Database className="w-3.5 h-3.5 text-blue-700" />
                  <span>ABDM FHIR Bundle</span>
                </button>
              </div>
            </div>

            {/* Triage Priority & Red Flag Banner */}
            <div
              className={`p-4 rounded-2xl border-2 space-y-2 ${
                currentPatient.triagePriority === 'emergency'
                  ? 'bg-rose-50/90 border-rose-500 text-rose-950'
                  : currentPatient.triagePriority === 'urgent'
                  ? 'bg-amber-50/90 border-amber-400 text-amber-950'
                  : 'bg-emerald-50/90 border-emerald-400 text-emerald-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
                  <span className="font-black text-sm uppercase tracking-wide">
                    {currentPatient.triagePriority === 'emergency' && '🚨 TRIAGE: RED FLAG EMERGENCY ENCOUNTER'}
                    {currentPatient.triagePriority === 'urgent' && '⚠️ TRIAGE: URGENT CLINICAL REVIEW'}
                    {currentPatient.triagePriority === 'routine' && '🟢 TRIAGE: ROUTINE OPD CONSULTATION'}
                  </span>
                </div>
                <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-md bg-white shadow-2xs">
                  Priority: {currentPatient.triagePriority}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold leading-relaxed">
                {currentPatient.triageRationale}
              </p>

              {/* Red Flag Action Alerts */}
              {currentPatient.redFlags.length > 0 && (
                <div className="pt-2 border-t border-rose-200/80 space-y-1.5">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-rose-800">
                    Immediate Clinical Actions Advised:
                  </div>
                  {currentPatient.redFlags.map((rf) => (
                    <div key={rf.id} className="text-xs bg-white/80 p-2 rounded-xl border border-rose-200 flex items-start gap-2">
                      <span className="text-rose-600 font-bold">•</span>
                      <div>
                        <span className="font-bold text-rose-900">{rf.title}: </span>
                        <span className="text-slate-800">{rf.clinicalActionNeeded}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Workspace Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveTab('summary')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  activeTab === 'summary'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>AI Clinical Summary &amp; Review</span>
              </button>
              <button
                onClick={() => setActiveTab('timeline')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  activeTab === 'timeline'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Medical Timeline ({currentPatient.timeline.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
                  activeTab === 'documents'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Original Scans &amp; OCR ({currentPatient.documents.length})</span>
              </button>
            </div>
          </div>

          {/* TAB 1: AI Case Summary & Doctor Verification */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              {/* Vitals Input Bar */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                  Bedside Vitals (Recorded at Nursing Station)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">BP (mmHg)</label>
                    <input
                      type="text"
                      value={vitals.bp}
                      onChange={(e) => setVitals({ ...vitals, bp: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Pulse (bpm)</label>
                    <input
                      type="text"
                      value={vitals.pulse}
                      onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">SpO2 (%)</label>
                    <input
                      type="text"
                      value={vitals.spo2}
                      onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200 text-teal-700"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Temp (°F)</label>
                    <input
                      type="text"
                      value={vitals.temp}
                      onChange={(e) => setVitals({ ...vitals, temp: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600">Resp Rate (/min)</label>
                    <input
                      type="text"
                      value={vitals.rr}
                      onChange={(e) => setVitals({ ...vitals, rr: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold bg-slate-50 border border-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Chief Complaint & HPI Section */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                      Chief Complaint &amp; History of Present Illness (HPI)
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-teal-600" />
                      AI Synthesized
                    </span>
                  </div>
                  <button
                    onClick={() => setIsEditingSummary(!isEditingSummary)}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isEditingSummary ? 'Cancel Edit' : 'Edit Narrative'}</span>
                  </button>
                </div>

                {isEditingSummary ? (
                  <textarea
                    rows={4}
                    value={editedHpi}
                    onChange={(e) => setEditedHpi(e.target.value)}
                    className="w-full p-3 text-xs sm:text-sm font-medium rounded-xl border border-teal-500 bg-teal-50/20 focus:outline-none"
                  />
                ) : (
                  <p className="text-xs sm:text-sm leading-relaxed text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-medium">
                    {currentPatient.clinicalSummary.historyOfPresentIllness}
                  </p>
                )}

                {/* Patient's Voice Transcript if available */}
                {currentPatient.chiefComplaint.voiceInputTranscript && (
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-xs text-blue-900 flex items-start gap-2">
                    <span className="font-bold shrink-0">🗣️ Vernacular Audio Voice Input:</span>
                    <span className="italic">"{currentPatient.chiefComplaint.voiceInputTranscript}"</span>
                  </div>
                )}
              </div>

              {/* Past History & Active Medications Reconciled */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Reconciled Past Morbidities
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {currentPatient.clinicalSummary.pastMedicalHistory.map((cond, idx) => (
                      <span
                        key={idx}
                        className="text-xs font-bold px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 border border-slate-200"
                      >
                        {cond}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    Active Medications (From Scans)
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {currentPatient.clinicalSummary.activeMedications.length > 0 ? (
                      currentPatient.clinicalSummary.activeMedications.map((m) => (
                        <div
                          key={m.id}
                          className="text-xs p-2 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center"
                        >
                          <div>
                            <span className="font-bold text-slate-900">{m.name}</span>{' '}
                            <span className="text-slate-600">{m.dosage}</span>
                          </div>
                          <span className="text-[11px] font-semibold text-teal-700">
                            {m.frequency}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-400 py-2">
                        No chronic medications extracted from prior records.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Doctor's Impression & Differential Diagnosis */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Doctor's Clinical Impression &amp; Differential Diagnosis
                </div>
                <input
                  type="text"
                  value={doctorImpression}
                  onChange={(e) => setDoctorImpression(e.target.value)}
                  placeholder="e.g., Acute Inferior Wall STEMI / ACS / Rule out Aortic Dissection"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />

                <textarea
                  rows={2}
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="Doctor's clinical examination notes, patient instructions, follow-up advice..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>

              {/* Doctor's Rx Prescription Builder */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black text-teal-800">℞</span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Prescribed Medications (Author Rx)
                    </span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {prescriptions.length} items prescribed
                  </span>
                </div>

                {/* Prescriptions Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                      <tr>
                        <th className="p-2">Drug Name</th>
                        <th className="p-2">Dose</th>
                        <th className="p-2">Frequency</th>
                        <th className="p-2">Duration</th>
                        <th className="p-2">Instructions</th>
                        <th className="p-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {prescriptions.map((rx, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{rx.name}</td>
                          <td className="p-2">{rx.dosage}</td>
                          <td className="p-2 font-semibold text-teal-700">{rx.frequency}</td>
                          <td className="p-2">{rx.duration}</td>
                          <td className="p-2 text-slate-600">{rx.instructions}</td>
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
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-200">
                  <input
                    type="text"
                    placeholder="Medicine Name"
                    value={newRx.name}
                    onChange={(e) => setNewRx({ ...newRx, name: e.target.value })}
                    className="sm:col-span-2 px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200 font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Dose (e.g. 500mg)"
                    value={newRx.dosage}
                    onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })}
                    className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="Freq (1-0-1)"
                    value={newRx.frequency}
                    onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })}
                    className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200"
                  />
                  <input
                    type="text"
                    placeholder="Duration"
                    value={newRx.duration}
                    onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })}
                    className="px-3 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200"
                  />
                  <button
                    onClick={handleAddMedication}
                    className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Rx</span>
                  </button>
                </div>
              </div>

              {/* Doctor Review Actions & HIS Export */}
              <div className="p-5 bg-gradient-to-r from-teal-50 via-sky-50 to-emerald-50 rounded-3xl border-2 border-teal-200/80 text-slate-900 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-extrabold flex items-center gap-2">
                    {currentPatient.doctorReview.verified ? (
                      <span className="text-emerald-700 flex items-center gap-1.5 bg-emerald-100/80 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <CheckCircle className="w-4 h-4 text-emerald-600" />
                        Digitally Verified by {currentPatient.doctorReview.verifiedBy}
                      </span>
                    ) : (
                      <span className="text-amber-800 flex items-center gap-1.5 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-200">
                        <Clock className="w-4 h-4 text-amber-600" />
                        Case Awaiting Doctor Digital Sign-Off
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 font-medium">
                    HIS Status: <span className="font-bold text-slate-800">{currentPatient.savedToHis ? 'Synced to Hospital Database' : 'Local Draft'}</span> • ABDM Ready
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => handleSaveAndVerify(false)}
                    className="px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>Verify Summary</span>
                  </button>
                  <button
                    onClick={() => handleSaveAndVerify(true)}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save to HIS &amp; Link ABDM</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Chronological Medical Timeline */}
          {activeTab === 'timeline' && (
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Chronological Longitudinal Health Timeline
                  </h3>
                  <p className="text-xs text-slate-500">
                    Synthesized from patient-uploaded prescriptions, lab reports and discharge summaries
                  </p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                  {currentPatient.timeline.length} Events Reconstructed
                </span>
              </div>

              {/* Timeline Tree */}
              <div className="relative border-l-2 border-slate-200 ml-4 space-y-6 pl-6 py-2">
                {currentPatient.timeline.map((event) => (
                  <div key={event.id} className="relative group">
                    {/* Node Dot */}
                    <div
                      className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                        event.criticalFlag
                          ? 'bg-rose-600 ring-4 ring-rose-100'
                          : event.category === 'diagnosis'
                          ? 'bg-blue-600'
                          : event.category === 'medication'
                          ? 'bg-emerald-600'
                          : 'bg-amber-600'
                      }`}
                    />

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition-colors space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-extrabold text-slate-500">
                          {event.date}
                        </span>
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                          {event.category}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-sm text-slate-900">
                        {event.title}
                      </h4>
                      <p className="text-xs text-slate-700 leading-relaxed">
                        {event.details}
                      </p>
                      {event.sourceDocName && (
                        <div className="text-[10px] text-slate-400 pt-1">
                          Source Document: <span className="font-semibold">{event.sourceDocName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Original Scans & OCR Text View */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              {currentPatient.documents.length === 0 ? (
                <div className="p-8 bg-white rounded-3xl text-center text-slate-400 border border-slate-200">
                  No documents uploaded for this patient.
                </div>
              ) : (
                currentPatient.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                      <div>
                        <h4 className="font-extrabold text-base text-slate-900">{doc.name}</h4>
                        <p className="text-xs text-slate-500">
                          {doc.facilityName} • {doc.doctorName} • Date: {doc.documentDate}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200 uppercase">
                        {doc.type}
                      </span>
                    </div>

                    {/* Side-by-side: Left Image scan, Right OCR text */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Document Preview Image */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Original Scanned Document
                        </span>
                        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-100 max-h-[420px] flex items-center justify-center">
                          <img
                            src={doc.previewUrl}
                            alt={doc.name}
                            className="w-full h-auto object-contain max-h-[420px]"
                          />
                        </div>
                      </div>

                      {/* OCR Extracted Text & Entities */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          AI &amp; OCR Clinical Extraction
                        </span>
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs leading-relaxed max-h-[420px] overflow-y-auto space-y-3">
                          <div className="text-teal-700 font-bold border-b border-slate-200 pb-1">
                            --- RAW OCR TEXT EXTRACT ---
                          </div>
                          <pre className="whitespace-pre-wrap text-slate-700">{doc.ocrRawText || 'Text extraction complete.'}</pre>

                          <div className="text-amber-800 font-bold border-b border-slate-200 pt-2 pb-1">
                            --- EXTRACTED CLINICAL ENTITIES ---
                          </div>
                          {doc.extractedDiagnoses.map((d) => (
                            <div key={d.id} className="text-blue-700 font-medium">
                              [Diagnosis] {d.condition} (ICD-10: {d.icd10Estimate})
                            </div>
                          ))}
                          {doc.extractedMedications.map((m) => (
                            <div key={m.id} className="text-emerald-700 font-medium">
                              [Medication] {m.name} {m.dosage} - {m.frequency}
                            </div>
                          ))}
                          {doc.extractedLabValues.map((l) => (
                            <div
                              key={l.id}
                              className={l.status === 'critical' ? 'text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-200' : 'text-slate-700 font-medium'}
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

      {/* Modals */}
      <FhirBundleModal
        isOpen={showFhirModal}
        onClose={() => setShowFhirModal(false)}
        encounter={currentPatient}
      />
      <OpdSlipPrint
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        encounter={currentPatient}
      />
    </div>
  );
};
