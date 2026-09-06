import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PatientCaseEncounter, DoctorVerification } from '../../src/types/clinical';
import { INITIAL_PATIENTS } from '../../src/data/samplePatients';
import { sse } from './sse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'encounters.json');

export interface EncounterFilterOptions {
  search?: string;
  priority?: 'emergency' | 'urgent' | 'routine';
  status?: 'verified' | 'pending';
}

export interface SystemStats {
  total: number;
  emergency: number;
  urgent: number;
  routine: number;
  verified: number;
  pending: number;
  hisSynced: number;
  lastUpdated: string;
}

class ClinicalDatabaseService {
  private encounters: PatientCaseEncounter[] = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw.trim()) {
          this.encounters = JSON.parse(raw);
          console.log(`[Clinical DB] Loaded ${this.encounters.length} patient encounters from disk.`);
          this.isInitialized = true;
          return;
        }
      }

      // Initialize with default sample patients
      this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
      this.persist();
      console.log(`[Clinical DB] Initialized database with ${this.encounters.length} demo OPD encounters.`);
      this.isInitialized = true;
    } catch (err) {
      console.error('[Clinical DB] Error initializing encounters file:', err);
      this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
      this.isInitialized = true;
    }
  }

  private persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.encounters, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Clinical DB] Failed to persist encounters to disk:', err);
    }
  }

  public getEncounters(options: EncounterFilterOptions = {}): PatientCaseEncounter[] {
    let result = [...this.encounters];

    if (options.priority) {
      result = result.filter((e) => e.triagePriority === options.priority);
    }

    if (options.status === 'verified') {
      result = result.filter((e) => e.doctorReview.verified);
    } else if (options.status === 'pending') {
      result = result.filter((e) => !e.doctorReview.verified);
    }

    if (options.search) {
      const q = options.search.toLowerCase().trim();
      result = result.filter(
        (e) =>
          e.opdToken.toLowerCase().includes(q) ||
          e.demographics.fullName.toLowerCase().includes(q) ||
          (e.demographics.abha.abhaAddress && e.demographics.abha.abhaAddress.toLowerCase().includes(q)) ||
          (e.demographics.abha.abhaNumber && e.demographics.abha.abhaNumber.toLowerCase().includes(q)) ||
          e.chiefComplaint.title.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getEncounterById(id: string): PatientCaseEncounter | undefined {
    return this.encounters.find((e) => e.id === id);
  }

  public createEncounter(encounter: PatientCaseEncounter): PatientCaseEncounter {
    // Generate token if not provided
    if (!encounter.opdToken) {
      const nextNum = this.encounters.length + 40;
      encounter.opdToken = `OPD-MED-${String(nextNum).padStart(3, '0')}`;
    }

    if (!encounter.createdAt) {
      encounter.createdAt = new Date().toISOString();
    }

    // Add to beginning of encounters queue
    this.encounters.unshift(encounter);
    this.persist();

    // Broadcast SSE to all connected clients (Doctor Station)
    sse.broadcast('PATIENT_REGISTERED', {
      patient: encounter,
      stats: this.getStats(),
    });

    console.log(`[Clinical DB] New Patient Intake Registered: ${encounter.demographics.fullName} (${encounter.opdToken}) [Priority: ${encounter.triagePriority}]`);
    return encounter;
  }

  public updateEncounter(id: string, updates: Partial<PatientCaseEncounter>): PatientCaseEncounter | undefined {
    const index = this.encounters.findIndex((e) => e.id === id);
    if (index === -1) return undefined;

    this.encounters[index] = { ...this.encounters[index], ...updates };
    this.persist();

    sse.broadcast('PATIENT_UPDATED', {
      patient: this.encounters[index],
      stats: this.getStats(),
    });

    return this.encounters[index];
  }

  public updateDoctorReview(
    patientId: string,
    doctorReview: DoctorVerification,
    saveToHis = false
  ): PatientCaseEncounter | undefined {
    const patient = this.encounters.find((e) => e.id === patientId);
    if (!patient) return undefined;

    patient.doctorReview = { ...patient.doctorReview, ...doctorReview };

    if (saveToHis) {
      patient.savedToHis = true;
      patient.hisSyncTimestamp = new Date().toISOString();
    }

    this.persist();

    sse.broadcast('DOCTOR_VERIFIED', {
      patientId,
      patient,
      saveToHis,
      stats: this.getStats(),
    });

    console.log(`[Clinical DB] Doctor Verification Recorded for ${patient.demographics.fullName} (HIS Synced: ${saveToHis})`);
    return patient;
  }

  public resetToDefaults(): PatientCaseEncounter[] {
    this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
    this.persist();

    sse.broadcast('QUEUE_RESET', {
      encounters: this.encounters,
      stats: this.getStats(),
    });

    console.log('[Clinical DB] Patient Queue reset to demonstration defaults.');
    return this.encounters;
  }

  public getStats(): SystemStats {
    const total = this.encounters.length;
    let emergency = 0;
    let urgent = 0;
    let routine = 0;
    let verified = 0;
    let pending = 0;
    let hisSynced = 0;

    for (const e of this.encounters) {
      if (e.triagePriority === 'emergency') emergency++;
      else if (e.triagePriority === 'urgent') urgent++;
      else routine++;

      if (e.doctorReview.verified) verified++;
      else pending++;

      if (e.savedToHis) hisSynced++;
    }

    return {
      total,
      emergency,
      urgent,
      routine,
      verified,
      pending,
      hisSynced,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const db = new ClinicalDatabaseService();
