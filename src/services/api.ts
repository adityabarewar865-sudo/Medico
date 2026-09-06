import type { PatientCaseEncounter, DoctorVerification } from '../types/clinical';

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

  constructor() {
    this.checkHealth();
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
    }
  }

  public async checkHealth(): Promise<HealthResponse | null> {
    try {
      const res = await fetch(`${API_BASE}/health`);
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

  public subscribeToRealtimeEvents(onEvent: (type: string, data: unknown) => void): () => void {
    if (typeof window === 'undefined') return () => {};

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
      ];

      eventTypes.forEach((evt) => {
        this.sseSource?.addEventListener(evt, (e: MessageEvent) => {
          try {
            const parsed = JSON.parse(e.data);
            onEvent(evt, parsed);
          } catch {
            onEvent(evt, e.data);
          }
        });
      });

      this.sseSource.onerror = () => {
        // SSE disconnected or backend restarting
        this.setOnline(false);
      };
    } catch (err) {
      console.warn('[API Client] Could not initialize EventSource:', err);
    }

    return () => {
      if (this.sseSource) {
        this.sseSource.close();
        this.sseSource = null;
      }
    };
  }
}

export const api = new ApiClient();
