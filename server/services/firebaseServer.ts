import type { PatientRecord, PatientCaseEncounter } from '../../src/types/clinical';

export interface FirebaseServerStatus {
  configured: boolean;
  projectId: string;
  databaseType: string;
  connectionStatus: string;
  storageConfigured: boolean;
  storageBucket: string;
}

export interface FirebaseConnectionTestResult {
  configured: boolean;
  connected: boolean;
  projectId: string;
  databaseType: string;
  connectionStatus: string;
  writeTestResult: string;
  readTestResult: string;
  storageStatus: string;
  error?: string;
}

export class FirebaseServerService {
  private projectId: string;
  private apiKey: string;
  private storageBucket: string;

  constructor() {
    this.projectId =
      process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || '';
    this.apiKey =
      process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || '';
    this.storageBucket =
      process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET || '';

    if (this.projectId && this.apiKey) {
      console.log(`[Firebase Server] Connected to Firestore Project: ${this.projectId}`);
      if (this.storageBucket) {
        console.log(`[Firebase Server] Storage Bucket configured: ${this.storageBucket}`);
      }
    } else {
      console.log('[Firebase Server] Running in Local Storage mode (Firebase credentials not set in env).');
    }
  }

  public getStatus(): FirebaseServerStatus {
    const configured = Boolean(this.projectId && this.apiKey);
    return {
      configured,
      projectId: this.projectId || 'not_configured',
      databaseType: 'Cloud Firestore',
      connectionStatus: configured
        ? `Configured with Project ID: ${this.projectId}`
        : 'Not Connected — Missing FIREBASE_PROJECT_ID / FIREBASE_API_KEY in .env',
      storageConfigured: Boolean(this.storageBucket && this.apiKey),
      storageBucket: this.storageBucket || 'not_configured',
    };
  }

  /**
   * Execute a real read and write test against Cloud Firestore
   */
  public async testRealFirebaseConnection(): Promise<FirebaseConnectionTestResult> {
    if (!this.projectId || !this.apiKey) {
      return {
        configured: false,
        connected: false,
        projectId: this.projectId || 'not_configured',
        databaseType: 'Cloud Firestore',
        connectionStatus: 'Not Connected (Missing credentials in .env)',
        writeTestResult: 'Failed ✗ (FIREBASE_PROJECT_ID or FIREBASE_API_KEY not configured in .env)',
        readTestResult: 'Failed ✗ (FIREBASE_PROJECT_ID or FIREBASE_API_KEY not configured in .env)',
        storageStatus: this.storageBucket ? `Bucket: ${this.storageBucket}` : 'Not Configured ✗',
        error: 'Firebase credentials are not set in .env. Please configure FIREBASE_PROJECT_ID and FIREBASE_API_KEY.',
      };
    }

    const testDocId = `probe_${Date.now()}`;
    const testUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/_healthcheck/${testDocId}?key=${this.apiKey}`;

    let writeResult = '';
    let readResult = '';
    let isConnected = false;
    let errorDetail: string | undefined;

    // 1. Real Write Test
    try {
      const writeRes = await fetch(testUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            probe: { stringValue: 'connection_test' },
            timestamp: { stringValue: new Date().toISOString() },
          },
        }),
      });

      if (writeRes.ok) {
        writeResult = 'Success ✓ (200 OK — Test document written to Cloud Firestore)';
        isConnected = true;
      } else {
        const errText = await writeRes.text();
        writeResult = `Failed ✗ (HTTP ${writeRes.status}: ${errText.slice(0, 120)})`;
        errorDetail = `Write error: HTTP ${writeRes.status} - ${errText}`;
      }
    } catch (err) {
      writeResult = `Failed ✗ (${err instanceof Error ? err.message : 'Network Error'})`;
      errorDetail = String(err);
    }

    // 2. Real Read Test
    if (isConnected) {
      try {
        const readRes = await fetch(testUrl);
        if (readRes.ok) {
          readResult = 'Success ✓ (200 OK — Test document verified and read from Cloud Firestore)';
        } else {
          readResult = `Failed ✗ (HTTP ${readRes.status})`;
        }

        // Clean up test document
        await fetch(testUrl, { method: 'DELETE' }).catch(() => {});
      } catch (err) {
        readResult = `Failed ✗ (${err instanceof Error ? err.message : 'Network Error'})`;
      }
    } else {
      readResult = 'Skipped ✗ (Write failed, unable to verify read)';
    }

    const storageStatus = this.storageBucket
      ? `Configured (${this.storageBucket})`
      : 'Not Configured ✗ (Set FIREBASE_STORAGE_BUCKET in .env)';

    return {
      configured: true,
      connected: isConnected,
      projectId: this.projectId,
      databaseType: 'Cloud Firestore',
      connectionStatus: isConnected ? 'Connected & Verified ✓' : 'Connection Failed ✗',
      writeTestResult: writeResult,
      readTestResult: readResult,
      storageStatus,
      error: errorDetail,
    };
  }

  /**
   * Save patient record to Firestore collection `patients/{patientId}`
   */
  public async savePatientToFirestore(patient: PatientRecord): Promise<{ success: boolean; error?: string }> {
    if (!this.projectId || !this.apiKey) {
      return { success: false, error: 'Firebase credentials not configured in .env' };
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/patients/${patient.patientId}?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            patientId: { stringValue: patient.patientId },
            fullName: { stringValue: patient.fullName },
            age: { integerValue: String(patient.age) },
            gender: { stringValue: patient.gender },
            phone: { stringValue: patient.phone },
            address: { stringValue: patient.address || '' },
            registeredAt: { stringValue: patient.registeredAt },
            totalVisits: { integerValue: String(patient.totalVisits || 0) },
            jsonData: { stringValue: JSON.stringify(patient) },
            lastSyncedAt: { stringValue: new Date().toISOString() },
          },
        }),
      });

      if (res.ok) {
        console.log(`[Firebase Server] Successfully synced patient ${patient.patientId} to Cloud Firestore.`);
        return { success: true };
      }

      const errText = await res.text();
      console.warn(`[Firebase Server] Error saving patient ${patient.patientId} (HTTP ${res.status}):`, errText);
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    } catch (err) {
      console.warn(`[Firebase Server] Network exception saving patient ${patient.patientId}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Save visit record to Firestore subcollection `patients/{patientId}/visits/{visitId}`
   */
  public async saveVisitToFirestore(
    patientId: string,
    visit: PatientCaseEncounter
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.projectId || !this.apiKey) {
      return { success: false, error: 'Firebase credentials not configured in .env' };
    }

    try {
      const visitId = visit.visitId || 'V001';
      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/patients/${patientId}/visits/${visitId}?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            visitId: { stringValue: visitId },
            patientId: { stringValue: patientId },
            visitDate: { stringValue: visit.visitDate || '' },
            attendingDoctor: { stringValue: visit.attendingDoctor || '' },
            opdToken: { stringValue: visit.opdToken || '' },
            createdAt: { stringValue: visit.createdAt || new Date().toISOString() },
            chiefComplaint: { stringValue: visit.chiefComplaint?.title || visit.chiefComplaint?.description || '' },
            verificationStatus: { stringValue: visit.doctorReview?.verified ? 'Verified by Doctor' : 'Pending Verification' },
            doctorVerifiedAt: { stringValue: visit.doctorReview?.verifiedAt || '' },
            doctorVerifiedBy: { stringValue: visit.doctorReview?.verifiedBy || '' },
            doctorNotes: { stringValue: visit.doctorReview?.doctorNotes || visit.doctorReview?.notes || '' },
            doctorAdvice: { stringValue: visit.doctorReview?.advice || '' },
            receiptToken: { stringValue: visit.receiptToken || '' },
            receiptUrl: { stringValue: visit.receiptUrl || '' },
            jsonData: { stringValue: JSON.stringify(visit) },
            storedAt: { stringValue: new Date().toISOString() },
          },
        }),
      });

      if (res.ok) {
        console.log(`[Firebase Server] Successfully synced visit ${visitId} for patient ${patientId} to Cloud Firestore.`);
        return { success: true };
      }

      const errText = await res.text();
      console.warn(`[Firebase Server] Error saving visit ${visitId} (HTTP ${res.status}):`, errText);
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    } catch (err) {
      console.warn(`[Firebase Server] Network exception saving visit ${visit.visitId}:`, err);
      return { success: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  /**
   * Save verified receipt metadata to Firestore collection `receipts/{token}`
   */
  public async saveReceiptToFirestore(receipt: {
    receiptToken: string;
    patientId: string;
    visitId: string;
    patientName: string;
    phone: string;
    doctorName: string;
    verifiedAt: string;
    receiptUrl: string;
    firebaseStorageUrl?: string;
  }): Promise<boolean> {
    if (!this.projectId || !this.apiKey) {
      return false;
    }

    try {
      const url = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents/receipts/${receipt.receiptToken}?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            receiptToken: { stringValue: receipt.receiptToken },
            patientId: { stringValue: receipt.patientId },
            visitId: { stringValue: receipt.visitId },
            patientName: { stringValue: receipt.patientName },
            phone: { stringValue: receipt.phone },
            doctorName: { stringValue: receipt.doctorName },
            verifiedAt: { stringValue: receipt.verifiedAt },
            receiptUrl: { stringValue: receipt.receiptUrl },
            firebaseStorageUrl: { stringValue: receipt.firebaseStorageUrl || '' },
            storedAt: { stringValue: new Date().toISOString() },
          },
        }),
      });

      if (res.ok) {
        console.log(`[Firebase Server] Saved receipt ${receipt.receiptToken} to Firestore.`);
        return true;
      }

      console.warn(`[Firebase Server] Firestore write error (HTTP ${res.status}):`, await res.text());
      return false;
    } catch (err) {
      console.warn('[Firebase Server] Firestore connection error:', err);
      return false;
    }
  }

  /**
   * Upload PDF document to Firebase Storage
   */
  public async uploadPdfToFirebaseStorage(options: {
    storagePath: string;
    pdfBuffer: Buffer;
  }): Promise<string | null> {
    const { storagePath, pdfBuffer } = options;

    if (!this.storageBucket || !this.apiKey) {
      console.log('[Firebase Server] Storage bucket not set. PDF stored locally on server.');
      return null;
    }

    try {
      const encodedPath = encodeURIComponent(storagePath);
      const uploadUrl = `https://firebasestorage.googleapis.com/v0/b/${this.storageBucket}/o?name=${encodedPath}&uploadType=media`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
        },
        body: pdfBuffer,
      });

      if (response.ok) {
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${this.storageBucket}/o/${encodedPath}?alt=media`;
        console.log(`[Firebase Server] Uploaded PDF to Firebase Storage: ${publicUrl}`);
        return publicUrl;
      }

      console.warn(`[Firebase Server] Firebase Storage upload error HTTP ${response.status}:`, await response.text());
      return null;
    } catch (err) {
      console.warn('[Firebase Server] Firebase Storage upload exception:', err);
      return null;
    }
  }
}

export const firebaseServer = new FirebaseServerService();
