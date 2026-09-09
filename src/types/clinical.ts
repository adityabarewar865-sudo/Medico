export type LanguageCode = 'hi' | 'en' | 'bn' | 'ta' | 'te' | 'mr' | 'pa';

export type Gender = 'male' | 'female' | 'other';

export type TriagePriority = 'emergency' | 'urgent' | 'routine';

export interface AbhaDetails {
  abhaNumber: string; // e.g., 91-4521-8890-1234
  abhaAddress: string; // e.g., ramesh.kumar@abdm
  status: 'verified' | 'unlinked' | 'pending';
  kycStatus: 'KYC_VERIFIED' | 'SELF_DECLARED';
  linkedCareContextsCount?: number;
}

export interface PatientDemographics {
  id: string;
  fullName: string;
  age: number;
  gender: Gender;
  phone: string;
  abha: AbhaDetails;
  address?: string;
  preferredLanguage: LanguageCode;
  emergencyContact?: string;
}

export interface ConsentRecord {
  granted: boolean;
  timestamp: string;
  method: 'audio_verbal' | 'biometric_touch';
  languageUsed: LanguageCode;
  audioRecordingUrl?: string;
  abdmLinkConsent: boolean;
}

export type ChiefComplaintId =
  | 'chest_pain'
  | 'fever'
  | 'breathing_difficulty'
  | 'abdominal_pain'
  | 'joint_pain'
  | 'headache'
  | 'vomiting_diarrhea'
  | 'skin_rash'
  | 'general_weakness'
  | 'diabetes_review'
  | 'other';

export interface AdaptiveQuestion {
  id: string;
  text: Record<LanguageCode, string>;
  type: 'select' | 'slider' | 'boolean' | 'multiselect';
  options?: Array<{
    id: string;
    label: Record<LanguageCode, string>;
    isRedFlag?: boolean;
  }>;
  min?: number;
  max?: number;
  step?: number;
  category: 'onset' | 'duration' | 'severity' | 'character' | 'radiation' | 'aggravating' | 'relieving' | 'associated' | 'red_flag';
}

export interface AdaptiveAnswer {
  questionId: string;
  questionText: string;
  answerText: string;
  answerValue?: string | number | boolean | string[];
  category: string;
  isRedFlagIndicator?: boolean;
}

export interface ExtractedMedication {
  id: string;
  name: string;
  dosage: string;
  frequency: string; // e.g. 1-0-1 (OD/BD/TDS)
  duration?: string;
  purpose?: string;
  confidence: number;
  sourceDocName?: string;
}

export interface ExtractedLabValue {
  id: string;
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'abnormal' | 'critical';
  confidence: number;
  date?: string;
}

export interface ExtractedDiagnosis {
  id: string;
  condition: string;
  date?: string;
  icd10Estimate?: string;
  confidence: number;
  status: 'active' | 'resolved' | 'suspected';
}

export interface UploadedMedicalDocument {
  id: string;
  name: string;
  type: 'prescription' | 'lab_report' | 'discharge_summary' | 'imaging';
  uploadTimestamp: string;
  previewUrl: string;
  ocrRawText?: string;
  extractedDiagnoses: ExtractedDiagnosis[];
  extractedMedications: ExtractedMedication[];
  extractedLabValues: ExtractedLabValue[];
  doctorName?: string;
  facilityName?: string;
  documentDate?: string;
  isSamplePreset?: boolean;
}

export interface MedicalTimelineEvent {
  id: string;
  date: string;
  title: string;
  category: 'diagnosis' | 'medication' | 'lab_result' | 'hospitalization' | 'surgery' | 'opd_visit';
  details: string;
  sourceDocName?: string;
  criticalFlag?: boolean;
  confidenceScore: number;
}

export interface RedFlagAlert {
  id: string;
  title: string;
  severity: 'critical' | 'warning';
  description: string;
  clinicalActionNeeded: string;
}

export interface PrescribedRxItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface DoctorVerification {
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: string;
  doctorNotes?: string;
  doctorAdvice?: string; // Doctor's lifestyle/diet/recovery advice and clinical tips
  differentialDiagnosis?: string[];
  finalImpression?: string;
  prescribedMedications?: PrescribedRxItem[];
  recommendedTests?: string[];
  status: 'pending' | 'verified' | 'modified' | 'rejected';
  rejectionReason?: string;
}

export interface PatientCaseEncounter {
  id: string;
  opdToken: string; // e.g. OPD-MED-042
  opdRoom: string; // e.g. Room 4 (Medicine)
  specialty: string;
  createdAt: string;
  demographics: PatientDemographics;
  consent: ConsentRecord;
  chiefComplaint: {
    id: ChiefComplaintId;
    title: string;
    description: string;
    onsetDuration: string;
    voiceInputTranscript?: string;
  };
  adaptiveAnswers?: AdaptiveAnswer[];
  documents: UploadedMedicalDocument[];
  timeline: MedicalTimelineEvent[];
  triagePriority: TriagePriority;
  triageRationale: string;
  redFlags: RedFlagAlert[];
  clinicalSummary: {
    chiefComplaintFormatted: string;
    historyOfPresentIllness: string;
    pastMedicalHistory: string[];
    activeMedications: ExtractedMedication[];
    allergies: Array<{ allergen: string; reaction: string; severity: 'mild' | 'moderate' | 'severe' }>;
    investigationsSummary: string;
    vitals?: {
      bp: string;
      pulse: string;
      spo2: string;
      temp: string;
      rr: string;
    };
  };
  doctorReview: DoctorVerification;
  savedToHis: boolean;
  hisSyncTimestamp?: string;
  abdmCareContextLinked: boolean;
  abdmCareContextRef?: string;
  patientId?: string; // e.g. P10025
  visitId?: string; // e.g. V001
  visitDate?: string; // e.g. 2026-09-07
  attendingDoctor?: string; // e.g. Dr. S. K. Verma, MD
  medicines?: VisitMedicineItem[];
  receiptToken?: string;
  receiptUrl?: string;
  firebaseStoredAt?: string;
  excelStoredAt?: string;
  hospitalName?: string;
}

export interface VisitMedicineItem {
  id: string;
  visitId: string; // e.g. V001
  patientId: string; // e.g. P10025
  name: string;
  dosage: string;
  frequency: string;
  duration?: string;
  instructions?: string;
  datePrescribed: string;
  doctor: string;
}

export interface PatientRecord {
  patientId: string; // e.g. P10025
  fullName: string;
  age: number;
  gender: Gender;
  phone: string;
  abha?: AbhaDetails;
  address?: string;
  emergencyContact?: string;
  registeredAt: string;
  totalVisits: number;
  visits: PatientCaseEncounter[];
}

export type UserRole = 'patient' | 'reception' | 'doctor';

export interface AuthUser {
  role: UserRole;
  name: string;
  username?: string;
  title?: string;
  hospitalName: string;
}

