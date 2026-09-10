import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import type {
  PatientCaseEncounter,
  DoctorVerification,
  PatientRecord,
  Gender,
  VisitMedicineItem,
} from '../../src/types/clinical';
import { INITIAL_PATIENTS, SAMPLE_PATIENT_RECORDS } from '../../src/data/samplePatients';
import { sse } from './sse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'encounters.json');
const HOSPITAL_DB_FILE = path.join(DATA_DIR, 'hospital_patients.json');
const EXCEL_DB_FILE = path.join(DATA_DIR, 'Hospital_Patient_Records.xlsx');

export function formatTimestamp(d?: Date | string | number): string {
  if (!d) return '';
  const date = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '';
  const YYYY = date.getFullYear();
  const MM = String(date.getMonth() + 1).padStart(2, '0');
  const DD = String(date.getDate()).padStart(2, '0');
  const HH = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD} ${HH}:${mm}:${ss}`;
}

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
  private hospitalPatients: PatientRecord[] = [];
  private isInitialized = false;

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      // 1. Load or initialize hospital patients
      if (fs.existsSync(HOSPITAL_DB_FILE)) {
        const rawHosp = fs.readFileSync(HOSPITAL_DB_FILE, 'utf-8');
        if (rawHosp.trim()) {
          this.hospitalPatients = JSON.parse(rawHosp);
          console.log(`[Clinical DB] Loaded ${this.hospitalPatients.length} hospital patient records from disk.`);
        } else {
          this.hospitalPatients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
        }
      } else {
        this.hospitalPatients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
      }

      // 2. Load or initialize encounters
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        if (raw.trim()) {
          this.encounters = JSON.parse(raw);
          console.log(`[Clinical DB] Loaded ${this.encounters.length} patient encounters from disk.`);
        } else {
          this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
        }
      } else {
        this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
      }

      this.persist();
      this.isInitialized = true;
    } catch (err) {
      console.error('[Clinical DB] Error initializing encounters/hospital file:', err);
      this.hospitalPatients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
      this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
      this.isInitialized = true;
    }
  }

  public getExcelFilePath(): string {
    return EXCEL_DB_FILE;
  }

  public generateExcelRows(): Array<Record<string, string | number>> {
    const rows: Array<Record<string, string | number>> = [];
    const nowStr = formatTimestamp(new Date());

    for (const patient of this.hospitalPatients) {
      if (!patient.visits || patient.visits.length === 0) {
        const regDate = new Date(patient.registeredAt || Date.now());
        const dateStr = regDate.toISOString().split('T')[0];
        const timeStr = regDate.toLocaleTimeString('en-US', { hour12: false });
        rows.push({
          'Patient ID': patient.patientId,
          'Patient Name': patient.fullName,
          'Age': patient.age,
          'Gender': patient.gender ? patient.gender.toUpperCase() : 'OTHER',
          'Mobile Number': patient.phone,
          'Problem / Complaint / Wellness': 'General Registration / Wellness',
          'Visit ID': 'V001',
          'Visit Date': dateStr,
          'Visit Time': timeStr,
          'Created Date': dateStr,
          'Created Time': timeStr,
          'Patient Created Timestamp': patient.registeredAt || regDate.toISOString(),
          'Visit Created Timestamp': patient.registeredAt || regDate.toISOString(),
          'Symptoms': 'None reported',
          'History of Present Illness': 'General registration / wellness check',
          'Past Medical History': 'None',
          'Current Medicines': 'None',
          'Allergies': 'NKDA (No known drug allergies)',
          'Red-Flag Symptoms': 'None',
          'Reports / Documents': 'None',
          'OCR Information': 'None',
          'AI Summary': 'Patient registered at reception',
          'Doctor Name': 'Pending',
          'Doctor Notes': '',
          'Doctor Verified Summary': '',
          'Verification Status': 'Pending Verification',
          'Verification Date': '',
          'Verification Time': '',
          'Medicines Prescribed': 'None',
          'Medicine Name': 'None',
          'Dosage': '-',
          'Frequency': '-',
          'Medicine Instructions': '-',
          'Doctor Advice / Tips': '',
          'Receipt Status': 'Not Generated',
          'Receipt Generated At': '',
          'Receipt File Path / URL': '',
          'Firebase Stored At': '',
          'Excel Stored At': nowStr,
        });
        continue;
      }

      // Sort visits chronologically
      const sortedVisits = [...patient.visits].sort((a, b) => {
        const timeA = new Date(a.createdAt || a.visitDate || 0).getTime();
        const timeB = new Date(b.createdAt || b.visitDate || 0).getTime();
        return timeA - timeB;
      });

      for (const visit of sortedVisits) {
        const createdDate = visit.createdAt ? new Date(visit.createdAt) : new Date();
        const dateStr = visit.visitDate || createdDate.toISOString().split('T')[0];
        const timeStr = createdDate.toLocaleTimeString('en-US', { hour12: false });

        const problem =
          visit.chiefComplaint?.title ||
          visit.chiefComplaint?.description ||
          visit.clinicalSummary?.chiefComplaintFormatted ||
          'Outpatient Consultation';

        const symptoms =
          visit.adaptiveAnswers && visit.adaptiveAnswers.length > 0
            ? visit.adaptiveAnswers
                .map((a) => `${a.question}: ${Array.isArray(a.answer) ? a.answer.join(', ') : a.answer}`)
                .join('; ')
            : visit.chiefComplaint?.description || 'None reported';

        const hpi =
          visit.clinicalSummary?.historyOfPresentIllness ||
          visit.chiefComplaint?.description ||
          '';

        const pmh =
          visit.clinicalSummary?.pastMedicalHistory &&
          visit.clinicalSummary.pastMedicalHistory.length > 0
            ? visit.clinicalSummary.pastMedicalHistory.join(', ')
            : 'None';

        const currentMeds =
          visit.clinicalSummary?.activeMedications &&
          visit.clinicalSummary.activeMedications.length > 0
            ? visit.clinicalSummary.activeMedications
                .map((m) => `${m.name} ${m.dosage || ''}`)
                .join(', ')
            : 'None';

        const allergies =
          visit.clinicalSummary?.allergies && visit.clinicalSummary.allergies.length > 0
            ? visit.clinicalSummary.allergies
                .map((a) => `${a.allergen} (${a.reaction || a.severity})`)
                .join(', ')
            : 'NKDA (No known drug allergies)';

        const redFlags =
          visit.redFlags && visit.redFlags.length > 0
            ? visit.redFlags.map((r) => r.symptom || r.description || JSON.stringify(r)).join('; ')
            : 'None';

        const documents =
          visit.documents && visit.documents.length > 0
            ? visit.documents.map((d) => `${d.name || d.type} (${d.type})`).join(', ')
            : 'None';

        const ocr =
          visit.documents && visit.documents.length > 0
            ? visit.documents
                .map((d) => d.extractedText)
                .filter(Boolean)
                .join('\n---\n') || 'None'
            : 'None';

        const aiSummary =
          visit.clinicalSummary?.investigationsSummary ||
          visit.triageRationale ||
          'Awaiting consultation.';

        const doctorName =
          visit.doctorReview?.verifiedBy || visit.attendingDoctor || 'Pending Verification';

        const doctorNotes =
          visit.doctorReview?.doctorNotes || visit.doctorReview?.notes || '';

        const doctorVerifiedSummary =
          visit.doctorReview?.verifiedDiagnosis || '';

        const verificationStatus = visit.doctorReview?.verified
          ? 'Verified by Doctor'
          : 'Pending Verification';

        const verificationDate = visit.doctorReview?.verifiedAt
          ? new Date(visit.doctorReview.verifiedAt).toISOString().split('T')[0]
          : '';

        const verificationTime = visit.doctorReview?.verifiedAt
          ? new Date(visit.doctorReview.verifiedAt).toLocaleTimeString('en-US', { hour12: false })
          : '';

        const medicinesList =
          visit.medicines && visit.medicines.length > 0
            ? visit.medicines
            : visit.doctorReview?.prescribedMedications &&
              visit.doctorReview.prescribedMedications.length > 0
            ? visit.doctorReview.prescribedMedications.map((rx, idx) => ({
                id: `rx_${patient.patientId}_${visit.visitId}_${idx}`,
                visitId: visit.visitId || 'V001',
                patientId: patient.patientId,
                name: rx.name,
                dosage: rx.dosage,
                frequency: rx.frequency,
                duration: rx.duration,
                instructions: rx.instructions,
                datePrescribed: visit.visitDate || dateStr,
                doctor: doctorName,
              }))
            : [];

        const medicinesPrescribed =
          medicinesList.length > 0
            ? medicinesList
                .map((m) => `${m.name} (${m.dosage}, ${m.frequency}${m.duration ? ', ' + m.duration : ''})`)
                .join('; ')
            : 'None';

        const doctorAdvice = visit.doctorReview?.advice || '';
        const receiptStatus = visit.receiptToken ? 'Generated' : 'Not Generated';
        const receiptGeneratedAt = visit.doctorReview?.verifiedAt
          ? formatTimestamp(visit.doctorReview.verifiedAt)
          : '';
        const receiptFilePathOrUrl =
          visit.receiptUrl || (visit.receiptToken ? `/receipt/${visit.receiptToken}` : '');

        const firebaseStoredAt = visit.firebaseStoredAt
          ? formatTimestamp(visit.firebaseStoredAt)
          : '';

        const excelStoredAt = visit.excelStoredAt
          ? formatTimestamp(visit.excelStoredAt)
          : nowStr;

        const baseRow = {
          'Patient ID': patient.patientId,
          'Patient Name': patient.fullName,
          'Age': patient.age,
          'Gender': patient.gender ? patient.gender.toUpperCase() : 'OTHER',
          'Mobile Number': patient.phone,
          'Problem / Complaint / Wellness': problem,
          'Visit ID': visit.visitId || 'V001',
          'Visit Date': dateStr,
          'Visit Time': timeStr,
          'Created Date': createdDate.toISOString().split('T')[0],
          'Created Time': timeStr,
          'Patient Created Timestamp': patient.registeredAt || createdDate.toISOString(),
          'Visit Created Timestamp': visit.createdAt || createdDate.toISOString(),
          'Symptoms': symptoms,
          'History of Present Illness': hpi,
          'Past Medical History': pmh,
          'Current Medicines': currentMeds,
          'Allergies': allergies,
          'Red-Flag Symptoms': redFlags,
          'Reports / Documents': documents,
          'OCR Information': ocr,
          'AI Summary': aiSummary,
          'Doctor Name': doctorName,
          'Doctor Notes': doctorNotes,
          'Doctor Verified Summary': doctorVerifiedSummary,
          'Verification Status': verificationStatus,
          'Verification Date': verificationDate,
          'Verification Time': verificationTime,
          'Medicines Prescribed': medicinesPrescribed,
          'Doctor Advice / Tips': doctorAdvice,
          'Receipt Status': receiptStatus,
          'Receipt Generated At': receiptGeneratedAt,
          'Receipt File Path / URL': receiptFilePathOrUrl,
          'Firebase Stored At': firebaseStoredAt,
          'Excel Stored At': excelStoredAt,
        };

        if (medicinesList.length === 0) {
          rows.push({
            ...baseRow,
            'Medicine Name': 'None',
            'Dosage': '-',
            'Frequency': '-',
            'Medicine Instructions': '-',
          });
        } else {
          // Output dedicated row per prescribed medicine so no details are lost
          for (const med of medicinesList) {
            rows.push({
              ...baseRow,
              'Medicine Name': med.name,
              'Dosage': med.dosage,
              'Frequency': med.frequency,
              'Medicine Instructions': med.instructions || med.duration || '-',
            });
          }
        }
      }
    }

    return rows;
  }

  public persist(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.encounters, null, 2), 'utf-8');
      fs.writeFileSync(HOSPITAL_DB_FILE, JSON.stringify(this.hospitalPatients, null, 2), 'utf-8');

      // Generate & update Hospital_Patient_Records.xlsx with all 41 columns
      const rows = this.generateExcelRows();
      const headers = [
        'Patient ID',
        'Patient Name',
        'Age',
        'Gender',
        'Mobile Number',
        'Problem / Complaint / Wellness',
        'Visit ID',
        'Visit Date',
        'Visit Time',
        'Created Date',
        'Created Time',
        'Patient Created Timestamp',
        'Visit Created Timestamp',
        'Symptoms',
        'History of Present Illness',
        'Past Medical History',
        'Current Medicines',
        'Allergies',
        'Red-Flag Symptoms',
        'Reports / Documents',
        'OCR Information',
        'AI Summary',
        'Doctor Name',
        'Doctor Notes',
        'Doctor Verified Summary',
        'Verification Status',
        'Verification Date',
        'Verification Time',
        'Medicines Prescribed',
        'Medicine Name',
        'Dosage',
        'Frequency',
        'Medicine Instructions',
        'Doctor Advice / Tips',
        'Receipt Status',
        'Receipt Generated At',
        'Receipt File Path / URL',
        'Firebase Stored At',
        'Excel Stored At',
      ];
      const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
      worksheet['!cols'] = [
        { wch: 14 },
        { wch: 22 },
        { wch: 8 },
        { wch: 10 },
        { wch: 16 },
        { wch: 30 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
        { wch: 14 },
        { wch: 12 },
        { wch: 26 },
        { wch: 26 },
        { wch: 36 },
        { wch: 36 },
        { wch: 26 },
        { wch: 26 },
        { wch: 24 },
        { wch: 20 },
        { wch: 24 },
        { wch: 30 },
        { wch: 36 },
        { wch: 22 },
        { wch: 30 },
        { wch: 30 },
        { wch: 24 },
        { wch: 16 },
        { wch: 16 },
        { wch: 36 },
        { wch: 22 },
        { wch: 14 },
        { wch: 16 },
        { wch: 26 },
        { wch: 36 },
        { wch: 16 },
        { wch: 22 },
        { wch: 45 },
        { wch: 22 },
        { wch: 22 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Hospital Patient Records');
      XLSX.writeFile(workbook, EXCEL_DB_FILE);
      console.log(`[Clinical DB] Persisted Hospital_Patient_Records.xlsx with ${rows.length} rows and ${headers.length} columns.`);
    } catch (err) {
      console.error('[Clinical DB] Failed to persist database/excel to disk:', err);
    }
  }

  // =========================================================================
  // HOSPITAL PATIENT MANAGEMENT (Central Hierarchy: Patients -> Visits -> Meds)
  // =========================================================================

  public getHospitalPatients(): PatientRecord[] {
    return [...this.hospitalPatients];
  }

  public getHospitalPatientById(patientId: string): PatientRecord | undefined {
    const cleanId = patientId.trim().toUpperCase();
    return this.hospitalPatients.find(
      (p) => p.patientId.toUpperCase() === cleanId || p.patientId.toUpperCase() === `P${cleanId}`
    );
  }

  public searchHospitalPatients(query: string): PatientRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) return [...this.hospitalPatients];

    return this.hospitalPatients.filter((p) => {
      const idMatch = p.patientId.toLowerCase().includes(q);
      const nameMatch = p.fullName.toLowerCase().includes(q);
      const phoneMatch = p.phone.toLowerCase().includes(q);
      const abhaMatch =
        p.abha?.abhaAddress?.toLowerCase().includes(q) ||
        p.abha?.abhaNumber?.toLowerCase().includes(q);
      return idMatch || nameMatch || phoneMatch || abhaMatch;
    });
  }

  public generateNextPatientId(): string {
    let maxNum = 10027;
    for (const p of this.hospitalPatients) {
      const numPart = parseInt(p.patientId.replace(/\D/g, ''), 10);
      if (!isNaN(numPart) && numPart > maxNum) {
        maxNum = numPart;
      }
    }
    return `P${maxNum + 1}`;
  }

  public registerHospitalPatient(data: {
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

    this.hospitalPatients.unshift(newPatient);
    this.persist();

    // Broadcast SSE to all connected clients
    sse.broadcast('HOSPITAL_PATIENTS_UPDATED', {
      patient: newPatient,
      action: 'REGISTERED',
    });

    console.log(`[Clinical DB] Registered Hospital Patient: ${newPatient.fullName} (${newPatient.patientId})`);
    return newPatient;
  }

  public createHospitalVisit(
    patientId: string,
    visitData: Partial<PatientCaseEncounter>
  ): PatientCaseEncounter {
    const patient = this.getHospitalPatientById(patientId);
    if (!patient) {
      throw new Error(`Patient with ID ${patientId} not found`);
    }

    // Deduplication check: if visit already exists by id or visitId, update in-place
    const existingIndex = patient.visits.findIndex(
      (v) =>
        (visitData.id && v.id === visitData.id) ||
        (visitData.visitId && v.visitId === visitData.visitId)
    );
    if (existingIndex >= 0) {
      console.log(
        `[Clinical DB] Visit ${patient.visits[existingIndex].visitId} already exists for ${patient.patientId}. Updating in-place without duplicating.`
      );
      patient.visits[existingIndex] = {
        ...patient.visits[existingIndex],
        ...visitData,
      };
      this.persist();
      return patient.visits[existingIndex];
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
      `OPD-MED-${String(this.encounters.length + 40).padStart(3, '0')}`;
    const visitDate =
      visitData.visitDate || new Date().toISOString().split('T')[0];

    const newVisit: PatientCaseEncounter = {
      id: visitData.id || `enc_${patient.patientId.toLowerCase()}_${visitId.toLowerCase()}_${Date.now()}`,
      patientId: patient.patientId,
      visitId,
      visitDate,
      attendingDoctor: visitData.attendingDoctor || 'Dr. S. K. Verma, MD',
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
      excelStoredAt: visitData.excelStoredAt || new Date().toISOString(),
      firebaseStoredAt: visitData.firebaseStoredAt || undefined,
    };

    // Prepend to patient's visits
    patient.visits.unshift(newVisit);
    patient.totalVisits = patient.visits.length;

    // Also add to encounters list
    const encIndex = this.encounters.findIndex((e) => e.id === newVisit.id);
    if (encIndex >= 0) {
      this.encounters[encIndex] = newVisit;
    } else {
      this.encounters.unshift(newVisit);
    }

    this.persist();

    // Broadcast SSE
    sse.broadcast('VISIT_CREATED', {
      patient: newVisit,
      stats: this.getStats(),
    });
    sse.broadcast('HOSPITAL_PATIENTS_UPDATED', {
      patient,
      action: 'VISIT_CREATED',
    });

    console.log(`[Clinical DB] Created Visit ${visitId} for ${patient.fullName} (${patient.patientId}) - Token: ${opdToken}`);
    return newVisit;
  }

  public updateHospitalDoctorReview(
    patientId: string,
    visitId: string,
    review: DoctorVerification,
    saveToHis = false
  ): PatientCaseEncounter | undefined {
    const patient = this.getHospitalPatientById(patientId);
    if (!patient) return undefined;

    const visit = patient.visits.find(
      (v) => v.visitId === visitId || v.id === visitId
    );
    if (!visit) return undefined;

    visit.doctorReview = { ...visit.doctorReview, ...review };
    if (review.verifiedBy && review.verifiedBy !== 'Attending Doctor' && review.verifiedBy !== 'Not Assigned') {
      visit.attendingDoctor = review.verifiedBy;
    }
    visit.excelStoredAt = new Date().toISOString();

    if (saveToHis) {
      visit.savedToHis = true;
      visit.hisSyncTimestamp = new Date().toISOString();
    }

    // Synchronize prescriptions to visit medicines
    if (review.prescribedMedications && review.prescribedMedications.length > 0) {
      visit.medicines = review.prescribedMedications.map((rx, idx) => ({
        id: `rx_${patient.patientId}_${visit.visitId}_${idx}`,
        visitId: visit.visitId || 'V001',
        patientId: patient.patientId,
        name: rx.name,
        dosage: rx.dosage,
        frequency: rx.frequency,
        duration: rx.duration,
        instructions: rx.instructions,
        datePrescribed: visit.visitDate,
        doctor: review.verifiedBy || 'Dr. S. K. Verma, MD',
      }));

      visit.clinicalSummary.activeMedications = review.prescribedMedications.map(
        (rx) => `${rx.name} ${rx.dosage} - ${rx.frequency} (${rx.duration})`
      );
    }

    // Synchronize doctor notes and impression
    if (review.doctorNotes) {
      visit.clinicalSummary.investigationsSummary = review.doctorNotes;
    }

    // Also update encounters array
    const encIndex = this.encounters.findIndex((e) => e.id === visit.id);
    if (encIndex >= 0) {
      this.encounters[encIndex] = { ...visit };
    }

    this.persist();

    sse.broadcast('DOCTOR_VERIFIED', {
      patientId,
      visitId,
      patient: visit,
      saveToHis,
      stats: this.getStats(),
    });
    sse.broadcast('HOSPITAL_PATIENTS_UPDATED', {
      patient,
      action: 'DOCTOR_VERIFIED',
    });

    console.log(`[Clinical DB] Updated Doctor Review for ${patient.fullName} (${patient.patientId} - ${visit.visitId}) [Verified: ${review.verified}, Status: ${review.status}]`);
    return visit;
  }

  public getPatientMedicineHistory(patientId: string): VisitMedicineItem[] {
    const patient = this.getHospitalPatientById(patientId);
    if (!patient) return [];

    const allMeds: VisitMedicineItem[] = [];
    for (const visit of patient.visits) {
      if (visit.medicines && visit.medicines.length > 0) {
        allMeds.push(...visit.medicines);
      } else if (
        visit.doctorReview?.prescribedMedications &&
        visit.doctorReview.prescribedMedications.length > 0
      ) {
        for (const [idx, rx] of visit.doctorReview.prescribedMedications.entries()) {
          allMeds.push({
            id: `rx_${patient.patientId}_${visit.visitId}_${idx}`,
            visitId: visit.visitId || 'V001',
            patientId: patient.patientId,
            name: rx.name,
            dosage: rx.dosage,
            frequency: rx.frequency,
            duration: rx.duration,
            instructions: rx.instructions,
            datePrescribed: visit.visitDate,
            doctor: visit.attendingDoctor || 'Attending Physician',
          });
        }
      }
    }

    allMeds.sort(
      (a, b) => new Date(b.datePrescribed).getTime() - new Date(a.datePrescribed).getTime()
    );
    return allMeds;
  }

  public resetHospitalDb(): {
    hospitalPatients: PatientRecord[];
    encounters: PatientCaseEncounter[];
  } {
    this.hospitalPatients = JSON.parse(JSON.stringify(SAMPLE_PATIENT_RECORDS));
    this.encounters = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
    this.persist();

    sse.broadcast('QUEUE_RESET', {
      hospitalPatients: this.hospitalPatients,
      encounters: this.encounters,
      stats: this.getStats(),
    });

    console.log('[Clinical DB] Hospital database reset to default records.');
    return {
      hospitalPatients: this.hospitalPatients,
      encounters: this.encounters,
    };
  }

  // =========================================================================
  // ENCOUNTER QUEUE API (For backward compatibility with existing OPD queue)
  // =========================================================================

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
          (e.patientId && e.patientId.toLowerCase().includes(q)) ||
          e.demographics.fullName.toLowerCase().includes(q) ||
          (e.demographics.phone && e.demographics.phone.includes(q)) ||
          (e.demographics.abha?.abhaAddress && e.demographics.abha.abhaAddress.toLowerCase().includes(q)) ||
          (e.demographics.abha?.abhaNumber && e.demographics.abha.abhaNumber.toLowerCase().includes(q)) ||
          e.chiefComplaint.title.toLowerCase().includes(q)
      );
    }

    return result;
  }

  public getEncounterById(id: string): PatientCaseEncounter | undefined {
    // Check in encounters
    const found = this.encounters.find((e) => e.id === id);
    if (found) return found;

    // Check across all hospital patient visits
    for (const p of this.hospitalPatients) {
      const v = p.visits.find((visit) => visit.id === id || visit.visitId === id);
      if (v) return v;
    }

    return undefined;
  }

  public createEncounter(encounter: PatientCaseEncounter): PatientCaseEncounter {
    if (!encounter.opdToken) {
      const nextNum = this.encounters.length + 40;
      encounter.opdToken = `OPD-MED-${String(nextNum).padStart(3, '0')}`;
    }

    if (!encounter.createdAt) {
      encounter.createdAt = new Date().toISOString();
    }

    const encIndex = this.encounters.findIndex((e) => e.id === encounter.id);
    if (encIndex >= 0) {
      this.encounters[encIndex] = { ...this.encounters[encIndex], ...encounter };
    } else {
      this.encounters.unshift(encounter);
    }

    // Also link to hospital patient if exists, or register
    const cleanPhone = encounter.demographics.phone || '';
    let hospPatient = this.hospitalPatients.find(
      (p) =>
        (encounter.patientId && p.patientId.toLowerCase() === encounter.patientId.toLowerCase()) ||
        (cleanPhone && p.phone.replace(/\D/g, '') === cleanPhone.replace(/\D/g, ''))
    );

    if (!hospPatient) {
      hospPatient = this.registerHospitalPatient({
        fullName: encounter.demographics.fullName,
        age: encounter.demographics.age,
        gender: encounter.demographics.gender,
        phone: encounter.demographics.phone,
        address: encounter.demographics.address,
        emergencyContact: encounter.demographics.emergencyContact,
        abhaNumber: encounter.demographics.abha?.abhaNumber,
        abhaAddress: encounter.demographics.abha?.abhaAddress,
      });
    }

    encounter.patientId = hospPatient.patientId;
    if (!encounter.visitId) {
      let maxVisitNum = 0;
      for (const v of hospPatient.visits) {
        if (v.visitId) {
          const n = parseInt(v.visitId.replace(/\D/g, ''), 10);
          if (!isNaN(n) && n > maxVisitNum) {
            maxVisitNum = n;
          }
        }
      }
      encounter.visitId = `V${String(maxVisitNum + 1).padStart(3, '0')}`;
    }

    // Add or update visit in hospital patient
    const vIndex = hospPatient.visits.findIndex(
      (v) => v.id === encounter.id || (encounter.visitId && v.visitId === encounter.visitId)
    );
    if (vIndex >= 0) {
      hospPatient.visits[vIndex] = encounter;
    } else {
      hospPatient.visits.unshift(encounter);
      hospPatient.totalVisits = hospPatient.visits.length;
    }

    this.persist();

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
    const reset = this.resetHospitalDb();
    return reset.encounters;
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

      if (e.doctorReview?.verified) verified++;
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
