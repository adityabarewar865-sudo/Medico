import type { PatientCaseEncounter, DoctorVerification } from '../types/clinical';
import { INITIAL_PATIENTS } from '../data/samplePatients';
import { api } from './api';

const STORAGE_KEY = 'aarogyavani_opd_encounters_v1';

class StorageService {
  private encounters: PatientCaseEncounter[] = [];
  private listeners: Array<() => void> = [];
  private backendOnline = false;

  constructor() {
    this.loadFromStorage();
    this.initBackendSync();
  }

  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      this.encounters = [...INITIAL_PATIENTS];
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.encounters = JSON.parse(stored);
      } else {
        this.encounters = [...INITIAL_PATIENTS];
        this.persist();
      }
    } catch (e) {
      console.warn('Failed to load encounters from localStorage, using initial defaults:', e);
      this.encounters = [...INITIAL_PATIENTS];
    }
  }

  private initBackendSync(): void {
    if (typeof window === 'undefined') return;

    // 1. Initial background fetch from backend
    this.fetchFromBackend();

    // 2. Track connection status
    api.onStatusChange((online) => {
      this.backendOnline = online;
      this.notifyListeners();
    });

    // 3. Real-time SSE subscription (instant triage updates without refresh)
    api.subscribeToRealtimeEvents((eventType, payload: unknown) => {
      console.log(`[Realtime Sync] Event received: ${eventType}`);

      if (eventType === 'PATIENT_REGISTERED') {
        const { patient } = payload as { patient: PatientCaseEncounter };
        if (patient) {
          const exists = this.encounters.some((e) => e.id === patient.id);
          if (!exists) {
            this.encounters.unshift(patient);
            this.persist();
          }
        }
      } else if (eventType === 'PATIENT_UPDATED' || eventType === 'DOCTOR_VERIFIED') {
        const { patient } = payload as { patient: PatientCaseEncounter };
        if (patient) {
          const idx = this.encounters.findIndex((e) => e.id === patient.id);
          if (idx >= 0) {
            this.encounters[idx] = patient;
            this.persist();
          }
        }
      } else if (eventType === 'QUEUE_RESET') {
        const { encounters } = payload as { encounters: PatientCaseEncounter[] };
        if (encounters && Array.isArray(encounters)) {
          this.encounters = encounters;
          this.persist();
        }
      }
    });
  }

  public async fetchFromBackend(): Promise<void> {
    try {
      const response = await api.getPatients();
      if (response && Array.isArray(response.data) && response.data.length > 0) {
        this.encounters = response.data;
        this.backendOnline = true;
        this.persist();
      }
    } catch (err) {
      console.log('[Storage] Backend not reachable yet, using offline local cache:', err);
      this.backendOnline = false;
    }
  }

  private persist(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.encounters));
      } catch (e) {
        console.warn('Failed to persist to localStorage:', e);
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

  public getPatients(): PatientCaseEncounter[] {
    return [...this.encounters];
  }

  public getPatientById(id: string): PatientCaseEncounter | undefined {
    return this.encounters.find((e) => e.id === id);
  }

  public isBackendOnline(): boolean {
    return this.backendOnline;
  }

  public savePatient(patient: PatientCaseEncounter): void {
    // 1. Optimistic local update
    const existingIndex = this.encounters.findIndex((e) => e.id === patient.id);
    if (existingIndex >= 0) {
      this.encounters[existingIndex] = patient;
    } else {
      this.encounters.unshift(patient);
    }
    this.persist();

    // 2. Push to backend API
    api
      .createPatient(patient)
      .then((created) => {
        if (created && created.id) {
          const idx = this.encounters.findIndex((e) => e.id === created.id);
          if (idx >= 0) {
            this.encounters[idx] = created;
            this.persist();
          }
        }
      })
      .catch((err) => {
        console.warn('[Storage] Could not persist to backend (queued in local storage):', err);
      });
  }

  public updateDoctorReview(
    patientId: string,
    doctorReview: DoctorVerification,
    saveToHis = false
  ): void {
    // 1. Optimistic local update
    const patient = this.encounters.find((e) => e.id === patientId);
    if (patient) {
      patient.doctorReview = { ...patient.doctorReview, ...doctorReview };
      if (saveToHis) {
        patient.savedToHis = true;
        patient.hisSyncTimestamp = new Date().toISOString();
      }
      this.persist();
    }

    // 2. Push to backend API
    api
      .updateDoctorReview(patientId, doctorReview, saveToHis)
      .then((updated) => {
        if (updated) {
          const idx = this.encounters.findIndex((e) => e.id === updated.id);
          if (idx >= 0) {
            this.encounters[idx] = updated;
            this.persist();
          }
        }
      })
      .catch((err) => {
        console.warn('[Storage] Could not sync doctor review to backend (queued locally):', err);
      });
  }

  public resetToDefaults(): void {
    // 1. Local reset
    this.encounters = [...INITIAL_PATIENTS];
    this.persist();

    // 2. Backend reset
    api.resetPatients().catch((err) => {
      console.warn('[Storage] Could not reset backend patients:', err);
    });
  }
}

export const storage = new StorageService();
