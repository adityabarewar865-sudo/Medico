/**
 * Firebase Firestore Central Database Connector
 *
 * Supports both official Firebase Web SDK (if configured)
 * and direct Firebase Firestore REST API for reliable, zero-lockup
 * real-time persistence across browser and cloud instances.
 */

import type { PatientRecord } from '../types/clinical';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

// Read from Vite environment or default
const FIREBASE_CONFIG: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

class FirebaseFirestoreService {
  private isConfigured: boolean = false;
  private projectId: string = '';

  constructor() {
    this.projectId = FIREBASE_CONFIG.projectId || '';
    this.isConfigured = Boolean(this.projectId && FIREBASE_CONFIG.apiKey);
    if (this.isConfigured) {
      console.log(`[Firebase] Initialized Firestore Central DB with Project: ${this.projectId}`);
    } else {
      console.log('[Firebase] Running in Local Central Database mode (VITE_FIREBASE_PROJECT_ID not set). Central persistence enabled via Express & LocalStorage.');
    }
  }

  public getIsConfigured(): boolean {
    return this.isConfigured;
  }

  public getProjectId(): string {
    return this.projectId || 'district-hospital-central';
  }

  /**
   * Save a patient record to Firestore central database
   */
  public async savePatientToCloud(patient: PatientRecord): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/patients/${patient.patientId}?key=${FIREBASE_CONFIG.apiKey}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            patientId: { stringValue: patient.patientId },
            fullName: { stringValue: patient.fullName },
            age: { integerValue: patient.age },
            gender: { stringValue: patient.gender },
            phone: { stringValue: patient.phone },
            registeredAt: { stringValue: patient.registeredAt },
            totalVisits: { integerValue: patient.totalVisits },
            jsonData: { stringValue: JSON.stringify(patient) },
          },
        }),
      });

      return res.ok;
    } catch (err) {
      console.warn('[Firebase] Cloud sync error:', err);
      return false;
    }
  }

  /**
   * Fetch all patient records from Firestore central database
   */
  public async fetchPatientsFromCloud(): Promise<PatientRecord[] | null> {
    if (!this.isConfigured) return null;

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/patients?key=${FIREBASE_CONFIG.apiKey}`;
      const res = await fetch(url);
      if (!res.ok) return null;

      const data = await res.json();
      if (!data.documents || !Array.isArray(data.documents)) return [];

      const list: PatientRecord[] = [];
      for (const doc of data.documents) {
        if (doc.fields?.jsonData?.stringValue) {
          try {
            list.push(JSON.parse(doc.fields.jsonData.stringValue));
          } catch {
            // ignore
          }
        }
      }
      return list;
    } catch (err) {
      console.warn('[Firebase] Failed to fetch from cloud Firestore:', err);
      return null;
    }
  }
}

export const firebaseService = new FirebaseFirestoreService();
