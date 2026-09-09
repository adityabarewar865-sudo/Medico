/**
 * Central Hospital Database Service
 * 
 * Manages the hierarchy:
 * Hospital -> Patients -> Visits -> Medical Information -> Medicines -> Reports
 *
 * Fully connected to Express REST Backend, SSE Real-Time Stream, LocalStorage, and Firebase.
 */

import type {
  PatientRecord,
  PatientCaseEncounter,
  DoctorVerification,
  VisitMedicineItem,
  Gender,
} from '../types/clinical';
import { SAMPLE_PATIENT_RECORDS } from '../data/samplePatients';
import { firebaseService } from './firebase';
import { api } from './api';

const HOSPITAL_DB_KEY = 'medico_hospital_patients_v3';

class HospitalDatabaseService {
  private patients: PatientRecord[] = [];
  private listeners: Array<() => void> = [];
  private isSyncing = false;

  constructor() {
    this.loadFromStorage();
    this.initBackendConnection();
  }

  private initBackendConnection(): void {
    if (typeof window === 'undefined') return;

    // 1. Listen for backend online/offline transitions
    api.onStatusChange((online) => {
      if (online) {
        console.log('[Hospital DB] Backend online detected. Fetching master hospital state...');
        this.syncFromBackend();
      }
    });

    // 2. Real-Time SSE Listener (Instant cross-tab, cross-device synchronization)
    api.subscribeToRealtimeEvents((eventType, payload: unknown) => {
      console.log(`[Hospital DB SSE] Event: ${eventType}`, payload);

      if (
        eventType === 'HOSPITAL_PATIENTS_UPDATED' ||
        eventType === 'PATIENT_REGISTERED' ||
        eventType === 'VISIT_CREATED' ||
        eventType === 'DOCTOR_VERIFIED'
      ) {
        this.syncFromBackend();
      } else if (eventType === 'QUEUE_RESET') {
        this.patients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
        this.persist();
      }
    });
  }

  public async syncFromBackend(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const backendPatients = await api.getHospitalPatients();
      if (Array.isArray(backendPatients) && backendPatients.length > 0) {
        this.patients = backendPatients;
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(HOSPITAL_DB_KEY, JSON.stringify(this.patients));
          } catch {
            // LocalStorage quota or private mode fallback
          }
        }
        this.notifyListeners();
        console.log(`[Hospital DB] Synchronized ${this.patients.length} patient records with Central Backend.`);
      }
    } catch (err) {
      console.warn('[Hospital DB] Background sync with backend skipped (offline/fallback):', err);
    } finally {
      this.isSyncing = false;
    }
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      this.patients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
      return;
    }

    try {
      const stored = localStorage.getItem(HOSPITAL_DB_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Deduplicate any cached visits in localStorage
          for (const p of parsed) {
            if (p && Array.isArray(p.visits)) {
              const seen = new Set<string>();
              p.visits = p.visits.filter((v: { id?: string; visitDate?: string; chiefComplaint?: { title?: string } }) => {
                const k = v.id || `${v.visitDate}_${v.chiefComplaint?.title || ''}`;
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
              });
              p.totalVisits = p.visits.length;
            }
          }
          this.patients = parsed;
          return;
        }
      }
      // Seed with initial sample patients if none found
      this.patients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
      this.persist();
    } catch (err) {
      console.warn('[Hospital DB] Error loading from localStorage, using samples:', err);
      this.patients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
    }
  }

  private persist(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(HOSPITAL_DB_KEY, JSON.stringify(this.patients));
      } catch (e) {
        console.warn('[Hospital DB] Failed to save to localStorage:', e);
      }
    }
    this.notifyListeners();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => cb());
  }

  public isBackendOnline(): boolean {
    return api.getIsOnline();
  }

  /**
   * Get all registered patients
   */
  public getPatients(): PatientRecord[] {
    return [...this.patients];
  }

  /**
   * Get a patient by their unique Patient ID (e.g., 'P10025')
   */
  public getPatientById(patientId: string): PatientRecord | undefined {
    const cleanId = patientId.trim().toUpperCase();
    return this.patients.find(
      (p) => p.patientId.toUpperCase() === cleanId || p.patientId.toUpperCase() === `P${cleanId}`
    );
  }

  /**
   * Search patients by Patient ID, Name, Phone Number, or ABHA
   */
  public searchPatients(query: string): PatientRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...this.patients];

    return this.patients.filter((p) => {
      const idMatch = p.patientId.toLowerCase().includes(q);
      const nameMatch = p.fullName.toLowerCase().includes(q);
      const phoneMatch = p.phone.toLowerCase().includes(q);
      const abhaMatch =
        p.abha?.abhaAddress?.toLowerCase().includes(q) ||
        p.abha?.abhaNumber?.toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch || abhaMatch;
    });
  }

  /**
   * Find existing patient by exact or fuzzy phone number or Patient ID
   */
  public findExistingPatient(phoneOrId: string): PatientRecord | undefined {
    const clean = phoneOrId.trim().toLowerCase();
    if (!clean) return undefined;

    return this.patients.find(
      (p) =>
        p.patientId.toLowerCase() === clean ||
        p.phone.replace(/\D/g, '') === clean.replace(/\D/g, '') ||
        p.phone.includes(clean)
    );
  }

  /**
   * Generate next sequential Patient ID, e.g. P10028
   */
  public generateNextPatientId(): string {
    let maxNum = 10027;
    for (const p of this.patients) {
      const numPart = parseInt(p.patientId.replace(/\D/g, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    return `P${maxNum + 1}`;
  }

  /**
   * Register a brand new patient (generates unique Patient ID and syncs to backend)
   */
  public registerPatient(data: {
    fullName: string;
    age: number;
    gender: Gender;
    phone: string;
    address?: string;
    emergencyContact?: string;
    abhaNumber?: string;
    abhaAddress?: string;
  }): PatientRecord {
    const patientId = this.generateNextPatientId();
    const newPatient: PatientRecord = {
      patientId,
      fullName: data.fullName.trim(),
      age: Number(data.age) || 30,
      gender: data.gender,
      phone: data.phone.trim(),
      address: data.address?.trim() || 'District Catchment Area',
      emergencyContact: data.emergencyContact?.trim() || '',
      registeredAt: new Date().toISOString(),
      totalVisits: 0,
      visits: [],
      abha: {
        abhaNumber: data.abhaNumber || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${patientId.replace(/\D/g, '')}`,
        abhaAddress: data.abhaAddress || `${data.fullName.toLowerCase().replace(/\s+/g, '.')}${patientId.toLowerCase()}@abdm`,
        status: data.abhaNumber ? 'verified' : 'pending',
        kycStatus: data.abhaNumber ? 'KYC_VERIFIED' : 'SELF_DECLARED',
      },
    };

    // 1. Optimistic local update
    this.patients.unshift(newPatient);
    this.persist();

    // 2. Persist to Central REST Backend
    api
      .registerHospitalPatient({
        fullName: data.fullName,
        age: Number(data.age) || 30,
        gender: data.gender,
        phone: data.phone,
        address: data.address,
        emergencyContact: data.emergencyContact,
        abhaNumber: data.abhaNumber,
        abhaAddress: data.abhaAddress,
      })
      .then((saved) => {
        if (saved && saved.patientId) {
          console.log(`[Hospital DB] Successfully persisted ${saved.patientId} to Backend.`);
        }
      })
      .catch((err) => {
        console.warn('[Hospital DB] Could not sync registration to backend (saved locally):', err);
      });

    // 3. Async sync to Firebase if configured
    firebaseService.savePatientToCloud(newPatient).catch(() => {});

    return newPatient;
  }

  /**
   * Create a new visit under an existing Patient ID (syncs to backend & broadcasts)
   */
  public createVisit(
    patientId: string,
    visitData: Partial<PatientCaseEncounter>
  ): PatientCaseEncounter {
    const patient = this.getPatientById(patientId);
    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    // Deduplication check: return existing visit if matching id or visitId already exists
    const existingVisit = patient.visits.find(
      (v) =>
        (visitData.id && v.id === visitData.id) ||
        (visitData.visitId && v.visitId === visitData.visitId)
    );
    if (existingVisit) {
      console.log(
        `[Hospital DB] Visit ${existingVisit.visitId} (${existingVisit.id}) already exists for patient ${patientId}. Returning existing visit.`
      );
      return existingVisit;
    }

    let maxVisitNum = 0;
    for (const v of patient.visits) {
      if (v.visitId) {
        const n = parseInt(v.visitId.replace(/\D/g, ''), 10);
        if (!isNaN(n) && n > maxVisitNum) {
          maxVisitNum = n;
        }
      }
    }
    const visitId = visitData.visitId || `V${String(maxVisitNum + 1).padStart(3, '0')}`;
    const opdToken =
      visitData.opdToken ||
      `OPD-MED-${String(this.getActiveEncounters().length + 40).padStart(3, '0')}`;
    const visitDate =
      visitData.visitDate || new Date().toISOString().split('T')[0];

    const newVisit: PatientCaseEncounter = {
      id: visitData.id || `enc_${patient.patientId.toLowerCase()}_${visitId.toLowerCase()}_${Date.now()}`,
      patientId: patient.patientId,
      visitId,
      visitDate,
      attendingDoctor: visitData.attendingDoctor ,
      opdToken,
      opdRoom: visitData.opdRoom || 'Room 4 (General Medicine)',
      specialty: visitData.specialty || 'Internal Medicine',
      createdAt: visitData.createdAt || new Date().toISOString(),
      demographics: {
        id: `pat_${patient.patientId.toLowerCase()}`,
        fullName: patient.fullName,
        age: patient.age,
        gender: patient.gender,
        phone: patient.phone,
        abha: patient.abha || {
          abhaNumber: '',
          abhaAddress: '',
          status: 'pending',
          kycStatus: 'SELF_DECLARED',
        },
        address: patient.address,
        preferredLanguage: visitData.demographics?.preferredLanguage || 'hi',
        emergencyContact: patient.emergencyContact,
      },
      consent: visitData.consent || {
        granted: true,
        timestamp: new Date().toISOString(),
        method: 'audio_verbal',
        languageUsed: 'hi',
        abdmLinkConsent: true,
      },
      chiefComplaint: visitData.chiefComplaint || {
        id: 'other',
        title: 'Outpatient Consultation',
        description: 'New clinical consultation',
        onsetDuration: 'Acute',
      },
      adaptiveAnswers: visitData.adaptiveAnswers || [],
      documents: visitData.documents || [],
      timeline: visitData.timeline || [],
      triagePriority: visitData.triagePriority || 'routine',
      triageRationale:
        visitData.triageRationale ||
        `Visit ${visitId}: Consultation booked for ${patient.fullName}`,
      redFlags: visitData.redFlags || [],
      clinicalSummary: visitData.clinicalSummary || {
        chiefComplaintFormatted: `${patient.fullName} (${patient.age}Y/${patient.gender.toUpperCase()}) - ${visitData.chiefComplaint?.title || 'General Consultation'}`,
        historyOfPresentIllness:
          visitData.chiefComplaint?.description || 'Patient presenting for new clinical evaluation.',
        pastMedicalHistory: [],
        activeMedications: [],
        allergies: [],
        investigationsSummary: 'Awaiting consultation.',
      },
      medicines: visitData.medicines || [],
      doctorReview: visitData.doctorReview || {
        verified: false,
        status: 'pending',
      },
      savedToHis: visitData.savedToHis || false,
      abdmCareContextLinked: true,
      abdmCareContextRef: `CARE-CTX-${patient.patientId}-${visitId}`,
      hospitalName: visitData.hospitalName || (typeof window !== 'undefined' ? localStorage.getItem('medico_hospital_name') : undefined) || 'District Hospital',
      hospitalAddress: visitData.hospitalAddress || (typeof window !== 'undefined' ? localStorage.getItem('medico_hospital_address') : undefined) || 'Hospital Complex, Main Road, Civil Lines',
      accompanyingPerson: visitData.accompanyingPerson,
      knownAllergies: visitData.knownAllergies,
      consultationType: visitData.consultationType || (visitData.isIpd ? 'ipd' : 'opd'),
      systemOfMedicine: visitData.systemOfMedicine || 'allopathy',
      ayushHistory: visitData.ayushHistory,
      isIpd: visitData.isIpd || false,
      ipdRegistrationId: visitData.ipdRegistrationId,
      admissionDate: visitData.admissionDate,
      bedWard: visitData.bedWard,
    };

    // 1. Optimistic local update
    patient.visits.unshift(newVisit);
    patient.totalVisits = patient.visits.length;
    this.persist();

    // 2. Persist to Central Backend API
    api
      .createHospitalVisit(patient.patientId, newVisit)
      .then(() => {
        console.log(`[Hospital DB] Visit ${visitId} successfully persisted to Backend for ${patient.patientId}.`);
      })
      .catch((err) => {
        console.warn('[Hospital DB] Backend visit sync failed (persisted locally):', err);
      });

    // 3. Async sync to Firebase
    firebaseService.savePatientToCloud(patient).catch(() => {});

    return newVisit;
  }

  /**
   * Fast-track Emergency IPD Registration (Name, Age, Phone only)
   * Zero normal case-taking questions required before admission.
   */
  public registerIpdPatient(data: {
    fullName: string;
    age: number;
    phone: string;
    bedWard?: string;
    admissionNotes?: string;
  }): PatientCaseEncounter {
    const cleanPhone = data.phone.replace(/\D/g, '');
    let patient = this.findExistingPatient(cleanPhone);
    if (!patient) {
      patient = this.registerPatient({
        fullName: data.fullName,
        age: Number(data.age) || 30,
        gender: 'male',
        phone: data.phone,
        address: 'Emergency Admission Ward',
      });
    }

    const ipdNum = Math.floor(100 + Math.random() * 900);
    const ipdToken = `IPD-2026-${ipdNum}`;
    const bedWard = data.bedWard || 'Emergency Acute Bed 1';

    const ipdVisit = this.createVisit(patient.patientId, {
      isIpd: true,
      ipdRegistrationId: ipdToken,
      opdToken: ipdToken,
      opdRoom: bedWard,
      specialty: 'Emergency Medicine / Inpatient Department',
      triagePriority: 'emergency',
      triageRationale: 'Direct Emergency Inpatient (IPD) Fast-Track Registration',
      consultationType: 'ipd',
      chiefComplaint: {
        id: 'other',
        title: 'Emergency Inpatient Admission (Fast-Track IPD)',
        description: data.admissionNotes || 'Critical/Emergency patient registered directly to IPD.',
        onsetDuration: 'Acute Immediate',
      },
      clinicalSummary: {
        chiefComplaintFormatted: `[IPD FAST-TRACK] ${data.fullName} (${data.age}Y) - Emergency Admission`,
        historyOfPresentIllness: `Emergency Inpatient Admission registered directly without preliminary case-taking. Allocated to ${bedWard}. Case evaluation to be completed bedside by Medical Officer.`,
        pastMedicalHistory: [],
        activeMedications: [],
        allergies: [],
        investigationsSummary: 'Stat bedside evaluation and basic labs pending.',
      },
      admissionDate: new Date().toISOString(),
      bedWard,
    });

    return ipdVisit;
  }

  /**
   * Update doctor's review, verification, notes, or rejection on a specific visit (syncs to backend)
   */
  public updateDoctorReview(
    patientId: string,
    visitId: string,
    review: DoctorVerification,
    saveToHis = false
  ): PatientCaseEncounter | undefined {
    const patient = this.getPatientById(patientId);
    if (!patient) return undefined;

    const visit = patient.visits.find(
      (v) => v.visitId === visitId || v.id === visitId
    );
    if (!visit) return undefined;

    visit.doctorReview = { ...visit.doctorReview, ...review };

    // Sync prescribed medicines into visit.medicines if provided
    if (review.prescribedMedications && review.prescribedMedications.length > 0) {
      const formattedMeds: VisitMedicineItem[] = review.prescribedMedications.map((rx, idx) => ({
        id: `med_${patient.patientId}_${visit.visitId}_${idx}_${Date.now()}`,
        visitId: visit.visitId || 'V001',
        patientId: patient.patientId,
        name: rx.name,
        category: rx.category || 'allopathic',
        dosage: rx.dosage,
        frequency: rx.frequency,
        duration: rx.duration,
        instructions: rx.instructions,
        datePrescribed: visit.visitDate || new Date().toISOString().split('T')[0],
        doctor: review.verifiedBy || visit.attendingDoctor || 'Attending Physician',
      }));
      visit.medicines = formattedMeds;
    }

    if (saveToHis) {
      visit.savedToHis = true;
      visit.hisSyncTimestamp = new Date().toISOString();
    }

    // 1. Optimistic local update
    this.persist();

    // 2. Persist to Backend API
    api
      .updateHospitalDoctorReview(patient.patientId, visit.visitId || visitId, review, saveToHis)
      .then(() => {
        console.log(`[Hospital DB] Doctor review synced to backend for ${patient.patientId} / ${visit.visitId}.`);
      })
      .catch((err) => {
        console.warn('[Hospital DB] Backend review sync failed (saved locally):', err);
      });

    // 3. Async sync to Firebase
    firebaseService.savePatientToCloud(patient).catch(() => {});

    return visit;
  }

  /**
   * Get all medicines prescribed across ALL visits for a patient (chronological)
   */
  public getPatientMedicineHistory(patientId: string): VisitMedicineItem[] {
    const patient = this.getPatientById(patientId);
    if (!patient) return [];

    const history: VisitMedicineItem[] = [];
    patient.visits.forEach((v) => {
      if (v.medicines && v.medicines.length > 0) {
        v.medicines.forEach((m) => history.push({
          ...m,
          category: m.category || 'allopathic',
        }));
      } else if (v.doctorReview?.prescribedMedications) {
        v.doctorReview.prescribedMedications.forEach((rx, idx) => {
          history.push({
            id: `med_legacy_${v.visitId}_${idx}`,
            visitId: v.visitId || 'V001',
            patientId: patient.patientId,
            name: rx.name,
            category: rx.category || 'allopathic',
            dosage: rx.dosage,
            frequency: rx.frequency,
            duration: rx.duration,
            instructions: rx.instructions,
            datePrescribed: v.visitDate || v.createdAt.split('T')[0],
            doctor: v.doctorReview.verifiedBy || v.attendingDoctor || 'Attending Physician',
          });
        });
      }
    });

    return history;
  }

  /**
   * Get active encounters (most recent visit for each patient) for Doctor queue
   */
  public getActiveEncounters(): PatientCaseEncounter[] {
    const list: PatientCaseEncounter[] = [];
    this.patients.forEach((p) => {
      if (p.visits.length > 0) {
        list.push(p.visits[0]);
      }
    });
    return list;
  }

  /**
   * Reset database back to default sample records
   */
  public resetToDefaults(): void {
    this.patients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
    this.persist();

    // Reset on backend as well
    api.resetHospitalData().catch(() => {});
  }
}

export const hospitalDb = new HospitalDatabaseService();
