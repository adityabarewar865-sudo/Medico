import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Ticket,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  FileDown,
  Eye,
  RefreshCw,
  ShieldCheck,
  X,
  Stethoscope,
  Phone,
  MapPin,
  User,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { hospitalDb } from '../../services/hospitalDatabase';
import { downloadVisitReceiptPdf, resolveAssignedDoctorName } from '../../services/pdfReceiptService';
import type { PatientRecord, AuthUser } from '../../types/clinical';
import { LiveDateTime } from '../common/LiveDateTime';

interface AdminDashboardProps {
  currentUser?: AuthUser | null;
  onSendToKiosk?: () => void;
  onOpenReception?: () => void;
  onOpenDoctor?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
}) => {
  const [patients, setPatients] = useState<PatientRecord[]>(() => hospitalDb.getPatients());
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'waiting' | 'completed' | 'emergency'>('all');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Sync patients from hospitalDb and backend
  useEffect(() => {
    const handleUpdate = () => {
      setPatients(hospitalDb.getPatients());
    };

    const unsub = hospitalDb.subscribe(handleUpdate);
    return () => unsub();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await hospitalDb.syncFromBackend();
      setPatients(hospitalDb.getPatients());
    } catch (e) {
      console.warn('Failed to refresh patients from backend:', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Compute aggregate metrics across all registered hospital patients
  const metrics = useMemo(() => {
    const totalRegisteredPatients = patients.length;
    let totalTokensGenerated = 0;
    let tokensCompleted = 0;
    let tokensWaiting = 0;
    let emergencyCases = 0;
    let urgentCases = 0;

    patients.forEach((p) => {
      p.visits.forEach((v) => {
        if (v.opdToken) {
          totalTokensGenerated += 1;
          const isVerified = v.doctorReview?.verified === true || v.doctorReview?.status === 'verified';
          if (isVerified) {
            tokensCompleted += 1;
          } else {
            tokensWaiting += 1;
          }

          if (v.triagePriority === 'emergency') emergencyCases += 1;
          if (v.triagePriority === 'urgent') urgentCases += 1;
        }
      });
    });

    const completionRate =
      totalTokensGenerated > 0
        ? Math.round((tokensCompleted / totalTokensGenerated) * 100)
        : 0;

    return {
      totalRegisteredPatients,
      totalTokensGenerated,
      tokensCompleted,
      tokensWaiting,
      emergencyCases,
      urgentCases,
      completionRate,
    };
  }, [patients]);

  // Filter patients based on search and status
  const filteredPatients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return patients.filter((p) => {
      const latestVisit = p.visits.length > 0 ? p.visits[0] : null;
      const isCompleted =
        latestVisit && (latestVisit.doctorReview?.verified === true || latestVisit.doctorReview?.status === 'verified');
      const isWaiting = latestVisit && !isCompleted;
      const isEmergency = latestVisit && latestVisit.triagePriority === 'emergency';

      // Status filter
      if (statusFilter === 'waiting' && !isWaiting) return false;
      if (statusFilter === 'completed' && !isCompleted) return false;
      if (statusFilter === 'emergency' && !isEmergency) return false;

      // Text query match
      if (!q) return true;

      const matchesName = p.fullName.toLowerCase().includes(q);
      const matchesPhone = p.phone.toLowerCase().includes(q);
      const matchesId = p.patientId.toLowerCase().includes(q);
      const matchesAbha = p.abha?.abhaNumber?.toLowerCase().includes(q) || p.abha?.abhaAddress?.toLowerCase().includes(q);
      const matchesToken = latestVisit?.opdToken?.toLowerCase().includes(q);
      const matchesDoctor = latestVisit?.attendingDoctor?.toLowerCase().includes(q) || latestVisit?.doctorReview?.verifiedBy?.toLowerCase().includes(q);

      return matchesName || matchesPhone || matchesId || matchesAbha || matchesToken || matchesDoctor;
    });
  }, [patients, searchQuery, statusFilter]);

  // Export hospital registry to Excel
  const handleExportExcel = () => {
    const dataToExport = patients.map((p, idx) => {
      const latest = p.visits.length > 0 ? p.visits[0] : null;
      const assignedDoc = latest ? resolveAssignedDoctorName(latest) : 'N/A';
      const isCompleted = latest && (latest.doctorReview?.verified === true || latest.doctorReview?.status === 'verified');

      return {
        '#': idx + 1,
        'Patient ID': p.patientId,
        'Full Name': p.fullName,
        'Age': p.age,
        'Gender': p.gender.toUpperCase(),
        'Phone': p.phone,
        'Address': p.address || 'Catchment Area',
        'ABHA Number': p.abha?.abhaNumber || 'Pending',
        'ABHA Address': p.abha?.abhaAddress || '',
        'Total Visits': p.totalVisits || p.visits.length,
        'Latest Token': latest?.opdToken || 'N/A',
        'OPD Room': latest?.opdRoom || 'N/A',
        'Assigned Doctor': assignedDoc,
        'Token Status': isCompleted ? 'COMPLETED' : latest ? 'IN WAITING' : 'NO VISIT',
        'Triage Priority': latest?.triagePriority ? latest.triagePriority.toUpperCase() : 'ROUTINE',
        'Registration Date': p.registeredAt ? new Date(p.registeredAt).toLocaleDateString() : 'N/A',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hospital_Patients');
    XLSX.writeFile(workbook, `Hospital_Patients_Registry_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const hospitalName = currentUser?.hospitalName || localStorage.getItem('medico_hospital_name') || 'District Hospital';
  const hospitalAddress = currentUser?.hospitalAddress || localStorage.getItem('medico_hospital_address') || 'Hospital Complex, Main Road, Civil Lines';

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Top Header & Hospital Identity */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 text-2xl font-black shrink-0">
            🏥
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                Hospital Administrative Command Center
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                ABDM National Health Registry Integrated
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
              {hospitalName}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              {hospitalAddress}
            </p>
          </div>
        </div>

        {/* Live Date and Quick Actions */}
        <div className="flex flex-wrap items-center gap-3 justify-end">
          <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-700">
            <LiveDateTime variant="compact" />
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-300 dark:border-slate-700 disabled:opacity-50"
            title="Refresh Hospital Registry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Registry'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-xs shadow-md shadow-teal-600/20 flex items-center gap-2 transition-all cursor-pointer"
            title="Export complete registry to Excel"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>
        </div>
      </div>

      {/* 4 Primary Token & Patient KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: All Registered Patients */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Registered Patients
            </span>
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">
              {metrics.totalRegisteredPatients}
            </span>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              Patients In Hospital
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Registered in hospital database
          </p>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-indigo-500/5 rounded-full pointer-events-none" />
        </div>

        {/* KPI 2: Total Tokens Generated */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-sky-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tokens Generated
            </span>
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 flex items-center justify-center font-bold">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">
              {metrics.totalTokensGenerated}
            </span>
            <span className="text-xs font-semibold text-sky-600 dark:text-sky-400">
              OPD Queue Passes
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Total consultation encounters booked
          </p>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-sky-500/5 rounded-full pointer-events-none" />
        </div>

        {/* KPI 3: Tokens Completed (Doctor Verified) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tokens Completed
            </span>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {metrics.tokensCompleted}
            </span>
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              {metrics.completionRate}% Done
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Doctor checked, signed &amp; receipt generated
          </p>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-emerald-500/5 rounded-full pointer-events-none" />
        </div>

        {/* KPI 4: Tokens In Waiting (Queue) */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tokens In Waiting
            </span>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 flex items-center justify-center font-bold">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {metrics.tokensWaiting}
            </span>
            <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">
              Waiting for Doctor
            </span>
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
            Active in OPD waiting rooms
          </p>
          <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-amber-500/5 rounded-full pointer-events-none" />
        </div>
      </div>

      {/* Triage & Operational Alert Ribbon if Emergency Cases exist */}
      {metrics.emergencyCases > 0 && (
        <div className="bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-3xl p-4 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-rose-900 dark:text-rose-200 font-bold">
            <AlertTriangle className="w-5 h-5 text-rose-600 animate-pulse shrink-0" />
            <span>
              <strong>Administrative Priority Alert:</strong> {metrics.emergencyCases} emergency triage case(s) currently registered in hospital queue requiring priority examination.
            </span>
          </div>
          <button
            onClick={() => setStatusFilter('emergency')}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shrink-0 cursor-pointer shadow-xs"
          >
            Filter Emergency Patients
          </button>
        </div>
      )}

      {/* Main Registered Patients Section */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {/* Section Header & Filters */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <span>Registered Hospital Patients Registry</span>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                  {filteredPatients.length} of {patients.length}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comprehensive patient directory, OPD queue tokens, assigned physicians, and verified consultation records.
              </p>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All Patients ({patients.length})
              </button>
              <button
                onClick={() => setStatusFilter('waiting')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'waiting'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>Waiting</span>
                <span className="text-[10px] opacity-80">({metrics.tokensWaiting})</span>
              </button>
              <button
                onClick={() => setStatusFilter('completed')}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'completed'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <span>Completed</span>
                <span className="text-[10px] opacity-80">({metrics.tokensCompleted})</span>
              </button>
              {metrics.emergencyCases > 0 && (
                <button
                  onClick={() => setStatusFilter('emergency')}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'emergency'
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'text-rose-600 hover:text-rose-800'
                  }`}
                >
                  <span>Emergency ({metrics.emergencyCases})</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Patient Name, Phone (+91), Patient ID (e.g. P10025), OPD Token, ABHA, or Assigned Doctor..."
              className="w-full pl-11 pr-4 py-2.5 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Patients Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 px-4">Patient Information</th>
                <th className="py-3.5 px-4">Contact &amp; ABHA</th>
                <th className="py-3.5 px-4">Latest Token &amp; Room</th>
                <th className="py-3.5 px-4">Assigned Doctor</th>
                <th className="py-3.5 px-4">Token Status</th>
                <th className="py-3.5 px-4">Visits</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="max-w-xs mx-auto space-y-2">
                      <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400">
                        <Search className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">
                        No Patients Found
                      </p>
                      <p className="text-xs text-slate-500">
                        No registered patients matching your search query or selected filter.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredPatients.map((patient) => {
                  const latestVisit = patient.visits.length > 0 ? patient.visits[0] : null;
                  const isCompleted =
                    latestVisit &&
                    (latestVisit.doctorReview?.verified === true || latestVisit.doctorReview?.status === 'verified');
                  const assignedDoc = latestVisit ? resolveAssignedDoctorName(latestVisit) : 'Dr. S. K. Verma, MD';

                  return (
                    <tr
                      key={patient.patientId}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-colors"
                    >
                      {/* Patient Information */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {patient.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                              <span>{patient.fullName}</span>
                              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {patient.patientId}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {patient.age} Yrs • {patient.gender.toUpperCase()}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & ABHA */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                        <div className="flex items-center gap-1 font-medium">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>+91 {patient.phone}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[160px]">
                          {patient.abha?.abhaNumber || patient.abha?.abhaAddress || 'ABHA: Pending'}
                        </div>
                      </td>

                      {/* Latest Token & Room */}
                      <td className="py-3.5 px-4">
                        {latestVisit?.opdToken ? (
                          <div>
                            <span className="font-mono font-black text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 inline-block">
                              {latestVisit.opdToken}
                            </span>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {latestVisit.opdRoom || 'General OPD'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No Active Token</span>
                        )}
                      </td>

                      {/* Assigned Doctor */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                          <span className="truncate max-w-[150px]">{assignedDoc}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {latestVisit?.specialty || 'Internal Medicine'}
                        </div>
                      </td>

                      {/* Token Status */}
                      <td className="py-3.5 px-4">
                        {latestVisit ? (
                          isCompleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] font-black uppercase tracking-wider">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>COMPLETED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-black uppercase tracking-wider">
                              <Clock className="w-3 h-3" />
                              <span>IN WAITING</span>
                            </span>
                          )
                        ) : (
                          <span className="text-slate-400">Registered</span>
                        )}

                        {latestVisit?.triagePriority === 'emergency' && (
                          <span className="block mt-1 text-[9px] font-black text-rose-600 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.2 rounded border border-rose-300 animate-pulse text-center">
                            EMERGENCY
                          </span>
                        )}
                      </td>

                      {/* Total Visits Count */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700 dark:text-slate-300">
                        {patient.totalVisits || patient.visits.length} visit(s)
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedPatient(patient)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="View Patient Details & History"
                          >
                            <Eye className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Details</span>
                          </button>

                          {latestVisit && isCompleted && (
                            <button
                              onClick={() => {
                                downloadVisitReceiptPdf({
                                  patient,
                                  visit: latestVisit,
                                  hospitalName: latestVisit.hospitalName,
                                });
                              }}
                              className="px-2.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Download Verified Consultation Receipt PDF"
                            >
                              <FileDown className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Dossier / Details Modal */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Modal Header */}
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-xl font-bold">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-xs uppercase font-bold tracking-wider text-indigo-200">
                    Hospital Patient Clinical Dossier
                  </span>
                  <h3 className="text-xl font-black">{selectedPatient.fullName}</h3>
                  <p className="text-xs text-indigo-100">
                    ID: {selectedPatient.patientId} • {selectedPatient.age} Y / {selectedPatient.gender.toUpperCase()} • Mobile: +91 {selectedPatient.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Demographics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block">ABHA Number:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {selectedPatient.abha?.abhaNumber || 'Pending'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Address:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                    {selectedPatient.address || 'Catchment Area'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Registration Date:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {selectedPatient.registeredAt ? new Date(selectedPatient.registeredAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Total Visits:</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {selectedPatient.visits.length} Encounters
                  </span>
                </div>
              </div>

              {/* Consultation Visits Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="font-black text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span>Encounter &amp; Token History ({selectedPatient.visits.length})</span>
                </h4>

                {selectedPatient.visits.map((visit, idx) => {
                  const isVerified = visit.doctorReview?.verified === true || visit.doctorReview?.status === 'verified';
                  const docName = resolveAssignedDoctorName(visit);

                  return (
                    <div
                      key={visit.visitId || idx}
                      className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2.5 shadow-2xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            Visit {visit.visitId || `V${idx + 1}`}
                          </span>
                          <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-300">
                            Token: {visit.opdToken} ({visit.opdRoom})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isVerified
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-amber-50 text-amber-700 border border-amber-300'
                            }`}
                          >
                            {isVerified ? '✓ COMPLETED' : '⏳ IN WAITING'}
                          </span>

                          {isVerified && (
                            <button
                              onClick={() => {
                                downloadVisitReceiptPdf({
                                  patient: selectedPatient,
                                  visit,
                                  hospitalName: visit.hospitalName,
                                });
                              }}
                              className="px-2.5 py-1 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            >
                              <FileDown className="w-3 h-3" />
                              <span>Download Receipt</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Chief Problem:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {visit.chiefComplaint?.title || 'General Outpatient Checkup'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Assigned Doctor:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                            {docName}
                          </span>
                        </div>
                      </div>

                      {/* Prescribed Medicines (if any) */}
                      {(visit.doctorReview?.prescribedMedications?.length || visit.medicines?.length || 0) > 0 && (
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/80">
                          <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                            Prescribed Medications:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(visit.doctorReview?.prescribedMedications || visit.medicines || []).map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-medium"
                              >
                                {m.name} ({m.dosage} - {m.frequency})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl cursor-pointer"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
