import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Calendar,
  CheckCircle2,
  ArrowRight,
  Pill,
  Building2,
  PlusCircle,
  Shield,
  X,
  FileSpreadsheet,
  AlertCircle,
  Bed,
  Printer,
} from 'lucide-react';
import type { PatientRecord, Gender, AuthUser, PatientCaseEncounter } from '../../types/clinical';
import { hospitalDb } from '../../services/hospitalDatabase';
import { downloadHospitalExcel } from '../../services/excelService';

interface ReceptionDashboardProps {
  onSendToKiosk?: (patientId: string) => void;
  currentUser?: AuthUser | null;
}

export const ReceptionDashboard: React.FC<ReceptionDashboardProps> = ({ onSendToKiosk, currentUser }) => {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);

  // Modals
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [showNewVisitModal, setShowNewVisitModal] = useState<boolean>(false);
  const [showAddDoctorModal, setShowAddDoctorModal] = useState<boolean>(false);
  const [showIpdModal, setShowIpdModal] = useState<boolean>(false);

  // Emergency IPD Fast-Track State
  const [ipdForm, setIpdForm] = useState({
    fullName: '',
    age: 40,
    phone: '',
    bedWard: 'Emergency Bed 1 (Acute Resus)',
  });
  const [ipdSuccessEncounter, setIpdSuccessEncounter] = useState<PatientCaseEncounter | null>(null);

  // New Patient Form State
  const [newPatientForm, setNewPatientForm] = useState({
    fullName: '',
    age: 30,
    gender: 'male' as Gender,
    phone: '',
    address: 'District Hospital Area',
    emergencyContact: '',
    abhaNumber: '',
  });

  // New Visit Form State
  const [newVisitForm, setNewVisitForm] = useState({
    problem: '',
    department: 'Internal Medicine',
    room: 'Room 4 (General Medicine)',
    doctor: 'Dr. S. K. Verma, MD',
  });

  // Add Doctor Form State
  const [addDoctorForm, setAddDoctorForm] = useState({
    name: '',
    username: '',
    password: '',
    hospitalName: currentUser?.hospitalName || '',
  });

  // Subscribe to central hospital database updates
  useEffect(() => {
    const update = () => {
      const list = hospitalDb.getPatients();
      setPatients(list);
      if (list.length > 0 && !selectedPatient) {
        // Default select Rahul Sharma (P10025) or first patient for rich demonstration
        const rahul = list.find((p) => p.patientId === 'P10025');
        setSelectedPatient(rahul || list[0]);
      } else if (selectedPatient) {
        // Keep updated record
        const refreshed = hospitalDb.getPatientById(selectedPatient.patientId);
        if (refreshed) setSelectedPatient(refreshed);
      }
    };

    update();
    const unsub = hospitalDb.subscribe(update);
    return () => unsub();
  }, [selectedPatient?.patientId]);

  // Filtered patients based on search
  const filteredPatients = hospitalDb.searchPatients(searchQuery);

  // Stats
  const totalPatients = patients.length;
  const totalVisitsCount = patients.reduce((acc, p) => acc + p.visits.length, 0);

  // Register New Patient Handler
  const handleRegisterPatient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientForm.fullName.trim() || !newPatientForm.phone.trim()) {
      alert('Please provide patient name and contact phone number.');
      return;
    }

    const created = hospitalDb.registerPatient(newPatientForm);
    setSelectedPatient(created);
    setShowRegisterModal(false);

    // Reset form
    setNewPatientForm({
      fullName: '',
      age: 30,
      gender: 'male',
      phone: '',
      address: 'District Hospital Area',
      emergencyContact: '',
      abhaNumber: '',
    });

    alert(`Patient successfully registered!\nAssigned Patient ID: ${created.patientId}`);
  };

  // Start New Visit Handler
  const handleCreateNewVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient) return;
    if (!newVisitForm.problem.trim()) {
      alert('Please enter patient complaint / reason for visit.');
      return;
    }

    const newEncounter = hospitalDb.createVisit(selectedPatient.patientId, {
      specialty: newVisitForm.department,
      opdRoom: newVisitForm.room,
      attendingDoctor: newVisitForm.doctor,
      chiefComplaint: {
        id: 'other',
        title: newVisitForm.problem,
        description: `New visit booked at reception: ${newVisitForm.problem}`,
        onsetDuration: 'Acute presentation',
      },
      clinicalSummary: {
        chiefComplaintFormatted: `${newVisitForm.problem} (${selectedPatient.fullName}, ${selectedPatient.age}Y/${selectedPatient.gender.toUpperCase()})`,
        historyOfPresentIllness: `Patient presented to OPD Reception reporting: ${newVisitForm.problem}. Assigned to ${newVisitForm.room} with ${newVisitForm.doctor}.`,
        pastMedicalHistory: [],
        activeMedications: [],
        allergies: [],
        investigationsSummary: 'Awaiting doctor clinical evaluation.',
      },
    });

    setShowNewVisitModal(false);
    setNewVisitForm({
      problem: '',
      department: 'Internal Medicine',
      room: 'Room 4 (General Medicine)',
      doctor: 'Dr. S. K. Verma, MD',
    });

    alert(
      `New visit successfully created under ${selectedPatient.patientId}!\nAssigned Token: ${newEncounter.opdToken}\nVisit ID: ${newEncounter.visitId}`
    );
  };

  // Fast-Track Emergency IPD Admission Handler
  const handleEmergencyIpdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipdForm.fullName.trim() || !ipdForm.phone.trim()) {
      alert('Please provide patient name and contact phone number for IPD admission.');
      return;
    }

    const created = hospitalDb.registerIpdPatient({
      fullName: ipdForm.fullName.trim(),
      age: Number(ipdForm.age) || 40,
      phone: ipdForm.phone.trim(),
      bedWard: ipdForm.bedWard,
    });

    const refreshed = created.patientId ? hospitalDb.getPatientById(created.patientId) : undefined;
    if (refreshed) {
      setSelectedPatient(refreshed);
    }
    setIpdSuccessEncounter(created);
    setShowIpdModal(false);
  };

  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDoctorForm.name.trim() || !addDoctorForm.username.trim() || !addDoctorForm.password.trim() || !addDoctorForm.hospitalName.trim()) {
      alert('Please fill all doctor details.');
      return;
    }

    try {
      const existing = localStorage.getItem('medico_registered_doctors');
      const doctors = existing ? JSON.parse(existing) : [];
      doctors.push({
        name: addDoctorForm.name.trim(),
        username: addDoctorForm.username.trim(),
        password: addDoctorForm.password.trim(),
        hospitalName: addDoctorForm.hospitalName.trim(),
      });
      localStorage.setItem('medico_registered_doctors', JSON.stringify(doctors));
      
      setShowAddDoctorModal(false);
      setAddDoctorForm({
        name: '',
        username: '',
        password: '',
        hospitalName: currentUser?.hospitalName || '',
      });
      alert('Doctor successfully registered! They can now log in using these credentials.');
    } catch {
      alert('Failed to register doctor.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      {/* Top Welcome & Reception Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Registered Hospital Patients
            </div>
            <div className="text-3xl font-black text-slate-900 dark:text-white mt-0.5">
              {totalPatients}
            </div>
            <div className="text-xs text-teal-700 dark:text-teal-400 font-semibold mt-1">
              Central Hospital Directory
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center">
            <Building2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Recorded Visits
            </div>
            <div className="text-3xl font-black text-sky-900 dark:text-sky-300 mt-0.5">
              {totalVisitsCount}
            </div>
            <div className="text-xs text-sky-700 dark:text-sky-400 font-semibold mt-1">
              Multi-encounter tracking
            </div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="p-4 bg-gradient-to-tr from-teal-600 to-sky-700 rounded-3xl text-white shadow-md flex items-center justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-teal-100">
              Quick Actions
            </div>
            <div className="text-xl font-black mt-0.5">Management</div>
            <p className="text-xs text-teal-100/90 mt-1">Patient intake & staff</p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowRegisterModal(true)}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-teal-800 font-black text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Patient</span>
            </button>
            <button
              onClick={() => setShowIpdModal(true)}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <Bed className="w-4 h-4" />
              <span>🚨 Emergency IPD</span>
            </button>
            <button
              onClick={() => setShowAddDoctorModal(true)}
              className="px-4 py-2 bg-sky-100 hover:bg-sky-50 text-sky-900 font-black text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Doctor</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Reception Grid: Left = Search & Patient List, Right = Selected Patient Details & Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Search & Patient List (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Search Patient Records
                </h3>
                <p className="text-xs text-slate-500">
                  Search by Patient ID, Full Name, or Phone
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadHospitalExcel(patients)}
                  className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Download complete hospital patient visits Excel (Hospital_Patient_Records.xlsx)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Excel</span>
                </button>
                <button
                  onClick={() => setShowRegisterModal(true)}
                  className="px-3 py-1.5 bg-teal-50 dark:bg-teal-950/50 hover:bg-teal-100 text-teal-700 dark:text-teal-300 font-bold text-xs rounded-xl border border-teal-200 dark:border-teal-800 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. P10025, Rahul, 987654..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-xs font-bold bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Patients List */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredPatients.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No matching patients found. Click &quot;Register Patient&quot; above to add a new record.
                </div>
              ) : (
                filteredPatients.map((patient) => {
                  const isSelected = selectedPatient?.patientId === patient.patientId;
                  const latestVisit = patient.visits[0];
                  return (
                    <button
                      key={patient.patientId}
                      onClick={() => setSelectedPatient(patient)}
                      className={`w-full text-left p-3.5 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? 'border-teal-600 bg-teal-50/70 dark:bg-teal-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-black px-2 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            {patient.patientId}
                          </span>
                          {latestVisit?.isIpd ? (
                            <span className="font-mono text-[9px] font-black px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                              IPD
                            </span>
                          ) : (
                            <span className="font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                              OPD
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {patient.visits.length} {patient.visits.length === 1 ? 'Visit' : 'Visits'}
                        </span>
                      </div>

                      <div className="font-black text-sm text-slate-900 dark:text-white">
                        {patient.fullName}
                      </div>

                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{patient.age}Y / {patient.gender.toUpperCase()}</span>
                        <span>•</span>
                        <span>{patient.phone}</span>
                      </div>

                      {latestVisit && (
                        <div className="mt-2 pt-2 border-t border-slate-200/70 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 truncate">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">Last visit: </span>
                          <span>{latestVisit.chiefComplaint.title} ({latestVisit.visitDate || 'Recent'})</span>
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Patient Profile & Multi-Visit History (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {selectedPatient ? (
            <>
              {/* Existing Patient Found Card */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
                {/* Banner Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Existing Patient Found
                      </span>
                      <span className="font-mono font-black text-sm text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800">
                        {selectedPatient.patientId}
                      </span>
                    </div>

                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                      {selectedPatient.fullName}
                    </h2>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3 mt-1">
                      <span>Age: <strong>{selectedPatient.age} Yrs</strong></span>
                      <span>•</span>
                      <span>Gender: <strong>{selectedPatient.gender.toUpperCase()}</strong></span>
                      <span>•</span>
                      <span>Phone: <strong>{selectedPatient.phone}</strong></span>
                    </div>

                    {/* Dual Storage Status Confirmation */}
                    {selectedPatient.visits && selectedPatient.visits[0] && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
                        {selectedPatient.visits[0].firebaseStoredAt ? (
                          <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Firebase: Saved ✓
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-800" title="Configure FIREBASE_PROJECT_ID and FIREBASE_API_KEY in .env to enable Cloud Firestore">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                            Firebase: Not Connected ✗
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Excel: Saved ✓
                        </span>

                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] sm:ml-auto">
                          Stored at: {new Date(selectedPatient.visits[0].excelStoredAt || selectedPatient.visits[0].createdAt || Date.now()).toLocaleString('en-US', {
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
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {onSendToKiosk && (
                      <button
                        type="button"
                        onClick={() => onSendToKiosk(selectedPatient.patientId)}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-2xl shadow-2xs transition-all flex items-center gap-1.5"
                        title="Open Patient Kiosk for this patient"
                      >
                        <ArrowRight className="w-4 h-4 text-teal-600" />
                        <span>Open in Kiosk</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNewVisitModal(true)}
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Start New Visit</span>
                    </button>
                  </div>
                </div>

                {/* Patient Details Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Residential Address
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedPatient.address || 'District Catchment Area'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      ABHA Digital Health ID
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 font-mono">
                      <Shield className="w-3.5 h-3.5 text-blue-600" />
                      {selectedPatient.abha?.abhaAddress || selectedPatient.abha?.abhaNumber || '91-4521-8890-1234'}
                    </p>
                  </div>
                </div>

                {/* Visits History Timeline */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-teal-600" />
                      <span>Recorded Visits History ({selectedPatient.visits.length})</span>
                    </h4>
                    <span className="text-xs text-slate-500">
                      All visits connected under {selectedPatient.patientId}
                    </span>
                  </div>

                  {selectedPatient.visits.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-xs border border-dashed rounded-2xl">
                      No visits recorded yet. Click &quot;Start New Visit&quot; to book an OPD consultation.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedPatient.visits.map((visit, idx) => (
                        <div
                          key={visit.id || idx}
                          className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-black px-2 py-0.5 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-600 shadow-2xs">
                                {visit.visitId || `V00${selectedPatient.visits.length - idx}`}
                              </span>
                              <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400">
                                {visit.opdToken}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">
                                • {visit.visitDate || new Date(visit.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <span
                              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                visit.triagePriority === 'emergency'
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : visit.triagePriority === 'urgent'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {visit.triagePriority}
                            </span>
                          </div>

                          {/* Problem & Doctor */}
                          <div className="text-xs space-y-1">
                            <div>
                              <span className="font-bold text-slate-700 dark:text-slate-300">Problem: </span>
                              <span className="text-slate-900 dark:text-white font-semibold">
                                {visit.chiefComplaint.title}
                              </span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-700 dark:text-slate-300">Doctor: </span>
                              <span className="text-slate-800 dark:text-slate-200">
                                {visit.attendingDoctor || visit.doctorReview.verifiedBy } ({visit.opdRoom})
                              </span>
                            </div>
                          </div>

                          {/* Prescribed Medicines for this visit */}
                          {(visit.medicines?.length ?? 0) > 0 || (visit.doctorReview.prescribedMedications?.length ?? 0) > 0 ? (
                            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
                              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                                <Pill className="w-3 h-3 text-teal-600" />
                                <span>Medicines Prescribed in this Visit:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {(visit.medicines && visit.medicines.length > 0
                                  ? visit.medicines
                                  : visit.doctorReview.prescribedMedications || []
                                ).map((med, medIdx) => (
                                  <span
                                    key={medIdx}
                                    className="px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[11px] font-semibold"
                                  >
                                    {med.name} ({med.dosage}) - {med.frequency}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              No prescription recorded for this visit yet.
                            </div>
                          )}

                          {visit.doctorReview.doctorNotes && (
                            <div className="text-xs text-slate-600 dark:text-slate-400 italic bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800">
                              &quot;{visit.doctorReview.doctorNotes}&quot;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
              Select a patient on the left or search to view their hospital record and visits.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: Register New Patient */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden relative">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Register New Hospital Patient
                  </h3>
                  <p className="text-xs text-slate-500">
                    Creates central record and assigns unique Patient ID
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterPatient} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Full Patient Name *
                </label>
                <input
                  type="text"
                  required
                  value={newPatientForm.fullName}
                  onChange={(e) =>
                    setNewPatientForm({ ...newPatientForm, fullName: e.target.value })
                  }
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Age (Years) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    required
                    value={newPatientForm.age}
                    onChange={(e) =>
                      setNewPatientForm({ ...newPatientForm, age: Number(e.target.value) })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Gender *
                  </label>
                  <select
                    value={newPatientForm.gender}
                    onChange={(e) =>
                      setNewPatientForm({
                        ...newPatientForm,
                        gender: e.target.value as Gender,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Phone Number (Mobile) *
                </label>
                <input
                  type="tel"
                  required
                  value={newPatientForm.phone}
                  onChange={(e) =>
                    setNewPatientForm({ ...newPatientForm, phone: e.target.value })
                  }
                  placeholder="e.g. 9876543210"
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Residential Address
                </label>
                <input
                  type="text"
                  value={newPatientForm.address}
                  onChange={(e) =>
                    setNewPatientForm({ ...newPatientForm, address: e.target.value })
                  }
                  placeholder="e.g. Ward 4, Civil Lines"
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Create Patient Record</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Start New Visit */}
      {showNewVisitModal && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden relative">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 flex items-center justify-center">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Start New Visit
                  </h3>
                  <p className="text-xs text-slate-500">
                    For {selectedPatient.fullName} ({selectedPatient.patientId})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewVisitModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewVisit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Current Problem / Chief Complaint *
                </label>
                <input
                  type="text"
                  required
                  value={newVisitForm.problem}
                  onChange={(e) =>
                    setNewVisitForm({ ...newVisitForm, problem: e.target.value })
                  }
                  placeholder="e.g. Severe headache and eye pain"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    OPD Department
                  </label>
                  <select
                    value={newVisitForm.department}
                    onChange={(e) =>
                      setNewVisitForm({ ...newVisitForm, department: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Internal Medicine">Internal Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pulmonology">Pulmonology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Orthopedics">Orthopedics</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    OPD Room Assignment
                  </label>
                  <select
                    value={newVisitForm.room}
                    onChange={(e) =>
                      setNewVisitForm({ ...newVisitForm, room: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Room 4 (General Medicine)">Room 4 (General Medicine)</option>
                    <option value="Room 1 (Emergency Resus / Med)">Room 1 (Emergency Resus / Med)</option>
                    <option value="Room 2 (Cardiology / HTN)">Room 2 (Cardiology / HTN)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Attending Medical Officer
                </label>
                <input
                  type="text"
                  value={newVisitForm.doctor}
                  onChange={(e) =>
                    setNewVisitForm({ ...newVisitForm, doctor: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewVisitModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Visit &amp; Generate Token</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL 3: Add Doctor */}
      {showAddDoctorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden relative">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950 text-sky-600 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    Register Doctor Account
                  </h3>
                  <p className="text-xs text-slate-500">
                    Create credentials for a doctor to log in
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddDoctorModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Doctor Name / Title *
                </label>
                <input
                  type="text"
                  required
                  value={addDoctorForm.name}
                  onChange={(e) =>
                    setAddDoctorForm({ ...addDoctorForm, name: e.target.value })
                  }
                  placeholder="e.g. Dr. S. K. Verma, MD"
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={addDoctorForm.username}
                    onChange={(e) =>
                      setAddDoctorForm({ ...addDoctorForm, username: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={addDoctorForm.password}
                    onChange={(e) =>
                      setAddDoctorForm({ ...addDoctorForm, password: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Hospital Name *
                </label>
                <input
                  type="text"
                  required
                  disabled // Reception can only register for their hospital
                  value={addDoctorForm.hospitalName}
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 cursor-not-allowed"
                />
                <p className="text-[10px] text-slate-400">Fixed to reception's authorized hospital.</p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDoctorModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-sm flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Register Doctor</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMERGENCY IPD FAST-TRACK MODAL (3 minimal fields: Name, Age, Phone) */}
      {showIpdModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-4 border-rose-500 animate-scale-in">
            <div className="flex items-start justify-between gap-3 border-b border-rose-100 dark:border-rose-900 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  RECEPTION FAST-TRACK ADMISSION
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-rose-950 dark:text-rose-200 flex items-center gap-2 mt-1">
                  <span>🚨 Emergency IPD Registration</span>
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  Direct admission protocol: No initial case questions required. Minimal intake.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIpdModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmergencyIpdSubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Patient Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ipdForm.fullName}
                  onChange={(e) => setIpdForm({ ...ipdForm, fullName: e.target.value })}
                  placeholder="e.g., Harish Chandra"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Age (Years) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={ipdForm.age}
                    onChange={(e) => setIpdForm({ ...ipdForm, age: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                    Mobile Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={ipdForm.phone}
                    onChange={(e) => setIpdForm({ ...ipdForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-800 dark:text-slate-200">
                  Allocated Emergency Bed / Ward:
                </label>
                <select
                  value={ipdForm.bedWard}
                  onChange={(e) => setIpdForm({ ...ipdForm, bedWard: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                >
                  <option value="Emergency Bed 1 (Acute Resus)">Emergency Bed 1 (Acute Resus)</option>
                  <option value="Emergency Bed 2 (Triage / Monitor)">Emergency Bed 2 (Triage / Monitor)</option>
                  <option value="ICU Bed 4 (Critical Care)">ICU Bed 4 (Critical Care)</option>
                  <option value="Male IPD Ward - Bed 12">Male IPD Ward - Bed 12</option>
                  <option value="Female IPD Ward - Bed 08">Female IPD Ward - Bed 08</option>
                  <option value="Pediatric Ward - Bed 03">Pediatric Ward - Bed 03</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIpdModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/30 flex items-center gap-2"
                >
                  <Bed className="w-4 h-4" />
                  <span>Admit Patient Immediately</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IPD REGISTRATION CONFIRMATION SLIP */}
      {ipdSuccessEncounter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-rose-600 text-slate-900 space-y-4 animate-scale-in">
            <div className="text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-300 inline-block">
                EMERGENCY IPD ADMISSION CONFIRMED
              </span>
              <h3 className="text-2xl font-black text-slate-900 pt-1">
                {ipdSuccessEncounter.hospitalName}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {ipdSuccessEncounter.hospitalAddress}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1">
              <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                IPD Admission Number
              </div>
              <div className="text-3xl font-mono font-black text-rose-700">
                {ipdSuccessEncounter.ipdRegistrationId}
              </div>
              <div className="text-xs font-bold text-rose-900">
                Bed / Ward: {ipdSuccessEncounter.bedWard}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient Name:</span>
                <span className="font-bold text-slate-900">{ipdSuccessEncounter.demographics.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Age / Gender:</span>
                <span className="font-bold text-slate-900">{ipdSuccessEncounter.demographics.age} Yrs / {ipdSuccessEncounter.demographics.gender.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact Number:</span>
                <span className="font-bold text-slate-900">{ipdSuccessEncounter.demographics.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Admission Date &amp; Time:</span>
                <span className="font-mono font-bold text-slate-800">
                  {new Date(ipdSuccessEncounter.admissionDate || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300"
              >
                <Printer className="w-4 h-4" />
                <span>Print IPD Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setIpdSuccessEncounter(null)}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 flex items-center justify-center"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
