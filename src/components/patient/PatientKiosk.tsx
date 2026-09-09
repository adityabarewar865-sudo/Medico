import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Camera,
  QrCode,
  FileText,
  AlertTriangle,
  HeartPulse,
  Activity,
  User,
  Phone,
  Shield,
  Sparkles,
  Printer,
  Users,
  Leaf,
  Bed,
  Utensils,
  Info,
} from 'lucide-react';
import type {
  LanguageCode,
  ChiefComplaintId,
  PatientDemographics,
  AdaptiveAnswer,
  UploadedMedicalDocument,
  PatientCaseEncounter,
  AccompanyingPerson,
  AttendantRelation,
  DashavidhaPariksha,
  AharaAssessment,
  ViharaAssessment,
  AyushHistory,
} from '../../types/clinical';
import { TRANSLATIONS, CHIEF_COMPLAINTS_DATA, SUPPORTED_LANGUAGES } from '../../services/i18n';
import { COMPLAINT_QUESTIONS_MAP } from '../../services/adaptiveQuestions';
import { SAMPLE_DOCUMENTS, buildChronologicalTimeline, parseMedicalText } from '../../services/ocrEngine';
import { clinicalAI } from '../../services/clinicalAI';
import { storage } from '../../services/storage';
import { hospitalDb } from '../../services/hospitalDatabase';
import { speech } from '../../services/speech';
import { AbhaCardModal } from './AbhaCardModal';
import { AiChatbot } from '../common/AiChatbot';

interface PatientKioskProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onPatientCompleted?: (patientId: string) => void;
  hospitalName?: string;
  hospitalAddress?: string;
}

export const PatientKiosk: React.FC<PatientKioskProps> = ({
  currentLanguage,
  onLanguageChange,
  onPatientCompleted,
  hospitalName,
  hospitalAddress,
}) => {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

  // Multi-step navigation (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Speech input & output state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechFieldTarget, setSpeechFieldTarget] = useState<string | null>(null);
  const [voiceGuideEnabled, setVoiceGuideEnabled] = useState<boolean>(true);

  // Demographics state
  const [demographics, setDemographics] = useState<PatientDemographics>({
    id: `pat_${Date.now()}`,
    fullName: '',
    age: 45,
    gender: 'male',
    phone: '',
    abha: {
      abhaNumber: '',
      abhaAddress: '',
      status: 'pending',
      kycStatus: 'SELF_DECLARED',
    },
    preferredLanguage: currentLanguage,
  });

  // Accompanying Person / Attendant State (Optional)
  const [hasAccompanyingPerson, setHasAccompanyingPerson] = useState<boolean>(false);
  const [accompanyingPerson, setAccompanyingPerson] = useState<AccompanyingPerson>({
    name: '',
    phone: '',
    relation: 'Other',
  });

  const [showAbhaModal, setShowAbhaModal] = useState<boolean>(false);
  const [detectedPatientRecord, setDetectedPatientRecord] = useState<any>(null);

  // Auto detect & auto-fill returning patient by phone number
  useEffect(() => {
    const cleanPhone = demographics.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      const existing = hospitalDb.findExistingPatient(cleanPhone);
      if (existing) {
        setDetectedPatientRecord(existing);
        // Auto-fill available details while letting patient edit/correct
        setDemographics((prev) => ({
          ...prev,
          fullName: existing.fullName || prev.fullName,
          age: existing.age || prev.age,
          gender: existing.gender || prev.gender,
          address: existing.address || prev.address,
          abha: existing.abha || prev.abha,
        }));
        if (existing.accompanyingPerson) {
          setAccompanyingPerson(existing.accompanyingPerson);
          setHasAccompanyingPerson(true);
        }
      } else {
        setDetectedPatientRecord(null);
      }
    } else if (cleanPhone.length < 7) {
      setDetectedPatientRecord(null);
    }
  }, [demographics.phone]);

  // Consent state
  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [isReadingConsent, setIsReadingConsent] = useState<boolean>(false);

  // Consultation Type & System of Medicine
  const [consultationType, setConsultationType] = useState<'opd' | 'wellness'>('opd');
  const [systemOfMedicine, setSystemOfMedicine] = useState<'allopathy' | 'ayurveda'>('allopathy');

  // AYUSH: Dashavidha Pariksha (10 Parameters)
  const [dashavidha, setDashavidha] = useState<DashavidhaPariksha>({
    prakriti: 'Vata-Pitta (Active, lean, variable appetite, prefers warmth)',
    vikriti: 'Pitta-Vata (Current digestive acidity, restlessness, sleep delay)',
    sara: 'Madhyama Sara (Moderate tissue quality, steady vitality)',
    samhanana: 'Susamhita (Well-compacted, symmetrical bone and muscle build)',
    pramana: 'Pramana-yukta (Proportionate body dimensions and height)',
    satmya: 'Oka-Satmya (Well-adapted to home-cooked wholesome foods)',
    sattva: 'Madhyama Sattva (Moderate mental resilience and calm focus)',
    aharaShakti: 'Samagni (Balanced digestive capacity, steady hunger)',
    vyayamaShakti: 'Madhyama Shakti (Moderate physical stamina, walking/yoga)',
    vaya: 'Madhyama Vaya (Adult, productive age group 20-60 yrs)',
  });

  // AYUSH: Ahara Assessment (Diet & Food)
  const [ahara, setAhara] = useState<AharaAssessment>({
    usualDiet: 'Vegetarian (Wholesome balanced vegetarian meals)',
    mealTiming: 'Regular 2-3 times daily (Breakfast, Lunch, Light Dinner)',
    foodPreferences: 'Sweet & Sour (Madhura-Amla), moderately spiced',
    appetite: 'Normal, consistent appetite',
    digestiveConcerns: 'None / Occasional mild gas after heavy meals',
    waterIntake: '2 to 2.5 litres daily, normal/warm water',
    dietaryHabits: 'Occasional tea/coffee, home-cooked food preferred',
  });

  // AYUSH: Vihara Assessment (Lifestyle & Habits)
  const [vihara, setVihara] = useState<ViharaAssessment>({
    dailyRoutine: 'Early riser (6:00 AM), structured daily routine',
    sleepPattern: 'Sound 7 hours night sleep, restful awakenings',
    physicalActivity: 'Moderate daily walking and active housework',
    exercise: 'Daily 20-30 min brisk walk or yogasanas',
    workLifestyle: 'Desk work with moderate screen exposure',
    restRelaxation: 'Adequate relaxation, leisure reading / prayer',
    otherHabits: 'No smoking, no alcohol, limited caffeine',
  });

  // Emergency IPD Fast-Track State
  const [showIpdModal, setShowIpdModal] = useState<boolean>(false);
  const [ipdForm, setIpdForm] = useState({
    fullName: '',
    age: 42,
    phone: '',
    bedWard: 'Emergency Bed 1 (Acute Resus)',
  });
  const [ipdSuccessEncounter, setIpdSuccessEncounter] = useState<PatientCaseEncounter | null>(null);

  // Chief Complaint state
  const [selectedComplaintId, setSelectedComplaintId] = useState<ChiefComplaintId>('chest_pain');
  const [complaintCustomText, setComplaintCustomText] = useState<string>('');
  const [painSeverity, setPainSeverity] = useState<number>(7);

  // Adaptive Answers state
  const [adaptiveAnswers, setAdaptiveAnswers] = useState<Record<string, string | string[] | number>>({});

  // Allergy question state (Yes, No, Not sure)
  const [allergyResponse, setAllergyResponse] = useState<'yes' | 'no' | 'not_sure'>('no');
  const [allergyDetails, setAllergyDetails] = useState<string>('');

  // Documents & OCR state
  const [uploadedDocs, setUploadedDocs] = useState<UploadedMedicalDocument[]>([]);
  const [isOcrProcessing, setIsOcrProcessing] = useState<boolean>(false);

  // Completed Encounter Result
  const [completedEncounter, setCompletedEncounter] = useState<PatientCaseEncounter | null>(null);

  // Live Clock
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Text-To-Speech helper for accessibility
  const handleSpeak = (text: string) => {
    if (!text) return;
    speech.speak(text, currentLanguage);
  };

  // Read step instructions aloud if Voice Guide is enabled
  useEffect(() => {
    if (voiceGuideEnabled) {
      let promptText = '';
      if (currentStep === 1) promptText = t.selectLanguage;
      else if (currentStep === 2) promptText = `${t.stepDemographicsTitle}. ${t.stepDemographicsSubtitle}`;
      else if (currentStep === 3) promptText = `${t.stepConsentTitle}. ${t.consentText}`;
      else if (currentStep === 4) promptText = `${t.stepComplaintTitle}. ${t.stepComplaintSubtitle}`;
      else if (currentStep === 5) promptText = `${t.stepQuestionsTitle}. ${t.stepQuestionsSubtitle}`;
      else if (currentStep === 6) promptText = `${t.stepDocsTitle}`;
      else if (currentStep === 7) promptText = `${t.stepReviewTitle}`;
      if (promptText) {
        handleSpeak(promptText);
      }
    } else {
      speech.stopSpeaking();
    }
    return () => speech.stopSpeaking();
  }, [currentStep, currentLanguage, voiceGuideEnabled]);

  // Voice dictation handler
  const handleToggleListening = (targetField: string) => {
    if (isListening && speechFieldTarget === targetField) {
      speech.stopListening();
      setIsListening(false);
      setSpeechFieldTarget(null);
      return;
    }

    setSpeechFieldTarget(targetField);
    const success = speech.startListening(
      currentLanguage,
      (transcript, isFinal) => {
        if (targetField === 'fullName') {
          setDemographics((prev) => ({ ...prev, fullName: transcript }));
        } else if (targetField === 'complaint') {
          setComplaintCustomText(transcript);
        } else if (targetField === 'allergy') {
          setAllergyDetails(transcript);
        }
        if (isFinal) {
          setIsListening(false);
          setSpeechFieldTarget(null);
        }
      },
      () => {
        setIsListening(false);
        setSpeechFieldTarget(null);
      },
      () => {
        setIsListening(false);
        setSpeechFieldTarget(null);
      }
    );

    if (success) {
      setIsListening(true);
    }
  };

  // Read consent out loud (Restored TTS)
  const handleReadConsentAloud = () => {
    if (isReadingConsent) {
      speech.stopSpeaking();
      setIsReadingConsent(false);
      return;
    }
    setIsReadingConsent(true);
    speech.speak(
      t.consentText,
      currentLanguage,
      () => setIsReadingConsent(true),
      () => setIsReadingConsent(false),
      () => setIsReadingConsent(false)
    );
  };

  // Load sample document preset
  const handleLoadSampleDoc = (sampleDoc: UploadedMedicalDocument) => {
    setIsOcrProcessing(true);
    setTimeout(() => {
      setUploadedDocs((prev) => {
        const filtered = prev.filter((d) => d.id !== sampleDoc.id);
        return [...filtered, sampleDoc];
      });
      setIsOcrProcessing(false);
    }, 600);
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    const previewUrl = URL.createObjectURL(file);

    setTimeout(() => {
      const parsed = parseMedicalText(
        `Uploaded Patient Record: ${file.name}\nDiagnoses: Under evaluation\nRx: Ongoing medical management\nObservations recorded on ${new Date().toLocaleDateString()}`,
        file.name
      );

      const newDoc: UploadedMedicalDocument = {
        id: `doc_user_${Date.now()}`,
        name: file.name,
        type: 'prescription',
        uploadTimestamp: new Date().toISOString(),
        previewUrl,
        extractedDiagnoses: parsed.diagnoses,
        extractedMedications: parsed.medications,
        extractedLabValues: parsed.labValues,
        documentDate: new Date().toISOString().split('T')[0]};

      setUploadedDocs((prev) => [...prev, newDoc]);
      setIsOcrProcessing(false);
    }, 1000);
  };

  // Submit case and generate triage + OPD token
  const handleFinalSubmit = () => {
    const formattedAnswers: AdaptiveAnswer[] = [];

    formattedAnswers.push({
      questionId: 'pain_severity_scale',
      questionText: 'Pain / Discomfort Intensity (1-10)',
      answerText: `${painSeverity} / 10 (${painSeverity >= 7 ? 'Severe' : painSeverity >= 4 ? 'Moderate' : 'Mild'})`,
      answerValue: painSeverity,
      category: 'severity',
      isRedFlagIndicator: painSeverity >= 8,
    });

    // Compile answered adaptive questions
    const complaintQuestions = COMPLAINT_QUESTIONS_MAP[selectedComplaintId] || [];
    complaintQuestions.forEach((q) => {
      const val = adaptiveAnswers[q.id];
      if (val !== undefined && val !== null && val !== '') {
        let answerText = '';
        let isRedFlag = false;
        if (Array.isArray(val)) {
          const selectedLabels = q.options?.filter((o) => val.includes(o.id));
          answerText = selectedLabels?.map((o) => o.label[currentLanguage] || o.label.en).join(', ') || val.join(', ');
          isRedFlag = selectedLabels?.some((o) => o.isRedFlag) || false;
        } else {
          const matchedOpt = q.options?.find((o) => o.id === val);
          if (matchedOpt) {
            answerText = matchedOpt.label[currentLanguage] || matchedOpt.label.en;
            isRedFlag = matchedOpt.isRedFlag || false;
          } else {
            answerText = String(val);
          }
        }
        formattedAnswers.push({
          questionId: q.id,
          questionText: q.text[currentLanguage] || q.text.en,
          answerText,
          answerValue: val,
          category: q.category,
          isRedFlagIndicator: isRedFlag,
        });
      }
    });

    const timeline = buildChronologicalTimeline(uploadedDocs);

    // AYUSH & Wellness Data
    const isAyushModeActive = systemOfMedicine === 'ayurveda' || consultationType === 'wellness';
    const ayushHistoryData: AyushHistory | undefined = isAyushModeActive
      ? {
          isAyushMode: true,
          modeType: consultationType === 'wellness' ? 'wellness' : 'clinical_opd',
          dashavidhaPariksha: dashavidha,
          dashavidha,
          ahara,
          vihara,
          wellnessNotes: consultationType === 'wellness' ? (complaintCustomText || 'Preventive wellness and holistic lifestyle rejuvenation assessment.') : undefined,
        }
      : undefined;

    const assessment = clinicalAI.generateAssessment(
      demographics,
      selectedComplaintId,
      complaintCustomText,
      formattedAnswers,
      uploadedDocs,
      { hasAllergy: allergyResponse, details: allergyDetails },
      ayushHistoryData
    );

    const tokenNumber = isAyushModeActive
      ? `AYUSH-OPD-${Math.floor(100 + Math.random() * 900)}`
      : `OPD-MED-${Math.floor(100 + Math.random() * 900)}`;
    const roomNumber = isAyushModeActive
      ? 'Room 7 (Ayurvedic OPD & Panchakarma)'
      : assessment.triagePriority === 'emergency'
      ? 'Room 1 (Emergency Resus / Med)'
      : 'Room 4 (General Medicine)';

    const existingPatient = detectedPatientRecord || hospitalDb.findExistingPatient(demographics.phone);
    const assignedPatientId = existingPatient?.patientId || hospitalDb.generateNextPatientId();
    const assignedVisitId = existingPatient ? `V${String(existingPatient.visits.length + 1).padStart(3, '0')}` : 'V001';

    const finalHospitalName = hospitalName || localStorage.getItem('medico_hospital_name') || 'District Hospital';
    const finalHospitalAddress = hospitalAddress || localStorage.getItem('medico_hospital_address') || 'Hospital Complex, Main Road';

    const finalAccompanying = hasAccompanyingPerson && accompanyingPerson.name.trim() ? accompanyingPerson : undefined;

    const newEncounter: PatientCaseEncounter = {
      id: `enc_${Date.now()}`,
      patientId: assignedPatientId,
      visitId: assignedVisitId,
      visitDate: new Date().toISOString().split('T')[0],
      opdToken: tokenNumber,
      opdRoom: roomNumber,
      specialty: isAyushModeActive ? 'Ayurvedic Medicine / Kayachikitsa' : 'Internal Medicine',
      hospitalName: finalHospitalName,
      hospitalAddress: finalHospitalAddress,
      accompanyingPerson: finalAccompanying,
      knownAllergies: {
        hasAllergy: allergyResponse,
        details: allergyDetails,
      },
      consultationType,
      systemOfMedicine,
      ayushHistory: ayushHistoryData,
      createdAt: new Date().toISOString(),
      demographics: {
        ...demographics,
        accompanyingPerson: finalAccompanying,
        preferredLanguage: currentLanguage,
      },
      consent: {
        granted: true,
        timestamp: new Date().toISOString(),
        method: 'biometric_touch',
        languageUsed: currentLanguage,
        abdmLinkConsent: true,
      },
      chiefComplaint: {
        id: selectedComplaintId,
        title: CHIEF_COMPLAINTS_DATA.find((c) => c.id === selectedComplaintId)?.titles[currentLanguage] || 'Chief Complaint',
        description: complaintCustomText || 'Patient reported acute symptoms',
        onsetDuration: `${painSeverity}/10 severity`,
        voiceInputTranscript: complaintCustomText,
      },
      adaptiveAnswers: formattedAnswers,
      documents: uploadedDocs,
      timeline,
      triagePriority: assessment.triagePriority,
      triageRationale: assessment.triageRationale,
      redFlags: assessment.redFlags,
      clinicalSummary: {
        chiefComplaintFormatted: assessment.formattedChiefComplaint,
        historyOfPresentIllness: assessment.historyOfPresentIllness,
        pastMedicalHistory: assessment.pastMedicalHistory,
        activeMedications: assessment.activeMedications,
        allergies: assessment.allergies,
        investigationsSummary: assessment.investigationsSummary,
        vitals: {
          bp: '120/80',
          pulse: '76',
          spo2: '98',
          temp: '98.6',
          rr: '18',
        },
      },
      doctorReview: {
        verified: false,
        status: 'pending',
      },
      savedToHis: false,
      abdmCareContextLinked: true,
      abdmCareContextRef: `CARE-CTX-${assignedPatientId}-${tokenNumber}`,
    };

    storage.savePatient(newEncounter);
    setCompletedEncounter(newEncounter);
    setCurrentStep(7);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });


    if (onPatientCompleted) {
      onPatientCompleted(newEncounter.id);
    }
  };

  const handleEmergencyIpdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipdForm.fullName.trim() || !ipdForm.phone.trim()) {
      alert('Please provide patient name and mobile number for emergency IPD registration.');
      return;
    }

    const created = hospitalDb.registerIpdPatient({
      fullName: ipdForm.fullName.trim(),
      age: Number(ipdForm.age) || 40,
      phone: ipdForm.phone.trim(),
      bedWard: ipdForm.bedWard,
    });

    setIpdSuccessEncounter(created);
    setShowIpdModal(false);
    confetti({ particleCount: 60, spread: 60 });
  };

  const handleResetForNewPatient = () => {
    setCurrentStep(1);
    setConsultationType('opd');
    setSystemOfMedicine('allopathy');
    setDemographics({
      id: `pat_${Date.now()}`,
      fullName: '',
      age: 45,
      gender: 'male',
      phone: '',
      abha: {
        abhaNumber: '',
        abhaAddress: '',
        status: 'pending',
        kycStatus: 'SELF_DECLARED'},
      preferredLanguage: currentLanguage});
    setConsentGranted(false);
    setSelectedComplaintId('chest_pain');
    setComplaintCustomText('');
    
    setUploadedDocs([]);
    setCompletedEncounter(null);
    setIpdSuccessEncounter(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Live Date, Day and Time + Voice Guide Audio Toggle + Fast-Track IPD Registration */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 no-print">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextVal = !voiceGuideEnabled;
              setVoiceGuideEnabled(nextVal);
              if (nextVal) {
                handleSpeak('आवाज सहायता चालू है / Voice guide is enabled');
              } else {
                speech.stopSpeaking();
              }
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 border shadow-sm transition-all cursor-pointer ${
              voiceGuideEnabled
                ? 'bg-teal-600 text-white border-teal-700'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Toggle Read Aloud Audio"
          >
            <Volume2 className={`w-4 h-4 ${voiceGuideEnabled ? 'animate-pulse' : ''}`} />
            <span>{voiceGuideEnabled ? t.audioOn : t.audioOff}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowIpdModal(true)}
            className="px-3.5 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white border border-rose-700 shadow-sm transition-all cursor-pointer"
            title="Emergency IPD Fast-Track (Only Name, Age, Mobile Number required)"
          >
            <Bed className="w-4 h-4" />
            <span>🚨 {t.ipdFastTrack || 'Emergency IPD Registration'}</span>
          </button>
        </div>

        <div className="text-right text-xs text-slate-500 font-semibold bg-white border border-slate-200/60 shadow-sm rounded-xl py-1.5 px-3">
          <div className="text-sm font-black text-slate-800 tracking-tight">
            {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div>
            {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div>
            {currentTime.toLocaleDateString('en-US', { day: '2-digit', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Step Progress Bar (1 to 7) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-teal-800">
            {t.kioskMode} • Step {currentStep} of 7
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {currentStep === 1 && 'Language & Accessibility'}
            {currentStep === 2 && 'Patient Demographics & Attendant'}
            {currentStep === 3 && 'Informed Consent'}
            {currentStep === 4 && 'Chief Complaint'}
            {currentStep === 5 && 'Adaptive Questions & Allergies'}
            {currentStep === 6 && 'Document Scanner & OCR'}
            {currentStep === 7 && 'OPD Queue Token'}
          </span>
        </div>
        <div className="h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden flex shadow-inner">
          {[1, 2, 3, 4, 5, 6, 7].map((stepNum) => (
            <div
              key={stepNum}
              className={`flex-1 transition-all duration-300 border-r border-white/60 ${
                stepNum <= currentStep ? 'bg-teal-600' : 'bg-transparent'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Kiosk Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/90 overflow-hidden">
        {/* STEP 1: Language Selection */}
        {currentStep === 1 && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-teal-50 text-teal-700 mb-2 border border-teal-100">
                <span className="text-3xl">🗣️</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                {t.selectLanguage}
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                कृपया अपनी सहज भाषा चुनें / Choose language for voice &amp; touch
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = currentLanguage === lang.code;
                return (
                  <button
                    key={lang.code}
                    onClick={() => {
                      onLanguageChange(lang.code);
                    }}
                    className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between h-32 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/70 shadow-sm ring-2 ring-teal-500/20'
                        : 'border-slate-200 hover:border-teal-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        {lang.name}
                      </span>
                      {isSelected && (
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                      )}
                    </div>
                    <div>
                      <div className="text-xl sm:text-2xl font-black text-slate-900">
                        {lang.nativeName}
                      </div>
                      <div className="text-[11px] text-teal-700 font-semibold">
                        आवाज और स्क्रीन
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-6 flex justify-end">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white text-base sm:text-lg font-bold rounded-2xl shadow-sm shadow-teal-600/30 flex items-center gap-3 transition-all transform active:scale-95"
              >
                <span>{t.next}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Patient Demographics & ABHA */}
        {currentStep === 2 && (
          <div className="p-6 sm:p-10 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                <User className="w-8 h-8 text-teal-600" />
                {t.stepDemographicsTitle}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-1">
                {t.stepDemographicsSubtitle}
              </p>
            </div>

            {/* Quick Demo Pre-fill Buttons */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                ⚡ Quick Fill Demo Patients:
              </span>
              <button
                type="button"
                onClick={() => {
                  setDemographics({
                    id: 'pat_rahul_sharma',
                    fullName: 'Rahul Sharma',
                    age: 25,
                    gender: 'male',
                    phone: '9876500001',
                    abha: {
                      abhaNumber: '91-8899-4455-1025',
                      abhaAddress: 'rahul.sharma25@abdm',
                      status: 'verified',
                      kycStatus: 'KYC_VERIFIED'},
                    preferredLanguage: currentLanguage});
                  setSelectedComplaintId('headache');
                }}
                className="px-3 py-1 bg-white hover:bg-teal-50 text-teal-800 border border-teal-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1"
              >
                <span>Rahul Sharma (25M - P10025 Returning Patient)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setDemographics({
                    id: `pat_ramesh_${Date.now()}`,
                    fullName: 'Ramesh Kumar',
                    age: 58,
                    gender: 'male',
                    phone: '9876543210',
                    abha: {
                      abhaNumber: '91-4521-8890-1234',
                      abhaAddress: 'ramesh.kumar@abdm',
                      status: 'verified',
                      kycStatus: 'KYC_VERIFIED'},
                    preferredLanguage: currentLanguage})
                }
                className="px-3 py-1 bg-white hover:bg-teal-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs"
              >
                Ramesh Kumar (58M - Chest Pain)
              </button>
              <button
                type="button"
                onClick={() =>
                  setDemographics({
                    id: `pat_sunita_${Date.now()}`,
                    fullName: 'Sunita Devi',
                    age: 42,
                    gender: 'female',
                    phone: '9845123670',
                    abha: {
                      abhaNumber: '91-3312-7740-9981',
                      abhaAddress: 'sunita.devi42@abdm',
                      status: 'verified',
                      kycStatus: 'KYC_VERIFIED'},
                    preferredLanguage: currentLanguage})
                }
                className="px-3 py-1 bg-white hover:bg-teal-50 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs"
              >
                Sunita Devi (42F - Dengue/Fever)
              </button>
            </div>

            {/* Existing Patient Detected Banner */}
            {detectedPatientRecord && (
              <div className="p-3.5 bg-emerald-50 border-2 border-emerald-300 rounded-2xl flex items-center gap-3 text-xs text-emerald-950 font-bold shadow-2xs animate-fade-in">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-extrabold text-emerald-900">Existing Patient Found: </span>
                  <span>
                    {detectedPatientRecord.fullName} (Patient ID: <strong className="font-mono bg-emerald-100 px-1.5 py-0.5 rounded">{detectedPatientRecord.patientId}</strong>) • {detectedPatientRecord.visits.length} past visit(s) on hospital record.
                  </span>
                  <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
                    No need to register again! Today&apos;s case-taking will be attached as Visit {detectedPatientRecord.visits.length + 1} under {detectedPatientRecord.patientId}.
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Full Name with Voice Dictation */}
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>{t.fullName}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleListening('fullName')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                      isListening && speechFieldTarget === 'fullName'
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
                    }`}
                  >
                    {isListening && speechFieldTarget === 'fullName' ? (
                      <>
                        <MicOff className="w-3.5 h-3.5" />
                        <span>{t.listening}</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-3.5 h-3.5" />
                        <span>{t.speakAnswer}</span>
                      </>
                    )}
                  </button>
                </label>
                <input
                  type="text"
                  value={demographics.fullName}
                  onChange={(e) =>
                    setDemographics({ ...demographics, fullName: e.target.value })
                  }
                  placeholder={t.fullNamePlaceholder}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border-2 border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-teal-600 focus:bg-white text-base"
                />
              </div>

              {/* Age */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800">
                  {t.age}
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={demographics.age}
                  onChange={(e) =>
                    setDemographics({
                      ...demographics,
                      age: parseInt(e.target.value) || 0})
                  }
                  placeholder={t.agePlaceholder}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border-2 border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-teal-600 focus:bg-white text-base"
                />
              </div>

              {/* Gender */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800">
                  {t.gender}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['male', 'female', 'other'] as const).map((gen) => (
                    <button
                      key={gen}
                      type="button"
                      onClick={() =>
                        setDemographics({ ...demographics, gender: gen })
                      }
                      className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all ${
                        demographics.gender === gen
                          ? 'border-teal-600 bg-teal-50 text-teal-900 shadow-2xs'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {gen === 'male' && t.male}
                      {gen === 'female' && t.female}
                      {gen === 'other' && t.other}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Phone */}
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>{t.phone}</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={demographics.phone}
                  onChange={(e) =>
                    setDemographics({ ...demographics, phone: e.target.value })
                  }
                  placeholder={t.phonePlaceholder}
                  className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border-2 border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-teal-600 focus:bg-white text-base"
                />
              </div>

              {/* ABHA ID Section */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <span>{t.abhaNumber}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAbhaModal(true)}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 underline flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3 text-blue-600" />
                    {t.abhaVerifyBtn}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={demographics.abha.abhaAddress || demographics.abha.abhaNumber}
                    onChange={(e) =>
                      setDemographics({
                        ...demographics,
                        abha: {
                          ...demographics.abha,
                          abhaAddress: e.target.value,
                          abhaNumber: e.target.value}})
                    }
                    placeholder={t.abhaPlaceholder}
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50/70 border-2 border-slate-200 text-slate-900 font-mono text-sm font-bold focus:outline-none focus:border-blue-600 focus:bg-white"
                  />
                  {demographics.abha.status === 'verified' && (
                    <span className="absolute right-3 top-3.5 text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Verified
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 font-medium">{t.abhaHelper}</p>
              </div>
            </div>

            {/* Person Accompanying Patient Section (Optional) */}
            <div className="p-5 rounded-2xl bg-slate-50 border-2 border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-700" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      {t.attendantSectionTitle || 'Person Accompanying Patient (Optional)'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {t.attendantSectionSubtitle || 'If someone came with the patient, please enter their details'}
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200 select-none">
                  <input
                    type="checkbox"
                    checked={hasAccompanyingPerson}
                    onChange={(e) => setHasAccompanyingPerson(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>Attendant Present</span>
                </label>
              </div>

              {hasAccompanyingPerson && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200 animate-fade-in">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.attendantName || 'Accompanying Person Name'}
                    </label>
                    <input
                      type="text"
                      value={accompanyingPerson.name}
                      onChange={(e) =>
                        setAccompanyingPerson({ ...accompanyingPerson, name: e.target.value })
                      }
                      placeholder="e.g., Suresh Kumar"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.attendantPhone || 'Accompanying Person Mobile Number'}
                    </label>
                    <input
                      type="tel"
                      maxLength={10}
                      value={accompanyingPerson.phone}
                      onChange={(e) =>
                        setAccompanyingPerson({ ...accompanyingPerson, phone: e.target.value })
                      }
                      placeholder="10-digit mobile number"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">
                      {t.attendantRelation || 'Relation with Patient'}
                    </label>
                    <select
                      value={accompanyingPerson.relation}
                      onChange={(e) =>
                        setAccompanyingPerson({
                          ...accompanyingPerson,
                          relation: e.target.value as AttendantRelation,
                        })
                      }
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="Father">{t.relationFather || 'Father'}</option>
                      <option value="Mother">{t.relationMother || 'Mother'}</option>
                      <option value="Son">{t.relationSon || 'Son'}</option>
                      <option value="Daughter">{t.relationDaughter || 'Daughter'}</option>
                      <option value="Husband">{t.relationHusband || 'Husband'}</option>
                      <option value="Wife">{t.relationWife || 'Wife'}</option>
                      <option value="Brother">{t.relationBrother || 'Brother'}</option>
                      <option value="Sister">{t.relationSister || 'Sister'}</option>
                      <option value="Guardian">{t.relationGuardian || 'Guardian'}</option>
                      <option value="Other">{t.relationOther || 'Other'}</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="pt-6 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                onClick={() => {
                  if (!demographics.fullName.trim()) {
                    setDemographics((prev) => ({ ...prev, fullName: 'Ramesh Kumar' }));
                  }
                  setCurrentStep(3);
                }}
                className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-sm shadow-teal-600/30 flex items-center gap-3"
              >
                <span>{t.next}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Vernacular Informed Consent */}
        {currentStep === 3 && (
          <div className="p-6 sm:p-10 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                <Shield className="w-8 h-8 text-blue-700" />
                {t.stepConsentTitle}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-1">
                {t.stepConsentSubtitle}
              </p>
            </div>

            {/* Consent Box - Light Airy Design */}
            <div className="p-6 rounded-3xl bg-blue-50/60 border-2 border-blue-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Digital Health Consent Notice (ABDM Interoperability)
                </span>
                <button
                  type="button"
                  onClick={handleReadConsentAloud}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all ${
                    isReadingConsent
                      ? 'bg-amber-500 text-white animate-pulse'
                      : 'bg-white text-blue-800 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{t.readConsentAudio}</span>
                </button>
              </div>

              <p className="text-base sm:text-lg font-semibold text-slate-800 leading-relaxed">
                "{t.consentText}"
              </p>

              <div className="pt-2 border-t border-blue-200/60 flex items-center gap-3">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={consentGranted}
                    onChange={(e) => setConsentGranted(e.target.checked)}
                    className="w-6 h-6 rounded-lg text-teal-600 border-slate-300 focus:ring-teal-500 cursor-pointer"
                  />
                  <span className="text-base sm:text-lg font-black text-blue-950">
                    {t.consentCheckbox}
                  </span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                onClick={() => {
                  setConsentGranted(true);
                  setCurrentStep(4);
                }}
                className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-sm shadow-teal-600/30 flex items-center gap-3"
              >
                <span>{t.next}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Chief Complaint / Wellness & System Selection */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-10 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                <HeartPulse className="w-8 h-8 text-rose-600" />
                {consultationType === 'wellness' ? 'Preventive Health & Wellness Intake' : t.stepComplaintTitle}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-1">
                {consultationType === 'wellness'
                  ? 'Select your Ayurvedic wellness focus or preventive health goals'
                  : t.stepComplaintSubtitle}
              </p>
            </div>

            {/* Consultation Type & System of Medicine Selection Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
              {/* 1. Consultation Focus */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  {t.consultationType || 'Consultation Focus'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConsultationType('opd')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      consultationType === 'opd'
                        ? 'border-rose-600 bg-rose-50 text-rose-950 font-black shadow-2xs ring-2 ring-rose-400/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🩺 {t.clinicalProblemOpd || 'Problem (OPD)'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConsultationType('wellness');
                      setSystemOfMedicine('ayurveda');
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      consultationType === 'wellness'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-2 ring-emerald-400/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🌱 {t.wellnessCheckup || 'Wellness'}</span>
                  </button>
                </div>
              </div>

              {/* 2. System of Medicine */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-600">
                  {t.systemOfMedicine || 'System of Medicine'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSystemOfMedicine('allopathy')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      systemOfMedicine === 'allopathy' && consultationType !== 'wellness'
                        ? 'border-teal-600 bg-teal-50 text-teal-950 font-black shadow-2xs ring-2 ring-teal-400/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏥 {t.allopathyOpd || 'Allopathy OPD'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSystemOfMedicine('ayurveda')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      systemOfMedicine === 'ayurveda'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black shadow-2xs ring-2 ring-emerald-400/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🍃 {t.ayurvedicOpd || 'Ayurveda OPD'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* AYUSH History Mode Active Notice Banner */}
            {(systemOfMedicine === 'ayurveda' || consultationType === 'wellness') && (
              <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-300 flex items-start gap-3 shadow-2xs animate-fade-in">
                <div className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 mt-0.5">
                  <Leaf className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-emerald-950">
                      🍃 AYUSH HISTORY MODE ACTIVATED — Ayurvedic OPD &amp; Wellness
                    </h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                      SIH Specification
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                    In Step 5, you will undergo an extended clinical intake capturing <strong>Dashavidha Pariksha</strong> (Prakriti, Vikriti, Sara, Samhanana, Pramana, Satmya, Sattva, Ahara Shakti, Vyayama Shakti, Vaya) and <strong>Ahara-Vihara assessment</strong> (Diet &amp; Lifestyle).
                  </p>
                </div>
              </div>
            )}

            {/* Symptom Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {CHIEF_COMPLAINTS_DATA.map((item) => {
                const isSelected = selectedComplaintId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedComplaintId(item.id);
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex flex-col justify-between h-36 ${
                      isSelected
                        ? 'border-rose-600 bg-rose-50/70 shadow-2xs ring-2 ring-rose-500/20'
                        : 'border-slate-200 hover:border-rose-300 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-3xl">{item.icon}</span>
                      {isSelected && (
                        <span className="p-1 rounded-full bg-rose-600 text-white">
                          <CheckCircle className="w-4 h-4" />
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-black text-sm sm:text-base text-slate-900 line-clamp-2">
                        {item.titles[currentLanguage] || item.titles.en}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-medium">
                        {item.description[currentLanguage] || item.description.en}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Voice Input or Written Details */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs sm:text-sm font-bold text-slate-800">
                  {t.typeComplaintDetails}
                </label>
                <button
                  type="button"
                  onClick={() => handleToggleListening('complaint')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs ${
                    isListening && speechFieldTarget === 'complaint'
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'bg-teal-600 text-white hover:bg-teal-700'
                  }`}
                >
                  {isListening && speechFieldTarget === 'complaint' ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span>{t.listening}</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>{t.speakAnswer}</span>
                    </>
                  )}
                </button>
              </div>
              <textarea
                rows={2}
                value={complaintCustomText}
                onChange={(e) => setComplaintCustomText(e.target.value)}
                placeholder={t.complaintPlaceholder}
                className="w-full p-3 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Pain / Discomfort Severity Slider */}
            <div className="p-5 mt-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-black text-slate-900 text-sm sm:text-base">
                  {t.painSeverityLabel}
                </label>
                <span
                  className={`text-sm sm:text-base font-black px-3 py-1 rounded-full ${
                    painSeverity >= 7
                      ? 'bg-rose-500 text-white'
                      : painSeverity >= 4
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {painSeverity} / 10 •{' '}
                  {painSeverity >= 7 ? t.severe : painSeverity >= 4 ? t.moderate : t.mild}
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={painSeverity}
                onChange={(e) => setPainSeverity(parseInt(e.target.value))}
                className="w-full h-3 bg-amber-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
              <div className="flex justify-between text-[11px] font-bold text-slate-500 px-1">
                <span>1 ({t.mild})</span>
                <span>5 ({t.moderate})</span>
                <span>10 ({t.severe})</span>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                onClick={() => setCurrentStep(5)}
                className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-sm shadow-teal-600/30 flex items-center gap-3"
              >
                <span>{t.next}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Adaptive Follow-up Questions OR AYUSH History Mode */}
        {currentStep === 5 && (
          <div className="p-6 sm:p-10 space-y-6">
            {(systemOfMedicine === 'ayurveda' || consultationType === 'wellness') ? (
              /* AYUSH HISTORY MODE: Extended Ayurvedic Patient History */
              <div className="space-y-8 animate-fade-in">
                {/* Mode Header */}
                <div className="p-5 rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white shadow-md">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl backdrop-blur">
                        🍃
                      </div>
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/40 text-emerald-100 border border-emerald-300/30">
                          SIH AYUSH OPD Mandate
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
                          AYUSH HISTORY MODE — Extended Ayurvedic Case-Taking
                        </h2>
                        <p className="text-xs text-emerald-100 font-medium">
                          Comprehensive assessment of Dashavidha Pariksha and Ahara-Vihara lifestyle patterns
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSpeak(
                          'आयुष इतिहास मोड: दशविध परीक्षा और आहार-विहार मूल्यांकन / AYUSH history mode extended interview'
                        )
                      }
                      className="p-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white backdrop-blur border border-white/20 transition-all cursor-pointer"
                      title="Read section aloud"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 1. DASHAVIDHA PARIKSHA (10 Classical Ayurvedic Parameters) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <div>
                      <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>DASHAVIDHA PARIKSHA</span>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          दशविध परीक्षा
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        10 Classical diagnostic parameters with patient-friendly clinical choices
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 1. Prakriti */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>1. Prakriti</span>
                          <span className="text-slate-500 font-bold">— Body constitution</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Prakriti — Body constitution')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.prakriti}
                        onChange={(e) => setDashavidha({ ...dashavidha, prakriti: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Vata-Pitta (Lean build, active mind, variable digestion, sensitive to cold)">Vata-Pitta (Lean build, active, sensitive to cold)</option>
                        <option value="Pitta-Kapha (Moderate build, sharp intellect, strong appetite, warm body)">Pitta-Kapha (Moderate build, sharp intellect, strong appetite)</option>
                        <option value="Kapha-Vata (Solid endurance, calm, slow metabolism, light frame)">Kapha-Vata (Solid endurance, calm, slow metabolism)</option>
                        <option value="Vataja (Light frame, dry skin, quick movement, irregular sleep)">Vataja (Light frame, dry skin, irregular sleep)</option>
                        <option value="Pittaja (Warm skin, high metabolism, intolerant to heat, acid prone)">Pittaja (Warm skin, high metabolism, intolerant to heat)</option>
                        <option value="Kaphaja (Heavy build, smooth skin, stable mind, slow digestion)">Kaphaja (Heavy build, smooth skin, stable mind)</option>
                        <option value="Sama Prakriti (Tridoshic equilibrium, optimal balance)">Sama Prakriti (Tridoshic equilibrium, optimal balance)</option>
                      </select>
                    </div>

                    {/* 2. Vikriti */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>2. Vikriti</span>
                          <span className="text-slate-500 font-bold">— Current imbalance</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Vikriti — Current imbalance')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.vikriti}
                        onChange={(e) => setDashavidha({ ...dashavidha, vikriti: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Vata Imbalance (Joint aches, dryness, constipation, anxiety/sleep disturbance)">Vata Imbalance (Joint aches, dryness, constipation, sleep disturbance)</option>
                        <option value="Pitta Imbalance (Hyperacidity, burning sensations, anger/irritation, skin flare-up)">Pitta Imbalance (Hyperacidity, burning sensations, skin flare-up)</option>
                        <option value="Kapha Imbalance (Sluggishness, chest congestion, weight gain, excessive sleep)">Kapha Imbalance (Sluggishness, congestion, weight gain, lethargy)</option>
                        <option value="Pitta-Vata Vriddhi (Acidity with restless sleep and fatigue)">Pitta-Vata Vriddhi (Acidity with restless sleep and fatigue)</option>
                        <option value="Vata-Kapha Vriddhi (Stiff joints with heavy body sensation)">Vata-Kapha Vriddhi (Stiff joints with heavy body sensation)</option>
                        <option value="Tridosha Imbalance (Generalized systemic imbalance)">Tridosha Imbalance (Generalized systemic imbalance)</option>
                      </select>
                    </div>

                    {/* 3. Sara */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>3. Sara</span>
                          <span className="text-slate-500 font-bold">— Tissue quality</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Sara — Tissue quality')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.sara}
                        onChange={(e) => setDashavidha({ ...dashavidha, sara: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Pravara Sara (Superior tissue vigor, excellent immunity, strong bones/muscles)">Pravara Sara (Superior tissue vigor, strong immunity &amp; bones)</option>
                        <option value="Madhyama Sara (Moderate resilience, standard endurance, healthy tissues)">Madhyama Sara (Moderate resilience, standard endurance)</option>
                        <option value="Avara Sara (Delicate tissues, easily fatigued, low immune reserve)">Avara Sara (Delicate tissues, easily fatigued, low immunity)</option>
                        <option value="Rasa-Rakta Sara (Radiant complexion, good blood circulation)">Rasa-Rakta Sara (Radiant complexion, good blood circulation)</option>
                        <option value="Asthi-Majja Sara (Dense bones, strong joints and dental health)">Asthi-Majja Sara (Dense bones, strong joints &amp; teeth)</option>
                      </select>
                    </div>

                    {/* 4. Samhanana */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>4. Samhanana</span>
                          <span className="text-slate-500 font-bold">— Body compactness</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Samhanana — Body compactness')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.samhanana}
                        onChange={(e) => setDashavidha({ ...dashavidha, samhanana: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Susamhita (Well-compacted, firm musculature, stable joints)">Susamhita (Well-compacted, firm musculature, stable joints)</option>
                        <option value="Madhyama (Medium body compactness and frame density)">Madhyama (Medium body compactness and frame density)</option>
                        <option value="Heena / Asamhita (Loose joints, delicate bone frame, flaccid tone)">Heena / Asamhita (Loose joints, delicate bone frame)</option>
                      </select>
                    </div>

                    {/* 5. Pramana */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>5. Pramana</span>
                          <span className="text-slate-500 font-bold">— Body measurements</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Pramana — Body measurements')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.pramana}
                        onChange={(e) => setDashavidha({ ...dashavidha, pramana: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Pramana-yukta (Proportionate height-to-weight and limb ratio)">Pramana-yukta (Proportionate height, weight &amp; limbs)</option>
                        <option value="Heena Pramana (Significantly underweight, lean, below standard height)">Heena Pramana (Underweight / lean frame)</option>
                        <option value="Ati Pramana (Heavy frame, overweight / elevated BMI)">Ati Pramana (Heavy frame / overweight / elevated BMI)</option>
                      </select>
                    </div>

                    {/* 6. Satmya */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>6. Satmya</span>
                          <span className="text-slate-500 font-bold">— Suitability/adaptation</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Satmya — Suitability/adaptation')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.satmya}
                        onChange={(e) => setDashavidha({ ...dashavidha, satmya: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Sarva-Rasa Satmya (Tolerates all 6 tastes and varying diets comfortably)">Sarva-Rasa Satmya (Tolerates all 6 tastes comfortably)</option>
                        <option value="Madhyama Satmya (Tolerates common regional foods, minor sensitivities)">Madhyama Satmya (Tolerates common foods with minor sensitivity)</option>
                        <option value="Eka-Rasa / Asatmya (Sensitive system, easily upset by diet or climate change)">Eka-Rasa / Asatmya (Sensitive, easily upset by diet changes)</option>
                      </select>
                    </div>

                    {/* 7. Sattva */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>7. Sattva</span>
                          <span className="text-slate-500 font-bold">— Mental strength</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Sattva — Mental strength')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.sattva}
                        onChange={(e) => setDashavidha({ ...dashavidha, sattva: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Pravara Sattva (High emotional resilience, calm demeanor, high patience)">Pravara Sattva (High emotional resilience &amp; patience)</option>
                        <option value="Madhyama Sattva (Moderate tolerance, recovers quickly with supportive care)">Madhyama Sattva (Moderate tolerance, recovers with support)</option>
                        <option value="Avara Sattva (Low stress tolerance, prone to anxiety, apprehension)">Avara Sattva (Low stress tolerance, prone to anxiety)</option>
                      </select>
                    </div>

                    {/* 8. Ahara Shakti */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>8. Ahara Shakti</span>
                          <span className="text-slate-500 font-bold">— Digestive capacity</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Ahara Shakti — Digestive capacity')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.aharaShakti}
                        onChange={(e) => setDashavidha({ ...dashavidha, aharaShakti: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Samagni (Balanced digestive capacity, steady hunger, smooth digestion)">Samagni (Balanced digestion, comfortable hunger at intervals)</option>
                        <option value="Tikshnagni (Intense hunger, quick gastric emptying, burns food, acid prone)">Tikshnagni (Intense hunger, burns food fast, prone to acidity)</option>
                        <option value="Mandagni (Slow, sluggish digestion, feeling of heaviness after small meals)">Mandagni (Sluggish digestion, heaviness after small meals)</option>
                        <option value="Vishamagni (Irregular appetite, unpredictable digestion with gas/bloating)">Vishamagni (Irregular appetite, variable bloating &amp; gas)</option>
                      </select>
                    </div>

                    {/* 9. Vyayama Shakti */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>9. Vyayama Shakti</span>
                          <span className="text-slate-500 font-bold">— Exercise capacity</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Vyayama Shakti — Exercise capacity')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.vyayamaShakti}
                        onChange={(e) => setDashavidha({ ...dashavidha, vyayamaShakti: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Pravara Shakti (High exercise capacity, performs heavy physical work easily)">Pravara Shakti (High stamina, performs physical activity easily)</option>
                        <option value="Madhyama Shakti (Moderate capacity, comfortable with 30-45 min brisk walk/yoga)">Madhyama Shakti (Moderate capacity, 30-45 min walk/yoga)</option>
                        <option value="Avara Shakti (Low stamina, experiences breathlessness or quick fatigue)">Avara Shakti (Low stamina, easily breathless or fatigued)</option>
                      </select>
                    </div>

                    {/* 10. Vaya */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                          <span>10. Vaya</span>
                          <span className="text-slate-500 font-bold">— Age assessment</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleSpeak('Vaya — Age assessment')}
                          className="text-slate-400 hover:text-emerald-700"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <select
                        value={dashavidha.vaya}
                        onChange={(e) => setDashavidha({ ...dashavidha, vaya: e.target.value })}
                        className="w-full p-2.5 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="Balya Vaya (Growth phase, Kapha predominant, childhood to adolescence)">Balya Vaya (Growth phase, childhood / adolescence)</option>
                        <option value="Madhyama Vaya (Active adult phase 16-60 years, Pitta predominant)">Madhyama Vaya (Active adult phase 16-60 years)</option>
                        <option value="Vriddha Vaya (Geriatric phase >60 years, Vata predominant, degenerative tendencies)">Vriddha Vaya (Geriatric phase &gt;60 years)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* 2. AHARA–VIHARA ASSESSMENT (Diet & Lifestyle) */}
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="border-b border-slate-200 pb-2">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>AHARA–VIHARA ASSESSMENT</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                        Diet &amp; Lifestyle
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Capturing nutritional habits and daily living patterns for holistic clinical guidance
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* AHARA SECTION */}
                    <div className="p-5 rounded-2xl bg-amber-50/50 border border-amber-200 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                        <Utensils className="w-4 h-4 text-amber-600" />
                        <span>AHARA — DIET / FOOD</span>
                      </h4>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Usual Diet Pattern:</label>
                        <select
                          value={ahara.usualDiet}
                          onChange={(e) => setAhara({ ...ahara, usualDiet: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Vegetarian (Wholesome balanced vegetarian meals)">Vegetarian (Wholesome balanced vegetarian meals)</option>
                          <option value="Non-vegetarian (Includes poultry, fish, or red meat regularly)">Non-vegetarian (Includes poultry, fish, meat)</option>
                          <option value="Satvik / Vegan (Pure plant-based, no onion/garlic, fresh food)">Satvik / Vegan (Pure plant-based, freshly cooked)</option>
                          <option value="Mixed (Mostly home-cooked with occasional outside dining)">Mixed (Home-cooked with occasional outside food)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Meal Timing &amp; Rhythm:</label>
                        <select
                          value={ahara.mealTiming}
                          onChange={(e) => setAhara({ ...ahara, mealTiming: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Regular 2-3 times daily (Breakfast, Lunch, Light Dinner)">Regular 2-3 times daily (Fixed timings)</option>
                          <option value="Irregular timings (Skips breakfast, late afternoon lunch)">Irregular timings (Skips meals, busy schedule)</option>
                          <option value="Late night dinner (Dinner taken within 1 hour of sleep)">Late night dinner (Eats shortly before sleep)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Food Preferences (Tastes):</label>
                        <select
                          value={ahara.foodPreferences}
                          onChange={(e) => setAhara({ ...ahara, foodPreferences: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Sweet & Sour (Madhura-Amla, prefers comforting grains/dairy)">Sweet &amp; Sour (Madhura-Amla, dairy &amp; grains)</option>
                          <option value="Spicy & Pungent (Katu-Tikshna, high chilies and hot spices)">Spicy &amp; Pungent (Katu, high chilies and spices)</option>
                          <option value="Salty & Fried (Lavana, pickles, snacks, fried items)">Salty &amp; Fried (Lavana, savory snacks, fried)</option>
                          <option value="Bitter & Astringent (Tikta-Kashaya, green vegetables, tea)">Bitter &amp; Astringent (Tikta-Kashaya, greens, tea)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Water &amp; Fluid Intake:</label>
                        <select
                          value={ahara.waterIntake}
                          onChange={(e) => setAhara({ ...ahara, waterIntake: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="2 to 2.5 litres daily, normal/warm water">2 to 2.5 Litres daily (Normal/warm water)</option>
                          <option value="Less than 1.5 litres daily (Low hydration / dry throat)">Less than 1.5 Litres daily (Low fluid intake)</option>
                          <option value="More than 3 litres daily (High hydration)">More than 3 Litres daily (High hydration)</option>
                          <option value="Prefers refrigerated / cold beverages with meals">Prefers chilled / cold drinks with meals</option>
                        </select>
                      </div>
                    </div>

                    {/* VIHARA SECTION */}
                    <div className="p-5 rounded-2xl bg-teal-50/50 border border-teal-200 space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-wider text-teal-900 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <span>VIHARA — LIFESTYLE</span>
                      </h4>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Daily Routine (Dinacharya):</label>
                        <select
                          value={vihara.dailyRoutine}
                          onChange={(e) => setVihara({ ...vihara, dailyRoutine: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Early riser (wakes before 6:30 AM), active routine">Early riser (Wakes before 6:30 AM)</option>
                          <option value="Standard routine (Wakes around 7:00 - 8:00 AM)">Standard routine (Wakes 7:00 - 8:00 AM)</option>
                          <option value="Irregular / Night owl (Sleeps past midnight, variable wake-up)">Night owl (Late nights, irregular routine)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Sleep Pattern (Nidra):</label>
                        <select
                          value={vihara.sleepPattern}
                          onChange={(e) => setVihara({ ...vihara, sleepPattern: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Sound 7 hours night sleep, restful awakenings">Sound 7-8 hours sleep, restful awakenings</option>
                          <option value="Disturbed / Interrupted sleep, difficulty falling asleep">Disturbed / Fragmented sleep, takes long to sleep</option>
                          <option value="Daytime sleeping habit (Divasvapna, 1-2 hours afternoon nap)">Habitual afternoon sleep (Divasvapna)</option>
                          <option value="Chronic insomnia / Sleep deprivation (<5 hours)">Chronic sleep deficit (&lt;5 hours nightly)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Physical Activity &amp; Exercise:</label>
                        <select
                          value={vihara.exercise}
                          onChange={(e) => setVihara({ ...vihara, exercise: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Daily 20-30 min brisk walk or yogasanas">Daily 20-30 min brisk walk or yogasanas</option>
                          <option value="Moderate walking and active domestic routine">Moderate daily walking and housework</option>
                          <option value="Sedentary (Desk work, minimal exercise)">Sedentary (Desk-bound, minimal exercise)</option>
                          <option value="Intense gym / sports training (4-5 days/week)">Intense gym / sports (4-5 days/week)</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700">Work Pattern &amp; Rest:</label>
                        <select
                          value={vihara.workLifestyle}
                          onChange={(e) => setVihara({ ...vihara, workLifestyle: e.target.value })}
                          className="w-full p-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-900"
                        >
                          <option value="Balanced work hours with adequate evening relaxation">Balanced work with adequate relaxation</option>
                          <option value="High mental stress / long continuous screen hours">High mental stress / continuous screen work</option>
                          <option value="Shift duties / Rotating night work">Rotating shift duties / night work</option>
                          <option value="Physical field labor with sun exposure">Physical field labor with sun exposure</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. AYURVEDIC WELLNESS HISTORY (Summary Card) */}
                <div className="p-5 rounded-2xl bg-emerald-50/80 border border-emerald-300 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950 flex items-center gap-2">
                      <span>AYURVEDIC WELLNESS HISTORY</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                        Profile Summary
                      </span>
                    </h4>
                    <span className="text-[11px] text-emerald-800 font-semibold">
                      Recorded for Doctor Evaluation
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed font-medium">
                    Constitutional Prakriti evaluated as <strong>{dashavidha.prakriti.split('(')[0]}</strong> with <strong>{dashavidha.vikriti.split('(')[0]}</strong> tendencies. Digestive fire functioning as <strong>{dashavidha.aharaShakti.split('(')[0]}</strong>, with <strong>{dashavidha.vyayamaShakti.split('(')[0]}</strong> exercise stamina. Habitual diet: {ahara.usualDiet.split('(')[0]}, sleep pattern: {vihara.sleepPattern.split('(')[0]}.
                  </p>
                </div>

                {/* 4. INFORMATIONAL EDUCATIONAL AREA: Understanding Dashavidha Pariksha */}
                <div className="p-4 rounded-2xl bg-slate-100/90 border border-slate-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
                    <Info className="w-4 h-4 text-emerald-600" />
                    <span>Understanding Dashavidha Pariksha (Classical Ayurvedic Framework)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] text-slate-600 font-medium">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Prakriti</strong> Body constitution
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Vikriti</strong> Current imbalance
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Sara</strong> Tissue quality
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Samhanana</strong> Body compactness
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Pramana</strong> Body measurements
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Satmya</strong> Suitability/adaptation
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Sattva</strong> Mental strength
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Ahara Shakti</strong> Digestive capacity
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Vyayama Shakti</strong> Exercise capacity
                    </div>
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <strong className="text-slate-900 block">Vaya</strong> Age assessment
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 italic pt-1">
                    * Informational only. Classical parameters provide individualized Ayurvedic context and are reviewed and confirmed by the attending doctor.
                  </p>
                </div>
              </div>
            ) : (
              /* STANDARD ALLOPATHY OPD ADAPTIVE QUESTIONS */
              <div className="space-y-5 animate-fade-in">
                {(COMPLAINT_QUESTIONS_MAP[selectedComplaintId] || []).map((q, qIndex) => {
                  const qText = q.text[currentLanguage] || q.text.en;
                  const currentAnswer = adaptiveAnswers[q.id];

                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-slate-50/80 border-2 border-slate-200/90 space-y-3.5 transition-all shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200">
                            Q{qIndex + 1} • {q.category.toUpperCase()}
                          </span>
                          <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                            {qText}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSpeak(qText)}
                          className="p-2 rounded-xl bg-white hover:bg-teal-50 text-teal-700 border border-slate-200 shadow-2xs shrink-0 transition-colors"
                          title="Listen to question"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Options list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {q.options?.map((opt) => {
                          const optLabel = opt.label[currentLanguage] || opt.label.en;
                          const isSelected = currentAnswer === opt.id;

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setAdaptiveAnswers((prev) => ({
                                  ...prev,
                                  [q.id]: opt.id,
                                }));
                              }}
                              className={`p-3.5 rounded-xl border-2 text-left font-bold text-xs sm:text-sm transition-all flex items-center justify-between ${
                                isSelected
                                  ? opt.isRedFlag
                                    ? 'border-rose-600 bg-rose-50 text-rose-950 shadow-2xs'
                                    : 'border-teal-600 bg-teal-50 text-teal-950 shadow-2xs'
                                  : 'border-slate-200 bg-white hover:bg-slate-100/80 text-slate-700'
                              }`}
                            >
                              <span>{optLabel}</span>
                              {isSelected && (
                                <CheckCircle
                                  className={`w-4 h-4 shrink-0 ${
                                    opt.isRedFlag ? 'text-rose-600' : 'text-teal-600'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* MANDATORY ALLERGY QUESTION SECTION (Common across OPD and AYUSH) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/70 border-2 border-amber-300 space-y-4 shadow-2xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-amber-950">
                      {t.allergyQuestionTitle || 'Do you have any known allergies?'}
                    </h3>
                    <p className="text-xs text-amber-800 font-medium mt-0.5">
                      (Dawa, bhojan, ya kisi anya vastu se allergy / Any allergy to medicines, foods, or substances)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleSpeak(
                      t.allergyQuestionTitle || 'Do you have any known allergies?'
                    )
                  }
                  className="p-2 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs shrink-0 transition-colors"
                  title="Listen to allergy question"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* 3 Choice Buttons: Yes, No, Not sure */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setAllergyResponse('yes')}
                  className={`py-3.5 px-3 rounded-xl border-2 text-center text-xs sm:text-sm font-black transition-all ${
                    allergyResponse === 'yes'
                      ? 'border-rose-600 bg-rose-50 text-rose-950 shadow-2xs ring-2 ring-rose-400/30'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {t.allergyYes || 'Yes'}
                </button>
                <button
                  type="button"
                  onClick={() => setAllergyResponse('no')}
                  className={`py-3.5 px-3 rounded-xl border-2 text-center text-xs sm:text-sm font-black transition-all ${
                    allergyResponse === 'no'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-2xs ring-2 ring-emerald-400/30'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {t.allergyNo || 'No'}
                </button>
                <button
                  type="button"
                  onClick={() => setAllergyResponse('not_sure')}
                  className={`py-3.5 px-3 rounded-xl border-2 text-center text-xs sm:text-sm font-black transition-all ${
                    allergyResponse === 'not_sure'
                      ? 'border-amber-600 bg-amber-100 text-amber-950 shadow-2xs ring-2 ring-amber-400/30'
                      : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  {t.allergyNotSure || 'Not sure'}
                </button>
              </div>

              {/* If Yes: text input to specify allergy details */}
              {allergyResponse === 'yes' && (
                <div className="space-y-2 pt-2 border-t border-amber-200 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-950">
                      {t.allergySpecify || 'Please specify allergy (e.g., penicillin, sulfa, peanuts, dust):'}
                    </label>
                    <button
                      type="button"
                      onClick={() => handleToggleListening('allergy')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                        isListening && speechFieldTarget === 'allergy'
                          ? 'bg-rose-500 text-white animate-pulse'
                          : 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                      }`}
                    >
                      {isListening && speechFieldTarget === 'allergy' ? (
                        <>
                          <MicOff className="w-3.5 h-3.5" />
                          <span>{t.listening}</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-3.5 h-3.5" />
                          <span>{t.speakAnswer}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={allergyDetails}
                    onChange={(e) => setAllergyDetails(e.target.value)}
                    placeholder="e.g., Penicillin, Sulfa drugs, Peanuts, Seafood"
                    className="w-full px-4 py-3 rounded-xl bg-white border border-amber-300 text-slate-900 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              )}

              {allergyResponse === 'not_sure' && (
                <p className="text-[11px] text-amber-900 font-semibold italic">
                  Note: &quot;Not sure&quot; will be flagged to the attending doctor to verify before prescribing medications.
                </p>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                onClick={() => setCurrentStep(6)}
                className="px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-sm shadow-teal-600/30 flex items-center gap-3"
              >
                <span>{t.next}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 6: Document Scanner, OCR & Medical Timeline */}
        {currentStep === 6 && (
          <div className="p-6 sm:p-10 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                <FileText className="w-8 h-8 text-indigo-600" />
                {t.stepDocsTitle}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-1">
                {t.stepDocsSubtitle}
              </p>
            </div>

            {/* Fast Demo Sample Document Picker */}
            <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-200 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-700" />
                <h4 className="text-xs sm:text-sm font-black text-indigo-950 uppercase tracking-wider">
                  {t.useSampleDoc}
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleLoadSampleDoc(SAMPLE_DOCUMENTS[0])}
                  className="p-3 bg-white hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl text-left text-xs font-bold shadow-2xs transition-all flex flex-col justify-between"
                >
                  <span>🏥 {t.samplePrescription}</span>
                  <span className="text-[10px] text-indigo-600 font-semibold mt-1">Metformin, Telmisartan, HTN</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSampleDoc(SAMPLE_DOCUMENTS[1])}
                  className="p-3 bg-white hover:bg-rose-100 text-rose-900 border border-rose-200 rounded-xl text-left text-xs font-bold shadow-2xs transition-all flex flex-col justify-between"
                >
                  <span>🩸 {t.sampleLabReport}</span>
                  <span className="text-[10px] text-rose-600 font-semibold mt-1">Platelet 58k, Dengue NS1+</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSampleDoc(SAMPLE_DOCUMENTS[2])}
                  className="p-3 bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-xl text-left text-xs font-bold shadow-2xs transition-all flex flex-col justify-between"
                >
                  <span>❤️ {t.sampleDischarge}</span>
                  <span className="text-[10px] text-emerald-600 font-semibold mt-1">STEMI Post-PCI, Ticagrelor</span>
                </button>
              </div>
            </div>

            {/* Real File Upload & Camera Scan Button */}
            <div className="border-2 border-dashed border-slate-300 hover:border-teal-500 rounded-2xl p-6 text-center transition-colors bg-slate-50/50">
              <input
                type="file"
                id="kiosk-file-input"
                accept="image/*,.pdf"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              <label
                htmlFor="kiosk-file-input"
                className="cursor-pointer flex flex-col items-center justify-center gap-2"
              >
                <div className="w-12 h-12 rounded-full bg-teal-100/70 text-teal-700 flex items-center justify-center">
                  <Camera className="w-6 h-6" />
                </div>
                <div className="font-black text-slate-800 text-sm sm:text-base">
                  {t.uploadOrScanPrompt}
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  PNG, JPG, PDF documents or Camera capture
                </span>
              </label>
            </div>

            {/* Loading OCR State */}
            {isOcrProcessing && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-3 animate-pulse">
                <Activity className="w-5 h-5 text-amber-600 animate-spin" />
                <span className="text-xs sm:text-sm font-bold text-amber-900">
                  {t.ocrProcessing}
                </span>
              </div>
            )}

            {/* Extracted Medical Documents & Timeline */}
            {uploadedDocs.length > 0 ? (
              <div className="space-y-4">
                <h4 className="font-black text-slate-900 text-sm flex items-center justify-between">
                  <span>
                    Uploaded &amp; Extracted Records ({uploadedDocs.length} documents)
                  </span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {uploadedDocs.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-start gap-3"
                    >
                      <div className="w-16 h-20 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                        <img
                          src={doc.previewUrl}
                          alt={doc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-bold text-xs text-slate-900 truncate">
                          {doc.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {doc.facilityName || 'Medical Facility'} • {doc.documentDate || 'Recent'}
                        </div>
                        <div className="flex flex-wrap gap-1 pt-1">
                          {doc.extractedDiagnoses.slice(0, 2).map((d) => (
                            <span
                              key={d.id}
                              className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 truncate"
                            >
                              {d.condition}
                            </span>
                          ))}
                          {doc.extractedMedications.length > 0 && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {doc.extractedMedications.length} Meds
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-center text-slate-400 py-2">
                {t.noDocsAdded}
              </p>
            )}

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => setCurrentStep(5)}
                className="px-6 py-3 border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-2xl flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{t.back}</span>
              </button>
              <button
                onClick={handleFinalSubmit}
                className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-sm shadow-emerald-600/30 flex items-center gap-3"
              >
                <span>{t.submit}</span>
                <CheckCircle className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 7: Case Review & OPD Queue Token - Light Theme */}
        {currentStep === 7 && completedEncounter && (
          <div className="p-6 sm:p-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                {t.stepReviewTitle}
              </h2>
              <p className="text-sm text-slate-600 font-medium">
                {t.stepReviewSubtitle}
              </p>
            </div>

            {/* Official OPD Queue Token Card - Light & Airy Design */}
            <div className="max-w-md mx-auto rounded-3xl p-6 bg-gradient-to-b from-teal-50/50 via-white to-sky-50/50 text-slate-900 shadow-lg space-y-5 border-2 border-teal-500/30">
              {/* Token Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <div className="text-[11px] font-black text-teal-800 uppercase tracking-wider">
                    {completedEncounter.hospitalName?.toUpperCase() || 'DISTRICT HOSPITAL'} OPD
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600">
                    {completedEncounter.hospitalAddress || 'Hospital Complex, Main Road'}
                  </div>
                  <div className="text-[10px] text-slate-400">National Health Mission</div>
                </div>
                <div className="w-10 h-10 bg-teal-100/80 rounded-2xl flex items-center justify-center text-xl shadow-2xs">
                  🏥
                </div>
              </div>

              {/* Huge Token Number */}
              <div className="text-center py-2">
                <div className="text-xs uppercase tracking-widest text-slate-500 font-black">
                  {t.tokenGenerated}
                </div>
                <div className="text-4xl sm:text-5xl font-black tracking-wider text-teal-700 font-mono my-1">
                  {completedEncounter.opdToken}
                </div>
                <div className="text-sm font-bold text-slate-700">
                  {completedEncounter.opdRoom}
                </div>
              </div>

              {/* Triage Urgency Alert */}
              <div
                className={`p-3 rounded-2xl border text-xs font-black flex items-center gap-2.5 ${
                  completedEncounter.triagePriority === 'emergency'
                    ? 'bg-rose-100/90 border-rose-400 text-rose-950 animate-pulse'
                    : completedEncounter.triagePriority === 'urgent'
                    ? 'bg-amber-100/90 border-amber-400 text-amber-950'
                    : 'bg-emerald-100/90 border-emerald-400 text-emerald-950'
                }`}
              >
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
                <span>
                  {completedEncounter.triagePriority === 'emergency' && t.emergencyAlert}
                  {completedEncounter.triagePriority === 'urgent' && t.urgentAlert}
                  {completedEncounter.triagePriority === 'routine' && t.routineNotice}
                </span>
              </div>

              {/* Patient Details & ABHA Bar */}
              <div className="bg-white rounded-2xl p-3.5 border border-slate-200 text-xs space-y-2 shadow-2xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Hospital Patient ID:</span>
                  <span className="font-mono font-black text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    {completedEncounter.patientId || 'P10025'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Visit Number:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {completedEncounter.visitId || 'V001'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Patient:</span>
                  <span className="font-bold text-slate-900">{completedEncounter.demographics.fullName} ({completedEncounter.demographics.age}Y/{completedEncounter.demographics.gender.toUpperCase()})</span>
                </div>
                {completedEncounter.accompanyingPerson?.name && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Attendant:</span>
                    <span className="font-bold text-slate-800">
                      {completedEncounter.accompanyingPerson.name} ({completedEncounter.accompanyingPerson.relation})
                    </span>
                  </div>
                )}
                {completedEncounter.knownAllergies && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Allergies:</span>
                    <span className={`font-bold ${
                      completedEncounter.knownAllergies.hasAllergy === 'yes'
                        ? 'text-rose-700'
                        : completedEncounter.knownAllergies.hasAllergy === 'not_sure'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}>
                      {completedEncounter.knownAllergies.hasAllergy === 'yes'
                        ? `Yes (${completedEncounter.knownAllergies.details || 'Specified'})`
                        : completedEncounter.knownAllergies.hasAllergy === 'not_sure'
                        ? 'Not sure'
                        : 'No allergies'}
                    </span>
                  </div>
                )}
                {(completedEncounter.demographics.abha?.abhaAddress || completedEncounter.demographics.abha?.abhaNumber) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">ABHA:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {completedEncounter.demographics.abha.abhaAddress || completedEncounter.demographics.abha.abhaNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Consultation:</span>
                  <span className="font-bold text-teal-800 uppercase">
                    {completedEncounter.systemOfMedicine === 'ayurveda' || completedEncounter.consultationType === 'wellness'
                      ? '🌿 AYUSH / AYURVEDIC WELLNESS'
                      : '🏥 ALLOPATHIC OPD'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Complaint:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">{completedEncounter.chiefComplaint.title}</span>
                </div>

                {completedEncounter.ayushHistory && (
                  <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-emerald-900 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                    <div className="font-black text-emerald-950 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <span>🌿 Dashavidha Pariksha Summary</span>
                    </div>
                    <div>Prakriti: <strong>{completedEncounter.ayushHistory.dashavidha.prakriti.split('(')[0]}</strong> | Vikriti: <strong>{completedEncounter.ayushHistory.dashavidha.vikriti.split('(')[0]}</strong></div>
                    <div>Agni: <strong>{completedEncounter.ayushHistory.dashavidha.aharaShakti.split('(')[0]}</strong> | Vyayama: <strong>{completedEncounter.ayushHistory.dashavidha.vyayamaShakti.split('(')[0]}</strong></div>
                  </div>
                )}
              </div>

              {/* QR Code Barcode */}
              <div className="bg-white rounded-2xl p-3 border border-slate-200 flex items-center justify-between text-slate-900 shadow-2xs">
                <div className="space-y-0.5">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                    Scan for OPD Counter
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-800">
                    {completedEncounter.abdmCareContextRef}
                  </div>
                </div>
                <QrCode className="w-12 h-12 text-slate-800" />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2 justify-center">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm rounded-2xl border border-slate-300 shadow-2xs flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>{t.printToken}</span>
              </button>
              <button
                onClick={handleResetForNewPatient}
                className="px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-2xl shadow-sm shadow-teal-600/30 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{t.newPatientBtn}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* EMERGENCY IPD FAST-TRACK MODAL (3 mandatory fields: Name, Age, Mobile) */}
      {showIpdModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border-4 border-rose-500 animate-scale-in">
            <div className="flex items-start justify-between gap-3 border-b border-rose-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                  FAST-TRACK ADMISSION
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-rose-950 flex items-center gap-2 mt-1">
                  <span>🚨 Emergency IPD Registration</span>
                </h3>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  Direct admission protocol: No initial case questions required. Minimal intake.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIpdModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEmergencyIpdSubmit} className="space-y-4 pt-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-800">
                  Patient Full Name <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ipdForm.fullName}
                  onChange={(e) => setIpdForm({ ...ipdForm, fullName: e.target.value })}
                  placeholder="e.g., Harish Chandra"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 text-slate-900 font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Age (Years) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    required
                    value={ipdForm.age}
                    onChange={(e) => setIpdForm({ ...ipdForm, age: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 text-slate-900 font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-800">
                    Mobile Number <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={ipdForm.phone}
                    onChange={(e) => setIpdForm({ ...ipdForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 text-slate-900 font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-800">
                  Allocated Emergency Bed / Ward:
                </label>
                <select
                  value={ipdForm.bedWard}
                  onChange={(e) => setIpdForm({ ...ipdForm, bedWard: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-300 text-slate-900 font-bold focus:border-rose-600 focus:bg-white focus:outline-none"
                >
                  <option value="Emergency Bed 1 (Acute Resus)">Emergency Bed 1 (Acute Resus)</option>
                  <option value="Emergency Bed 2 (Triage / Monitor)">Emergency Bed 2 (Triage / Monitor)</option>
                  <option value="ICU Bed 4 (Critical Care)">ICU Bed 4 (Critical Care)</option>
                  <option value="Male IPD Ward - Bed 12">Male IPD Ward - Bed 12</option>
                  <option value="Female IPD Ward - Bed 08">Female IPD Ward - Bed 08</option>
                  <option value="Pediatric Ward - Bed 03">Pediatric Ward - Bed 03</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowIpdModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-600/30 flex items-center gap-2"
                >
                  <Bed className="w-4 h-4" />
                  <span>Admit Patient Immediately</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IPD REGISTRATION CONFIRMATION SLIP */}
      {ipdSuccessEncounter && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border-4 border-rose-600 text-slate-900 space-y-4 animate-scale-in">
            <div className="text-center space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-rose-700 bg-rose-50 px-3 py-1 rounded-full border border-rose-300 inline-block">
                EMERGENCY IPD ADMISSION CONFIRMED
              </span>
              <h3 className="text-2xl font-black text-slate-900 pt-1">
                {ipdSuccessEncounter.hospitalName}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {ipdSuccessEncounter.hospitalAddress}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-center space-y-1">
              <div className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">
                IPD Admission Number
              </div>
              <div className="text-3xl font-mono font-black text-rose-700">
                {ipdSuccessEncounter.ipdRegistrationId}
              </div>
              <div className="text-xs font-bold text-rose-900">
                Bed / Ward: {ipdSuccessEncounter.bedWard}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Patient Name:</span>
                <span className="font-bold text-slate-900">{ipdSuccessEncounter.demographics.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Age / Gender:</span>
                <span className="font-bold text-slate-900">{ipdSuccessEncounter.demographics.age} Yrs / {ipdSuccessEncounter.demographics.gender.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Contact Number:</span>
                <span className="font-bold text-slate-900">{ipdSuccessEncounter.demographics.phone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Admission Date &amp; Time:</span>
                <span className="font-mono font-bold text-slate-800">
                  {new Date(ipdSuccessEncounter.admissionDate || Date.now()).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 border border-slate-300"
              >
                <Printer className="w-4 h-4" />
                <span>Print IPD Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setIpdSuccessEncounter(null)}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/30 flex items-center justify-center"
              >
                <span>Done</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ABHA Card Modal */}
      <AbhaCardModal
        isOpen={showAbhaModal}
        onClose={() => setShowAbhaModal(false)}
        patientName={demographics.fullName}
        patientPhone={demographics.phone}
        currentAbha={demographics.abha}
        onSelectAbha={(newAbha) => {
          setDemographics((prev) => ({ ...prev, abha: newAbha }));
        }}
      />

      {/* Floating Hospital AI Assistant */}
      <AiChatbot
        currentLanguage={currentLanguage}
        hospitalName={hospitalName}
        hospitalAddress={hospitalAddress}
      />
    </div>
  );
};
