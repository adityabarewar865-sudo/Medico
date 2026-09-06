import type {
  PatientDemographics,
  ChiefComplaintId,
  AdaptiveAnswer,
  UploadedMedicalDocument,
  TriagePriority,
  RedFlagAlert,
  ExtractedMedication,
} from '../types/clinical';

export interface GeneratedClinicalAssessment {
  triagePriority: TriagePriority;
  triageRationale: string;
  redFlags: RedFlagAlert[];
  formattedChiefComplaint: string;
  historyOfPresentIllness: string;
  pastMedicalHistory: string[];
  activeMedications: ExtractedMedication[];
  allergies: Array<{ allergen: string; reaction: string; severity: 'mild' | 'moderate' | 'severe' }>;
  investigationsSummary: string;
}

export class ClinicalAIService {
  // Evaluates clinical case data and produces structured summary and triage classification
  public generateAssessment(
    demographics: PatientDemographics,
    complaintId: ChiefComplaintId,
    complaintText: string,
    answers: AdaptiveAnswer[],
    documents: UploadedMedicalDocument[]
  ): GeneratedClinicalAssessment {
    const redFlags: RedFlagAlert[] = [];
    let isEmergency = false;
    let isUrgent = false;
    const rationaleParts: string[] = [];

    // Collect all medications and diagnoses from documents
    const allMeds: ExtractedMedication[] = [];
    const allDiagnoses: string[] = [];
    const criticalLabNotes: string[] = [];

    documents.forEach((doc) => {
      doc.extractedMedications.forEach((m) => allMeds.push(m));
      doc.extractedDiagnoses.forEach((d) => {
        if (!allDiagnoses.includes(d.condition)) {
          allDiagnoses.push(d.condition);
        }
      });
      doc.extractedLabValues.forEach((l) => {
        if (l.status === 'critical') {
          criticalLabNotes.push(`CRITICAL: ${l.testName} is ${l.value} ${l.unit} (Ref: ${l.referenceRange})`);
          isEmergency = true;
          redFlags.push({
            id: `rf_lab_${l.id}`,
            title: `Critical Lab Panic Value: ${l.testName}`,
            severity: 'critical',
            description: `${l.testName} observed at ${l.value} ${l.unit} (Reference: ${l.referenceRange}) from ${doc.name}.`,
            clinicalActionNeeded: 'Immediate clinical re-evaluation, repeat stat test, and bedside monitoring.',
          });
        }
      });
    });

    // Check specific adaptive answers for red-flag indicators
    answers.forEach((ans) => {
      if (ans.isRedFlagIndicator) {
        if (ans.questionId.includes('radiation') || ans.questionId.includes('associated') || ans.questionId.includes('character')) {
          if (ans.answerText.includes('Left Arm') || ans.answerText.includes('Cold Sweating') || ans.answerText.includes('Crushing heavy')) {
            isEmergency = true;
            redFlags.push({
              id: `rf_${ans.questionId}`,
              title: 'Suspected Acute Coronary Syndrome (ACS / MI)',
              severity: 'critical',
              description: `Patient reports: ${ans.answerText}. Retrosternal pressure radiating to left arm/jaw with diaphoresis.`,
              clinicalActionNeeded: 'Perform 12-lead ECG within 10 minutes. Establish IV access, monitor vitals, notify cardiology team.',
            });
            rationaleParts.push('High suspicion of Acute Myocardial Infarction / Unstable Angina');
          }
        }

        if (ans.questionId.includes('warning') || ans.questionId.includes('bleed') || ans.questionId.includes('rigid')) {
          isEmergency = true;
          redFlags.push({
            id: `rf_${ans.questionId}`,
            title: 'Critical Hemorrhagic / Peritoneal Warning',
            severity: 'critical',
            description: `Patient reports: ${ans.answerText}. High risk of bleeding diathesis or acute surgical abdomen.`,
            clinicalActionNeeded: 'Immediate bedside surgical/medical evaluation. Order stat blood grouping and cross-match.',
          });
          rationaleParts.push('Active bleeding signs or acute abdominal emergency reported');
        }

        if (ans.questionId.includes('neuro') || ans.questionId.includes('thunderclap')) {
          isEmergency = true;
          redFlags.push({
            id: `rf_${ans.questionId}`,
            title: 'Acute Neurological Red Flag (Stroke / Subarachnoid Hemorrhage)',
            severity: 'critical',
            description: `Patient reports: ${ans.answerText}. Sudden thunderclap onset or focal neurological deficits.`,
            clinicalActionNeeded: 'Stat Non-contrast Head CT, evaluate NIHSS score, check capillary blood glucose.',
          });
          rationaleParts.push('Acute neurological deficit / thunderclap cephalalgia');
        }

        if (ans.questionId.includes('urine') && ans.answerText.includes('no urine')) {
          isEmergency = true;
          redFlags.push({
            id: `rf_anuria`,
            title: 'Severe Dehydration / Acute Kidney Injury (Anuria)',
            severity: 'critical',
            description: 'Absence of urine output for >8 hours with fluid loss.',
            clinicalActionNeeded: 'Urgent IV fluid resuscitation, Foley catheterization, serum electrolytes & creatinine.',
          });
        }
      }
    });

    // Check complaint specific urgency
    if (complaintId === 'chest_pain') {
      if (!isEmergency) isUrgent = true;
      if (!rationaleParts.includes('High suspicion of Acute Myocardial Infarction / Unstable Angina')) {
        rationaleParts.push('Chest pain presentation requires triage ECG exclusion');
      }
    } else if (complaintId === 'fever') {
      const feverDaysAns = answers.find((a) => a.questionId.includes('duration'));
      if (feverDaysAns && (feverDaysAns.answerText.includes('3 to 7') || feverDaysAns.answerText.includes('7 days'))) {
        isUrgent = true;
        rationaleParts.push('Prolonged high-grade fever with suspected vector-borne infection');
      }
    } else if (complaintId === 'breathing_difficulty') {
      const restAns = answers.find((a) => a.questionId.includes('onset'));
      if (restAns && restAns.answerText.includes('rest')) {
        isEmergency = true;
        rationaleParts.push('Dyspnea at rest with potential respiratory distress');
      } else {
        isUrgent = true;
      }
    }

    // Determine final triage
    let triagePriority: TriagePriority = 'routine';
    if (isEmergency) {
      triagePriority = 'emergency';
    } else if (isUrgent) {
      triagePriority = 'urgent';
    } else {
      triagePriority = 'routine';
      rationaleParts.push('Stable clinical parameters; suitable for routine outpatient consultation');
    }

    const triageRationale = rationaleParts.join('. ') + '.';

    // Synthesize structured clinical narrative (HPI)
    const formattedChiefComplaint = `${complaintText || getComplaintDisplayName(complaintId)} (Patient ID: ${demographics.fullName}, ${demographics.age}Y/${demographics.gender.toUpperCase()})`;

    const hpiAnswersSummary = answers
      .map((a) => `${a.questionText}: ${a.answerText}`)
      .join('; ');

    const hpi = `${demographics.age}-year-old ${demographics.gender} presented to the Outpatient Department with primary complaint of ${complaintText || getComplaintDisplayName(complaintId)}. Clinical evaluation details elicited via adaptive voice/touch intake: ${hpiAnswersSummary || 'No specific exacerbating notes provided'}. Review of prior medical documentation identified: ${allDiagnoses.length > 0 ? allDiagnoses.join(', ') : 'No documented prior chronic morbidities'}.`;

    // Past history deduplicated
    const pastMedicalHistory = allDiagnoses.length > 0 ? allDiagnoses : ['None explicitly documented in uploaded records'];

    // Allergies standard checklist
    const allergies = [
      { allergen: 'Penicillin / Amoxicillin', reaction: 'No known allergy', severity: 'mild' as const },
      { allergen: 'NSAIDs (Brufen/Diclofenac)', reaction: 'No known allergy', severity: 'mild' as const },
    ];

    // Investigations summary
    const investigationsSummary = criticalLabNotes.length > 0
      ? criticalLabNotes.join('\n')
      : documents.some((d) => d.extractedLabValues.length > 0)
      ? 'Previous laboratory investigations extracted and reconciled in the medical timeline below.'
      : 'No previous diagnostic reports uploaded. Advise baseline investigations as indicated.';

    return {
      triagePriority,
      triageRationale,
      redFlags,
      formattedChiefComplaint,
      historyOfPresentIllness: hpi,
      pastMedicalHistory,
      activeMedications: allMeds,
      allergies,
      investigationsSummary,
    };
  }
}

function getComplaintDisplayName(id: ChiefComplaintId): string {
  const map: Record<ChiefComplaintId, string> = {
    chest_pain: 'Chest Pain / Angina',
    fever: 'Acute Febrile Illness',
    breathing_difficulty: 'Dyspnea / Shortness of Breath',
    abdominal_pain: 'Acute Abdominal Pain',
    joint_pain: 'Polyarthralgia / Knee Osteoarthritis',
    headache: 'Cephalea / Severe Headache',
    vomiting_diarrhea: 'Acute Gastroenteritis with Dehydration',
    skin_rash: 'Dermatological Lesion / Rash',
    general_weakness: 'General Malaise and Fatigue',
    diabetes_review: 'Type-2 Diabetes & Hypertension Review',
    other: 'Undifferentiated Symptoms',
  };
  return map[id] || 'General Complaint';
}

export const clinicalAI = new ClinicalAIService();
