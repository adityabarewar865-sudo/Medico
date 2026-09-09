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
  Printer} from 'lucide-react';
import type {
  LanguageCode,
  ChiefComplaintId,
  PatientDemographics,
  AdaptiveAnswer,
  UploadedMedicalDocument,
  PatientCaseEncounter} from '../../types/clinical';
import { TRANSLATIONS, CHIEF_COMPLAINTS_DATA, SUPPORTED_LANGUAGES } from '../../services/i18n';
import {  } from '../../services/adaptiveQuestions';
import { SAMPLE_DOCUMENTS, buildChronologicalTimeline, parseMedicalText } from '../../services/ocrEngine';
import { clinicalAI } from '../../services/clinicalAI';
import { storage } from '../../services/storage';
import { hospitalDb } from '../../services/hospitalDatabase';
import { speech } from '../../services/speech';
import { AbhaCardModal } from './AbhaCardModal';

interface PatientKioskProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  
  onPatientCompleted?: (patientId: string) => void;
  hospitalName?: string;
}

export const PatientKiosk: React.FC<PatientKioskProps> = ({
  currentLanguage,
  onLanguageChange,
  
  onPatientCompleted,
  hospitalName}) => {
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.en;

  // Multi-step navigation (1 to 7)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Speech input state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechFieldTarget, setSpeechFieldTarget] = useState<string | null>(null);

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
      kycStatus: 'SELF_DECLARED'},
    preferredLanguage: currentLanguage});

  const [showAbhaModal, setShowAbhaModal] = useState<boolean>(false);
  const [detectedPatientRecord, setDetectedPatientRecord] = useState<any>(null);

  // Auto detect returning patient by phone number
  useEffect(() => {
    if (demographics.phone && demographics.phone.length >= 7) {
      const existing = hospitalDb.findExistingPatient(demographics.phone);
      if (existing) {
        setDetectedPatientRecord(existing);
      } else {
        setDetectedPatientRecord(null);
      }
    } else {
      setDetectedPatientRecord(null);
    }
  }, [demographics.phone]);

  // Consent state
  const [consentGranted, setConsentGranted] = useState<boolean>(false);
  const [isReadingConsent, setIsReadingConsent] = useState<boolean>(false);

  // Chief Complaint state
  const [selectedComplaintId, setSelectedComplaintId] = useState<ChiefComplaintId>('chest_pain');
  const [complaintCustomText, setComplaintCustomText] = useState<string>('');
  const [painSeverity, setPainSeverity] = useState<number>(7);

  // Adaptive Answers state
  

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

  // Read step instructions aloud (REMOVED)
  useEffect(() => {
    // Text-to-speech output removed as per requirement,
    // microphone input (speech-to-text) is still active.
    speech.stopSpeaking();
    return () => speech.stopSpeaking();
  }, [currentStep, currentLanguage]);

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

  // Read consent out loud (REMOVED text-to-speech)
  const handleReadConsentAloud = () => {
    setIsReadingConsent(true);
    setTimeout(() => setIsReadingConsent(false), 2000);
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
      isRedFlagIndicator: painSeverity >= 8});

    const timeline = buildChronologicalTimeline(uploadedDocs);

    const assessment = clinicalAI.generateAssessment(
      demographics,
      selectedComplaintId,
      complaintCustomText,
      formattedAnswers,
      uploadedDocs
    );

    const tokenNumber = `OPD-MED-${Math.floor(100 + Math.random() * 900)}`;
    const roomNumber = assessment.triagePriority === 'emergency' ? 'Room 1 (Emergency Resus / Med)' : 'Room 4 (General Medicine)';

    const existingPatient = detectedPatientRecord || hospitalDb.findExistingPatient(demographics.phone);
    const assignedPatientId = existingPatient?.patientId || hospitalDb.generateNextPatientId();
    const assignedVisitId = existingPatient ? `V${String(existingPatient.visits.length + 1).padStart(3, '0')}` : 'V001';

    const newEncounter: PatientCaseEncounter = {
      id: `enc_${Date.now()}`,
      patientId: assignedPatientId,
      visitId: assignedVisitId,
      visitDate: new Date().toISOString().split('T')[0],
      
      opdToken: tokenNumber,
      opdRoom: roomNumber,
      specialty: 'Internal Medicine',
      hospitalName: hospitalName ,
      createdAt: new Date().toISOString(),
      demographics: {
        ...demographics,
        preferredLanguage: currentLanguage},
      consent: {
        granted: true,
        timestamp: new Date().toISOString(),
        method: 'biometric_touch',
        languageUsed: currentLanguage,
        abdmLinkConsent: true},
      chiefComplaint: {
        id: selectedComplaintId,
        title: CHIEF_COMPLAINTS_DATA.find((c) => c.id === selectedComplaintId)?.titles[currentLanguage] || 'Chief Complaint',
        description: complaintCustomText || 'Patient reported acute symptoms',
        onsetDuration: `${painSeverity}/10 severity`,
        voiceInputTranscript: complaintCustomText},
      
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
          rr: '18'}},
      doctorReview: {
        verified: false,
        status: 'pending'},
      savedToHis: false,
      abdmCareContextLinked: true,
      abdmCareContextRef: `CARE-CTX-${assignedPatientId}-${tokenNumber}`};

    storage.savePatient(newEncounter);
    setCompletedEncounter(newEncounter);
    setCurrentStep(6);

    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }});


    if (onPatientCompleted) {
      onPatientCompleted(newEncounter.id);
    }
  };

  const handleResetForNewPatient = () => {
    setCurrentStep(1);
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
  };

  

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Live Date, Day and Time */}
      <div className="flex justify-end mb-4 no-print">
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

      {/* Step Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-extrabold uppercase tracking-wider text-teal-800">
            {t.kioskMode} • Step {currentStep} of 6
          </span>
          <span className="text-xs font-semibold text-slate-500">
            {currentStep === 1 && 'Language & Accessibility'}
            {currentStep === 2 && 'Patient Demographics'}
            {currentStep === 3 && 'Informed Consent'}
            {currentStep === 4 && 'Chief Complaint'}
            {currentStep === 5 && 'Document Scanner & OCR'}
            {currentStep === 6 && 'OPD Queue Token'}
          </span>
        </div>
        <div className="h-2.5 w-full bg-slate-200/80 rounded-full overflow-hidden flex shadow-inner">
          {[1, 2, 3, 4, 5, 6].map((stepNum) => (
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

        {/* STEP 4: Chief Complaint & Anatomical Selection */}
        {currentStep === 4 && (
          <div className="p-6 sm:p-10 space-y-6">
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                <HeartPulse className="w-8 h-8 text-rose-600" />
                {t.stepComplaintTitle}
              </h2>
              <p className="text-sm text-slate-600 font-medium mt-1">
                {t.stepComplaintSubtitle}
              </p>
            </div>

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

        {/* STEP 5: Document Scanner, OCR & Medical Timeline */}
        {currentStep === 5 && (
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
                onClick={() => setCurrentStep(4)}
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

        {/* STEP 6: Case Review & OPD Queue Token - Light Theme */}
        {currentStep === 6 && completedEncounter && (
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
                    {completedEncounter.hospitalName?.toUpperCase() } OPD
                  </div>
                  <div className="text-xs font-semibold text-slate-500">National Health Mission</div>
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
                {(completedEncounter.demographics.abha?.abhaAddress || completedEncounter.demographics.abha?.abhaNumber) && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">ABHA:</span>
                    <span className="font-mono font-bold text-blue-700">
                      {completedEncounter.demographics.abha.abhaAddress || completedEncounter.demographics.abha.abhaNumber}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Complaint:</span>
                  <span className="font-bold text-slate-900 truncate max-w-[200px]">{completedEncounter.chiefComplaint.title}</span>
                </div>
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
    </div>
  );
};
