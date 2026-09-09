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

export type AttendantRelation =
  | 'Father'
  | 'Mother'
  | 'Son'
  | 'Daughter'
  | 'Husband'
  | 'Wife'
  | 'Brother'
  | 'Sister'
  | 'Guardian'
  | 'Other';

export interface AccompanyingPerson {
  name: string;
  phone: string;
  relation: AttendantRelation;
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
  accompanyingPerson?: AccompanyingPerson;
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

export type MedicineCategory = 'allopathic' | 'ayurvedic' | 'homeopathic';

export interface PrescribedRxItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  category?: MedicineCategory;
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

export interface DashavidhaPariksha {
  prakriti: string; // Body constitution (e.g., Vata-Pitta, Pitta-Kapha, Kapha-Vata)
  vikriti: string; // Current imbalance (e.g., Vata vriddhi, Pitta prakopa, Kapha avarana)
  sara: string; // Tissue quality (e.g., Rasa, Rakta, Mamsa, Meda, Asthi, Majja, Shukra, Sattva)
  samhanana: string; // Body compactness (e.g., Compact / Well-built, Moderate, Lean / Weak)
  pramana: string; // Body measurements (e.g., Proportionate, Tall/Lean, Broad/Heavy)
  satmya: string; // Suitability/adaptation (e.g., Mixed foods tolerated, Sensitive digestion, Climate adapted)
  sattva: string; // Mental strength (e.g., Pravara / Strong, Madhyama / Moderate, Avara / Low)
  aharaShakti: string; // Digestive capacity (e.g., Samagni - balanced, Mandagni - sluggish, Tikshnagni - high acidity, Vishamagni - variable)
  vyayamaShakti: string; // Exercise capacity (e.g., High stamina, Moderate tolerance, Easily fatigued)
  vaya: string; // Age assessment (e.g., Balya - childhood, Madhyama - middle age, Vriddha - geriatric)
}

export interface AharaAssessment {
  usualDiet: string; // e.g. Vegetarian, Non-vegetarian, Satvik / Vegan
  mealTiming: string; // e.g. Regular 2-3 meals, Irregular timings, Late night dining
  foodPreferences: string; // e.g. Sweet & Sour, Spicy / Pungent, Salty, Bitter & Astringent
  appetite: string; // e.g. Normal, Variable / Bloating, Hyperacidic / Burning, Poor appetite
  digestiveConcerns: string; // e.g. Gas & Bloating, Acid reflux, Constipation, None
  waterIntake: string; // e.g. 1-2 Litres, 2-3 Litres, Prefers warm fluids, Cold drinks
  dietaryHabits: string; // e.g. Frequent snacking, Intermittent fasting, High tea/coffee
}

export interface ViharaAssessment {
  dailyRoutine: string; // e.g. Early morning riser (Brahma muhurta), Normal routine, Irregular / Night owl
  sleepPattern: string; // e.g. Sound 7-8 hrs, Disturbed / Fragmented, Day sleep (Divasvapna), Insomnia
  physicalActivity: string; // e.g. Regular Yoga / Exercise, Moderate walking, Sedentary / Desk-bound
  exercise: string; // e.g. Daily walking, Asanas & Pranayama, Gym / Strength training, None
  workLifestyle: string; // e.g. High mental stress, Shift duties, Field work, Balanced
  restRelaxation: string; // e.g. Adequate leisure, Meditation / Dhyana, Inadequate rest
  otherHabits: string; // e.g. Prolonged screen exposure, Smoking / Alcohol, None
}

export interface AyushHistory {
  isAyushMode: boolean;
  modeType: 'clinical_opd' | 'wellness';
  dashavidhaPariksha: DashavidhaPariksha;
  dashavidha: DashavidhaPariksha;
  ahara: AharaAssessment;
  vihara: ViharaAssessment;
  wellnessNotes?: string;
  doctorAyushNotes?: string;
}

export interface PatientCaseEncounter {
  id: string;
  opdToken: string; // e.g. OPD-MED-042 or IPD-2026-015
  opdRoom: string; // e.g. Room 4 (Medicine) or Emergency Bed 2
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
  hospitalAddress?: string;
  accompanyingPerson?: AccompanyingPerson;
  knownAllergies?: {
    hasAllergy: 'yes' | 'no' | 'not_sure';
    details?: string;
  };
  // AYUSH & Wellness integration
  consultationType?: 'opd' | 'ipd' | 'wellness';
  systemOfMedicine?: 'allopathy' | 'ayurveda' | 'homeopathy';
  ayushHistory?: AyushHistory;
  // IPD fast-track details
  isIpd?: boolean;
  ipdRegistrationId?: string;
  admissionDate?: string;
  bedWard?: string;
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
  category?: MedicineCategory;
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
  accompanyingPerson?: AccompanyingPerson;
  hospitalAddress?: string;
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
  hospitalAddress?: string;
}

