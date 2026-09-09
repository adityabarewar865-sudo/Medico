import type { PatientCaseEncounter, DoctorVerification, PatientRecord } from '../types/clinical';
import { api } from './api';
import { hospitalDb } from './hospitalDatabase';

class StorageService {
  private backendOnline = false;

  constructor() {
    this.initBackendSync();
  }

  private initBackendSync(): void {
    if (typeof window === 'undefined') return;

    // 1. Initial background fetch from backend
    this.fetchFromBackend();

    // 2. Track connection status
    api.onStatusChange((online) => {
      this.backendOnline = online;
    });

    // 3. Real-time SSE subscription (instant triage updates without refresh)
    api.subscribeToRealtimeEvents((eventType, _payload: unknown) => {
      console.log(`[Realtime Sync] Event received: ${eventType}`);

      if (
        eventType === 'PATIENT_REGISTERED' ||
        eventType === 'VISIT_CREATED' ||
        eventType === 'HOSPITAL_PATIENTS_UPDATED' ||
        eventType === 'DOCTOR_VERIFIED'
      ) {
        // Strictly read-only sync: NEVER call createVisit or registerPatient in SSE listener
        hospitalDb.syncFromBackend();
      } else if (eventType === 'QUEUE_RESET') {
        hospitalDb.resetToDefaults();
      }
    });
  }

  public async fetchFromBackend(): Promise<void> {
    try {
      const response = await api.getPatients();
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        this.backendOnline = true;
      }
    } catch {
      this.backendOnline = false;
    }
  }

  public subscribe(callback: () => void): () => void {
    return hospitalDb.subscribe(callback);
  }

  public getPatients(): PatientCaseEncounter[] {
    return hospitalDb.getActiveEncounters();
  }

  public getAllHospitalPatients(): PatientRecord[] {
    return hospitalDb.getPatients();
  }

  public getPatientById(id: string): PatientCaseEncounter | undefined {
    // Check by visit/encounter ID or by patient ID
    const active = hospitalDb.getActiveEncounters().find((e) => e.id === id || e.patientId === id);
    if (active) return active;

    // Search inside all visits
    for (const p of hospitalDb.getPatients()) {
      const found = p.visits.find((v) => v.id === id || v.visitId === id);
      if (found) return found;
    }
    return undefined;
  }

  public isBackendOnline(): boolean {
    return this.backendOnline;
  }

  public savePatient(patient: PatientCaseEncounter): void {
    // 1. Check if patient already exists in Hospital DB by phone or patientId
    const existing = hospitalDb.findExistingPatient(
      patient.patientId || patient.demographics.phone || patient.demographics.id
    );

    let assignedPatientId: string;

    if (existing) {
      // Existing patient found! Attach as new visit under same Patient ID
      assignedPatientId = existing.patientId;
      patient.patientId = assignedPatientId;
      hospitalDb.createVisit(assignedPatientId, patient);
    } else {
      // Brand new patient: register first to generate Patient ID (e.g. P10028)
      const registered = hospitalDb.registerPatient({
        fullName: patient.demographics.fullName,
        age: patient.demographics.age,
        gender: patient.demographics.gender,
        phone: patient.demographics.phone,
        address: patient.demographics.address,
        emergencyContact: patient.demographics.emergencyContact,
        abhaNumber: patient.demographics.abha?.abhaNumber,
        abhaAddress: patient.demographics.abha?.abhaAddress,
      });
      assignedPatientId = registered.patientId;
      patient.patientId = assignedPatientId;
      hospitalDb.createVisit(assignedPatientId, patient);
    }

    // 2. Push to backend API
    api
      .createPatient(patient)
      .catch((err) => {
        console.warn('[Storage] Could not persist to backend (stored locally):', err);
      });
  }

  public updateDoctorReview(
    patientOrEncounterId: string,
    doctorReview: DoctorVerification,
    saveToHis = false
  ): void {
    // Find matching visit and patient
    let targetPatientId = patientOrEncounterId;
    let targetVisitId = 'V001';

    const patientDirect = hospitalDb.getPatientById(patientOrEncounterId);
    if (patientDirect && patientDirect.visits.length > 0) {
      targetPatientId = patientDirect.patientId;
      targetVisitId = patientDirect.visits[0].visitId || 'V001';
    } else {
      for (const p of hospitalDb.getPatients()) {
        const v = p.visits.find((vis) => vis.id === patientOrEncounterId || vis.visitId === patientOrEncounterId);
        if (v) {
          targetPatientId = p.patientId;
          targetVisitId = v.visitId || 'V001';
          break;
        }
      }
    }

    hospitalDb.updateDoctorReview(targetPatientId, targetVisitId, doctorReview, saveToHis);

    // 2. Push to backend API
    api
      .updateDoctorReview(patientOrEncounterId, doctorReview, saveToHis)
      .catch((err) => {
        console.warn('[Storage] Could not sync doctor review to backend (stored locally):', err);
      });
  }

  public resetToDefaults(): void {
    hospitalDb.resetToDefaults();
    api.resetPatients().catch(() => {});
  }
}

export const storage = new StorageService();
