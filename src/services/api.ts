import type {
  PatientCaseEncounter,
  DoctorVerification,
  PatientRecord,
  Gender,
  VisitMedicineItem,
} from '../types/clinical';

export interface HealthResponse {
  status: string;
  version: string;
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  activeSseConnections: number;
  database: {
    status: string;
    totalEncounters: number;
    emergencyQueue: number;
    urgentQueue: number;
    routineQueue: number;
    verifiedByDoctor: number;
    syncedToHis: number;
  };
  abdmGateway: {
    status: string;
    environment: string;
    fhirVersion: string;
    nrcesCompliant: boolean;
  };
  hisGateway: {
    status: string;
    endpoint: string;
    standard: string;
  };
}

export interface PatientsApiResponse {
  success: boolean;
  count: number;
  data: PatientCaseEncounter[];
  stats?: {
    total: number;
    emergency: number;
    urgent: number;
    routine: number;
    verified: number;
    pending: number;
    hisSynced: number;
    lastUpdated: string;
  };
}

export interface PatientFilter {
  search?: string;
  priority?: 'emergency' | 'urgent' | 'routine';
  status?: 'verified' | 'pending';
}

const API_BASE = '/api';

class ApiClient {
  private isOnline = false;
  private sseSource: EventSource | null = null;
  private statusListeners: Array<(online: boolean) => void> = [];
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private eventSubscribers: Array<(type: string, data: unknown) => void> = [];

  constructor() {
    this.checkHealth();
    this.startHealthPolling();
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public onStatusChange(listener: (online: boolean) => void): () => void {
    this.statusListeners.push(listener);
    listener(this.isOnline);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private setOnline(online: boolean): void {
    if (this.isOnline !== online) {
      this.isOnline = online;
      this.statusListeners.forEach((l) => l(online));
      if (online && !this.sseSource) {
        this.initSse();
      }
    }
  }

  private startHealthPolling(): void {
    if (typeof window === 'undefined') return;

    const poll = async () => {
      await this.checkHealth();
      const delay = this.isOnline ? 10000 : 3500;
      this.pollTimer = setTimeout(poll, delay);
    };

    this.pollTimer = setTimeout(poll, 2500);
  }

  public stopHealthPolling(): void {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public async checkHealth(): Promise<HealthResponse | null> {
    try {
      const res = await fetch(`${API_BASE}/health`, {
        cache: 'no-store',
      });
      if (res.ok) {
        const data: HealthResponse = await res.json();
        this.setOnline(true);
        return data;
      }
      this.setOnline(false);
      return null;
    } catch {
      this.setOnline(false);
      return null;
    }
  }

  // =========================================================================
  // HOSPITAL RECORDS & MULTI-VISIT API (Patients -> Visits -> Meds)
  // =========================================================================

  public async getHospitalPatients(search?: string): Promise<PatientRecord[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);

    const qs = params.toString();
    const url = `${API_BASE}/hospital/patients${qs ? `?${qs}` : ''}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch hospital patients: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data || [];
  }

  public async getHospitalPatient(patientId: string): Promise<PatientRecord> {
    const res = await fetch(`${API_BASE}/hospital/patients/${encodeURIComponent(patientId)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch hospital patient ${patientId}: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async getPatientMedicineHistory(patientId: string): Promise<VisitMedicineItem[]> {
    const res = await fetch(`${API_BASE}/hospital/patients/${encodeURIComponent(patientId)}/medicines`);
    if (!res.ok) {
      throw new Error(`Failed to fetch medicine history: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data || [];
  }

  public async registerHospitalPatient(data: {
    fullName: string;
    age: number;
    gender: Gender;
    phone: string;
    address?: string;
    emergencyContact?: string;
    abhaNumber?: string;
    abhaAddress?: string;
  }): Promise<PatientRecord> {
    const res = await fetch(`${API_BASE}/hospital/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      throw new Error(`Failed to register hospital patient: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async createHospitalVisit(
    patientId: string,
    visitData: Partial<PatientCaseEncounter>
  ): Promise<PatientCaseEncounter> {
    const res = await fetch(`${API_BASE}/hospital/patients/${encodeURIComponent(patientId)}/visits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(visitData),
    });
    if (!res.ok) {
      throw new Error(`Failed to create visit: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async updateHospitalDoctorReview(
    patientId: string,
    visitId: string,
    doctorReview: DoctorVerification,
    saveToHis = false
  ): Promise<PatientCaseEncounter> {
    const res = await fetch(
      `${API_BASE}/hospital/patients/${encodeURIComponent(patientId)}/visits/${encodeURIComponent(visitId)}/review`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorReview, saveToHis }),
      }
    );
    if (!res.ok) {
      throw new Error(`Failed to update doctor review: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async resetHospitalData(): Promise<unknown> {
    const res = await fetch(`${API_BASE}/hospital/reset`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Failed to reset hospital data: ${res.statusText}`);
    }
    this.setOnline(true);
    return res.json();
  }

  public async getFirebaseStatus(): Promise<{
    configured: boolean;
    connected: boolean;
    projectId: string;
    databaseType: string;
    connectionStatus: string;
    writeTestResult: string;
    readTestResult: string;
    storageStatus: string;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/hospital/firebase/status`);
      if (!res.ok) {
        return {
          configured: false,
          connected: false,
          projectId: 'error',
          databaseType: 'Cloud Firestore',
          connectionStatus: `HTTP ${res.status}`,
          writeTestResult: 'Failed ✗',
          readTestResult: 'Failed ✗',
          storageStatus: 'Unknown',
        };
      }
      const json = await res.json();
      return json.data;
    } catch {
      return {
        configured: false,
        connected: false,
        projectId: 'offline',
        databaseType: 'Cloud Firestore',
        connectionStatus: 'Backend Server Offline',
        writeTestResult: 'Failed ✗ (Server Unreachable)',
        readTestResult: 'Failed ✗ (Server Unreachable)',
        storageStatus: 'Offline',
      };
    }
  }

  // =========================================================================
  // OPD ENCOUNTERS (Backwards compatibility with kiosk & triage)
  // =========================================================================

  public async getPatients(filter?: PatientFilter): Promise<PatientsApiResponse> {
    const params = new URLSearchParams();
    if (filter?.search) params.set('search', filter.search);
    if (filter?.priority) params.set('priority', filter.priority);
    if (filter?.status) params.set('status', filter.status);

    const qs = params.toString();
    const url = `${API_BASE}/patients${qs ? `?${qs}` : ''}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch patients: ${res.statusText}`);
    }
    this.setOnline(true);
    return res.json();
  }

  public async getPatientById(id: string): Promise<PatientCaseEncounter> {
    const res = await fetch(`${API_BASE}/patients/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch patient ${id}: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  public async createPatient(encounter: PatientCaseEncounter): Promise<PatientCaseEncounter> {
    const res = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(encounter),
    });
    if (!res.ok) {
      throw new Error(`Failed to create patient: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async updateDoctorReview(
    patientId: string,
    doctorReview: DoctorVerification,
    saveToHis = false
  ): Promise<PatientCaseEncounter> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/doctor-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorReview, saveToHis }),
    });
    if (!res.ok) {
      throw new Error(`Failed to submit doctor review: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async updateVitals(
    patientId: string,
    vitals: { bp: string; pulse: string; spo2: string; temp: string; rr: string }
  ): Promise<PatientCaseEncounter> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/vitals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vitals),
    });
    if (!res.ok) {
      throw new Error(`Failed to update bedside vitals: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  public async resetPatients(): Promise<PatientCaseEncounter[]> {
    const res = await fetch(`${API_BASE}/patients/reset`, {
      method: 'POST',
    });
    if (!res.ok) {
      throw new Error(`Failed to reset patient queue: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async syncWithHis(patientId: string): Promise<{ success: boolean; ackId: string; hisMrn: string }> {
    const res = await fetch(`${API_BASE}/his/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId }),
    });
    if (!res.ok) {
      throw new Error(`Failed to sync with HIS: ${res.statusText}`);
    }
    return res.json();
  }

  public async getFhirBundle(patientId: string): Promise<unknown> {
    const res = await fetch(`${API_BASE}/patients/${patientId}/fhir`);
    if (!res.ok) {
      throw new Error(`Failed to fetch FHIR bundle: ${res.statusText}`);
    }
    return res.json();
  }

  public async verifyAndGenerateReceipt(
    patientId: string,
    visitId: string,
    payload: {
      doctorReview: DoctorVerification;
      saveToHis?: boolean;
      pdfBase64?: string;
      hpi?: string;
      chiefComplaint?: string;
      vitals?: {
        bp: string;
        pulse: string;
        spo2: string;
        temp: string;
        rr: string;
      };
    }
  ): Promise<{
    visit: PatientCaseEncounter;
    receiptToken: string;
    receiptUrl: string;
    firebaseStorageUrl?: string;
  }> {
    const res = await fetch(`${API_BASE}/hospital/patients/${patientId}/visits/${visitId}/verify-and-generate-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`Failed to verify and generate receipt: ${res.statusText}`);
    }
    this.setOnline(true);
    const json = await res.json();
    return json.data;
  }

  public async getReceiptByToken(token: string): Promise<{
    receipt: {
      receiptToken: string;
      patientId: string;
      visitId: string;
      patientName: string;
      phone: string;
      doctorName: string;
      verifiedAt: string;
      receiptUrl: string;
      firebaseStorageUrl?: string;
    };
    patient?: PatientRecord;
    visit?: PatientCaseEncounter;
  }> {
    const res = await fetch(`${API_BASE}/receipts/${token}`);
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: 'Sorry, this receipt link is no longer valid.' }));
      throw new Error(errJson.error || 'Sorry, this receipt link is no longer valid.');
    }
    const json = await res.json();
    return json.data;
  }

  // =========================================================================
  // SSE REAL-TIME SUBSCRIPTION
  // =========================================================================

  private initSse(): void {
    if (typeof window === 'undefined' || this.sseSource) return;

    try {
      this.sseSource = new EventSource(`${API_BASE}/events`);

      this.sseSource.onopen = () => {
        this.setOnline(true);
      };

      const eventTypes = [
        'PATIENT_REGISTERED',
        'PATIENT_UPDATED',
        'DOCTOR_VERIFIED',
        'QUEUE_RESET',
        'HOSPITAL_PATIENTS_UPDATED',
      ];

      eventTypes.forEach((evt) => {
        this.sseSource?.addEventListener(evt, (e: MessageEvent) => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(e.data);
          } catch {
            parsed = e.data;
          }
          this.eventSubscribers.forEach((sub) => sub(evt, parsed));
        });
      });

      this.sseSource.onerror = () => {
        this.setOnline(false);
        if (this.sseSource) {
          this.sseSource.close();
          this.sseSource = null;
        }
      };
    } catch (err) {
      console.warn('[API Client] Could not initialize EventSource:', err);
    }
  }

  public subscribeToRealtimeEvents(onEvent: (type: string, data: unknown) => void): () => void {
    this.eventSubscribers.push(onEvent);
    if (this.isOnline && !this.sseSource) {
      this.initSse();
    }
    return () => {
      this.eventSubscribers = this.eventSubscribers.filter((s) => s !== onEvent);
    };
  }
}

export const api = new ApiClient();
