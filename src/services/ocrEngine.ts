import type {
  UploadedMedicalDocument,
  ExtractedDiagnosis,
  ExtractedMedication,
  ExtractedLabValue,
  MedicalTimelineEvent,
} from '../types/clinical';

// Realistic visual SVG data URLs for sample documents
const PRESCRIPTION_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style="background:%23fffdfa;font-family:sans-serif;">
  <!-- Hospital Header -->
  <rect x="0" y="0" width="600" height="110" fill="%230f766e"/>
  <text x="300" y="42" font-size="20" font-weight="bold" fill="white" text-anchor="middle">DISTRICT CIVIL HOSPITAL &amp; MEDICAL COLLEGE</text>
  <text x="300" y="68" font-size="13" fill="%23ccfbef" text-anchor="middle">Government of India - National Health Mission</text>
  <text x="300" y="90" font-size="11" fill="white" text-anchor="middle">OPD Outpatient Clinical Record | ABHA Enabled</text>

  <!-- Patient Details Line -->
  <rect x="20" y="125" width="560" height="60" fill="%23f8fafc" stroke="%23cbd5e1" rx="4"/>
  <text x="35" y="148" font-size="13" font-weight="bold" fill="%231e293b">Dr. S. K. Verma, MD (Internal Medicine)</text>
  <text x="400" y="148" font-size="12" fill="%2364748b">Reg No: MCI-28491</text>
  <text x="35" y="170" font-size="12" fill="%23334155">Date: 14/11/2025 | BP: 154/96 mmHg | Pulse: 82/min | Wt: 74 kg</text>

  <!-- Rx Symbol -->
  <text x="35" y="235" font-size="36" font-style="italic" font-weight="bold" fill="%230f766e">℞</text>

  <!-- Diagnoses box -->
  <rect x="35" y="255" width="530" height="80" fill="%23eff6ff" stroke="%23bfdbfe" rx="4"/>
  <text x="50" y="280" font-size="13" font-weight="bold" fill="%231e40af">CLINICAL DIAGNOSES / PROVISIONAL ASSESSMENT:</text>
  <text x="50" y="302" font-size="13" fill="%231e3a8a">• Type-2 Diabetes Mellitus (Uncontrolled - HbA1c 8.8%)</text>
  <text x="50" y="322" font-size="13" fill="%231e3a8a">• Essential Hypertension (Stage 2) &amp; Mixed Dyslipidemia</text>

  <!-- Medications table -->
  <text x="35" y="365" font-size="14" font-weight="bold" fill="%230f766e">PRESCRIPTION / MEDICATIONS:</text>
  <line x1="35" y1="375" x2="565" y2="375" stroke="%230f766e" stroke-width="2"/>
  
  <text x="45" y="405" font-size="13" font-weight="bold" fill="%230f172a">1. Tab Metformin 500 mg</text>
  <text x="350" y="405" font-size="13" fill="%23475569">1 - 0 - 1 (After meals)</text>
  <text x="45" y="425" font-size="11" fill="%2364748b">   Continue for 60 days</text>

  <text x="45" y="455" font-size="13" font-weight="bold" fill="%230f172a">2. Tab Telmisartan 40 mg</text>
  <text x="350" y="455" font-size="13" fill="%23475569">1 - 0 - 0 (Morning empty stomach)</text>
  <text x="45" y="475" font-size="11" fill="%2364748b">   Daily for BP control</text>

  <text x="45" y="505" font-size="13" font-weight="bold" fill="%230f172a">3. Tab Atorvastatin 20 mg</text>
  <text x="350" y="505" font-size="13" fill="%23475569">0 - 0 - 1 (At Bedtime / HS)</text>
  <text x="45" y="525" font-size="11" fill="%2364748b">   For high cholesterol</text>

  <text x="45" y="555" font-size="13" font-weight="bold" fill="%230f172a">4. Tab Aspirin 75 mg EC</text>
  <text x="350" y="555" font-size="13" fill="%23475569">0 - 1 - 0 (Post lunch)</text>

  <!-- Lab instructions -->
  <rect x="35" y="595" width="530" height="90" fill="%23fef3c7" stroke="%23fde68a" rx="4"/>
  <text x="50" y="620" font-size="12" font-weight="bold" fill="%2392400e">ADVICE &amp; INVESTIGATIONS ORDERED:</text>
  <text x="50" y="640" font-size="12" fill="%2378350f">• Repeat Fasting Blood Sugar (FBS), Serum Creatinine, Lipid Profile in 1 month</text>
  <text x="50" y="660" font-size="12" fill="%2378350f">• Salt restricted diet &lt; 5g/day, brisk walking 30 mins daily</text>
  <text x="50" y="675" font-size="12" fill="%23b45309">• Warning: Report immediately if chest heaviness or sudden shortness of breath occurs</text>

  <!-- Hospital Stamp & Signature -->
  <circle cx="480" cy="730" r="35" fill="none" stroke="%23dc2626" stroke-width="2" stroke-dasharray="4,2"/>
  <text x="480" y="730" font-size="9" fill="%23dc2626" text-anchor="middle" font-weight="bold">CIVIL HOSPITAL OPD</text>
  <text x="480" y="742" font-size="8" fill="%23dc2626" text-anchor="middle">VERIFIED 14-NOV-2025</text>
  <path d="M 430 710 Q 450 690 480 720 T 520 705" stroke="%231e40af" stroke-width="2" fill="none"/>
  <text x="475" y="775" font-size="11" fill="%23334155" text-anchor="middle">Dr. S. K. Verma</text>
</svg>`;

const LAB_REPORT_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style="background:%23ffffff;font-family:sans-serif;">
  <rect x="0" y="0" width="600" height="100" fill="%231e3a8a"/>
  <text x="300" y="40" font-size="20" font-weight="bold" fill="white" text-anchor="middle">NATIONAL CLINICAL REFERENCE LAB</text>
  <text x="300" y="65" font-size="12" fill="%2393c5fd" text-anchor="middle">NABL ACCREDITED &amp; ICMR APPROVED TESTING FACILITY</text>
  <text x="300" y="85" font-size="11" fill="white" text-anchor="middle">Automated Hematology &amp; Biochemistry Report</text>

  <!-- Patient banner -->
  <rect x="25" y="115" width="550" height="65" fill="%23f1f5f9" stroke="%23cbd5e1" rx="4"/>
  <text x="40" y="138" font-size="12" fill="%23334155">Patient ID: <tspan font-weight="bold">NC-2026-8941</tspan> | Age: <tspan font-weight="bold">42 Yrs / Female</tspan></text>
  <text x="40" y="160" font-size="12" fill="%23334155">Date: <tspan font-weight="bold">18-Feb-2026</tspan> | Ref Doctor: <tspan font-weight="bold">Dr. R. K. Mukherjee</tspan></text>

  <!-- Table Header -->
  <rect x="25" y="195" width="550" height="30" fill="%23e2e8f0"/>
  <text x="40" y="215" font-size="12" font-weight="bold" fill="%231e293b">TEST PARAMETER</text>
  <text x="260" y="215" font-size="12" font-weight="bold" fill="%231e293b">OBSERVED VALUE</text>
  <text x="390" y="215" font-size="12" font-weight="bold" fill="%231e293b">REFERENCE RANGE</text>
  <text x="520" y="215" font-size="12" font-weight="bold" fill="%231e293b">STATUS</text>

  <!-- Row 1: Platelets CRITICAL LOW -->
  <rect x="25" y="235" width="550" height="42" fill="%23fef2f2"/>
  <text x="40" y="260" font-size="13" font-weight="bold" fill="%23991b1b">Platelet Count (PLT)</text>
  <text x="260" y="260" font-size="14" font-weight="bold" fill="%23dc2626">58,000 /uL</text>
  <text x="390" y="260" font-size="12" fill="%2364748b">150,000 - 450,000</text>
  <rect x="505" y="244" width="60" height="24" fill="%23dc2626" rx="3"/>
  <text x="535" y="260" font-size="10" font-weight="bold" fill="white" text-anchor="middle">CRITICAL</text>

  <!-- Row 2: Dengue NS1 -->
  <rect x="25" y="280" width="550" height="38" fill="%23fff1f2"/>
  <text x="40" y="304" font-size="13" font-weight="bold" fill="%239f1239">Dengue NS1 Antigen</text>
  <text x="260" y="304" font-size="14" font-weight="bold" fill="%23e11d48">POSITIVE (Reactive)</text>
  <text x="390" y="304" font-size="12" fill="%2364748b">Non-Reactive</text>
  <text x="520" y="304" font-size="12" font-weight="bold" fill="%23e11d48">POSITIVE</text>

  <!-- Row 3: Total WBC -->
  <rect x="25" y="322" width="550" height="38" fill="%23f8fafc"/>
  <text x="40" y="346" font-size="12" fill="%231e293b">Total Leukocyte Count (TLC)</text>
  <text x="260" y="346" font-size="13" font-weight="bold" fill="%23b45309">3,200 /uL</text>
  <text x="390" y="346" font-size="12" fill="%2364748b">4,000 - 11,000</text>
  <text x="520" y="346" font-size="11" font-weight="bold" fill="%23d97706">LOW (Leukopenia)</text>

  <!-- Row 4: Hemoglobin -->
  <rect x="25" y="364" width="550" height="38" fill="%23ffffff"/>
  <text x="40" y="388" font-size="12" fill="%231e293b">Hemoglobin (Hb)</text>
  <text x="260" y="388" font-size="13" fill="%231e293b">11.4 g/dL</text>
  <text x="390" y="388" font-size="12" fill="%2364748b">12.0 - 15.5</text>
  <text x="520" y="388" font-size="11" fill="%2364748b">Mild Low</text>

  <!-- Row 5: Fasting Blood Sugar -->
  <rect x="25" y="406" width="550" height="38" fill="%23f8fafc"/>
  <text x="40" y="430" font-size="12" fill="%231e293b">Fasting Blood Glucose</text>
  <text x="260" y="430" font-size="13" font-weight="bold" fill="%23b45309">184 mg/dL</text>
  <text x="390" y="430" font-size="12" fill="%2364748b">70 - 100</text>
  <text x="520" y="430" font-size="11" font-weight="bold" fill="%23d97706">HIGH</text>

  <!-- Row 6: HbA1c -->
  <rect x="25" y="448" width="550" height="38" fill="%23ffffff"/>
  <text x="40" y="472" font-size="12" fill="%231e293b">Glycated Hemoglobin (HbA1c)</text>
  <text x="260" y="472" font-size="13" font-weight="bold" fill="%23b45309">9.2 %</text>
  <text x="390" y="472" font-size="12" fill="%2364748b">&lt; 5.7 (Good control)</text>
  <text x="520" y="472" font-size="11" font-weight="bold" fill="%23d97706">UNCONTROLLED</text>

  <!-- Row 7: Creatinine -->
  <rect x="25" y="490" width="550" height="38" fill="%23f8fafc"/>
  <text x="40" y="514" font-size="12" fill="%231e293b">Serum Creatinine</text>
  <text x="260" y="514" font-size="13" fill="%231e293b">1.0 mg/dL</text>
  <text x="390" y="514" font-size="12" fill="%2364748b">0.6 - 1.2</text>
  <text x="520" y="514" font-size="11" fill="%2316a34a">NORMAL</text>

  <!-- Pathologist Critical Note -->
  <rect x="25" y="555" width="550" height="85" fill="%23fef2f2" stroke="%23fca5a5" rx="4"/>
  <text x="40" y="580" font-size="12" font-weight="bold" fill="%23991b1b">CRITICAL ALERT (PANIC VALUE TELEPHONED):</text>
  <text x="40" y="602" font-size="12" fill="%237f1d1d">Platelet count 58,000 /uL with Dengue NS1 Reactive. High risk of bleeding diathesis.</text>
  <text x="40" y="622" font-size="12" fill="%237f1d1d">Immediate clinical correlation &amp; daily platelet monitoring advised.</text>

  <text x="450" y="740" font-size="12" font-weight="bold" fill="%231e293b">Dr. A. Sen, MD</text>
  <text x="450" y="756" font-size="11" fill="%2364748b">Consultant Pathologist</text>
</svg>`;

const DISCHARGE_SUMMARY_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800" style="background:%23ffffff;font-family:sans-serif;">
  <rect x="0" y="0" width="600" height="100" fill="%23047857"/>
  <text x="300" y="42" font-size="19" font-weight="bold" fill="white" text-anchor="middle">APEX INSTITUTE OF CARDIOVASCULAR SCIENCES</text>
  <text x="300" y="66" font-size="13" fill="%23a7f3d0" text-anchor="middle">Tertiary Care Cardiac &amp; Emergency Center</text>
  <text x="300" y="88" font-size="11" fill="white" text-anchor="middle">DISCHARGE SUMMARY &amp; OPERATIVE RECORD</text>

  <!-- IPD info -->
  <rect x="25" y="115" width="550" height="55" fill="%23f0fdf4" stroke="%23bbf7d0" rx="4"/>
  <text x="40" y="136" font-size="12" fill="%2314532d">Admission Date: <tspan font-weight="bold">05-Jun-2025</tspan> | Discharge Date: <tspan font-weight="bold">10-Jun-2025</tspan></text>
  <text x="40" y="156" font-size="12" fill="%2314532d">Department: <tspan font-weight="bold">Interventional Cardiology</tspan> | Ward: CCU Bed 04</text>

  <text x="25" y="195" font-size="13" font-weight="bold" fill="%23047857">FINAL DIAGNOSIS:</text>
  <rect x="25" y="205" width="550" height="50" fill="%23f8fafc" stroke="%23e2e8f0" rx="4"/>
  <text x="38" y="226" font-size="12" font-weight="bold" fill="%230f172a">• ACUTE INFERIOR WALL MYOCARDIAL INFARCTION (STEMI)</text>
  <text x="38" y="244" font-size="12" fill="%23334155">• S/P PRIMARY PCI WITH DRUG ELUTING STENT (DES) TO RIGHT CORONARY ARTERY</text>

  <text x="25" y="280" font-size="13" font-weight="bold" fill="%23047857">PROCEDURE NOTE:</text>
  <text x="25" y="302" font-size="12" fill="%23334155">Coronary Angiography revealed 100% thrombotic occlusion of mid RCA. Successful primary angioplasty</text>
  <text x="25" y="320" font-size="12" fill="%23334155">with DES (3.0 x 28 mm) deployed with TIMI 3 distal flow. 2D Echo: LVEF 45%, mild hypokinesia.</text>

  <text x="25" y="360" font-size="13" font-weight="bold" fill="%23047857">DISCHARGE MEDICATIONS (MANDATORY CARDIAC DRUGS):</text>
  <rect x="25" y="370" width="550" height="190" fill="%23f9fafb" stroke="%23e5e7eb" rx="4"/>
  <text x="38" y="395" font-size="12" font-weight="bold" fill="%23111827">1. Tab Ticagrelor 90 mg — 1 tab Twice daily (1-0-1) - DO NOT STOP (DAPT)</text>
  <text x="38" y="425" font-size="12" font-weight="bold" fill="%23111827">2. Tab Ecosprin 75 mg — 1 tab Once daily post lunch (0-1-0)</text>
  <text x="38" y="455" font-size="12" font-weight="bold" fill="%23111827">3. Tab Metoprolol Succinate 25 mg — 1 tab Morning (1-0-0) [Beta Blocker]</text>
  <text x="38" y="485" font-size="12" font-weight="bold" fill="%23111827">4. Tab Rosuvastatin 40 mg — 1 tab Bedtime (0-0-1) [High-Intensity Statin]</text>
  <text x="38" y="515" font-size="12" font-weight="bold" fill="%23111827">5. Tab Pantoprazole 40 mg — 1 tab Before breakfast (1-0-0)</text>
  <text x="38" y="545" font-size="11" fill="%23dc2626" font-weight="bold">CRITICAL: Dual Antiplatelet Therapy (Ticagrelor + Aspirin) MUST NOT BE STOPPED</text>

  <rect x="25" y="580" width="550" height="60" fill="%23ecfdf5" stroke="%23a7f3d0" rx="4"/>
  <text x="40" y="605" font-size="12" font-weight="bold" fill="%23065f46">FOLLOW UP ADVICE:</text>
  <text x="40" y="625" font-size="12" fill="%23065f46">Cardiology OPD visit after 2 weeks or immediately in Emergency if chest pain recurs.</text>

  <text x="420" y="730" font-size="12" font-weight="bold" fill="%23111827">Dr. Vikramaditya Rathore</text>
  <text x="420" y="746" font-size="11" fill="%234b5563">Director, Interventional Cardiology</text>
</svg>`;

// Predefined sample documents that users can load with 1 click
export const SAMPLE_DOCUMENTS: UploadedMedicalDocument[] = [
  {
    id: 'doc_sample_prescription',
    name: 'District_Civil_Hospital_Prescription_Nov2025.jpg',
    type: 'prescription',
    uploadTimestamp: '2025-11-14T10:30:00Z',
    previewUrl: PRESCRIPTION_SVG,
    doctorName: 'Dr. S. K. Verma, MD (Internal Medicine)',
    facilityName: 'District Civil Hospital & Medical College',
    documentDate: '2025-11-14',
    isSamplePreset: true,
    ocrRawText: `DISTRICT CIVIL HOSPITAL OPD RECORD
Date: 14/11/2025
Dr. S. K. Verma, MD (Internal Medicine)
Reg No: MCI-28491
Patient: Ramesh Kumar, 58/M
BP: 154/96 mmHg, Pulse: 82/min
Diagnoses:
- Type-2 Diabetes Mellitus (Uncontrolled - HbA1c 8.8%)
- Essential Hypertension (Stage 2) & Mixed Dyslipidemia
Rx:
1. Tab Metformin 500 mg - 1-0-1 (after meals)
2. Tab Telmisartan 40 mg - 1-0-0 (morning)
3. Tab Atorvastatin 20 mg - 0-0-1 (bedtime)
4. Tab Aspirin 75 mg EC - 0-1-0 (post lunch)
Advice: Repeat FBS, Serum Creatinine in 1 month. Salt restricted diet.`,
    extractedDiagnoses: [
      {
        id: 'diag_1',
        condition: 'Type 2 Diabetes Mellitus',
        date: '2025-11-14',
        icd10Estimate: 'E11.9',
        confidence: 0.96,
        status: 'active',
      },
      {
        id: 'diag_2',
        condition: 'Essential Hypertension (Stage 2)',
        date: '2025-11-14',
        icd10Estimate: 'I10',
        confidence: 0.94,
        status: 'active',
      },
      {
        id: 'diag_3',
        condition: 'Mixed Dyslipidemia',
        date: '2025-11-14',
        icd10Estimate: 'E78.2',
        confidence: 0.89,
        status: 'active',
      },
    ],
    extractedMedications: [
      {
        id: 'med_1',
        name: 'Metformin',
        dosage: '500 mg',
        frequency: '1-0-1 (Twice daily after meals)',
        duration: '60 days',
        purpose: 'Glycemic Control (Diabetes)',
        confidence: 0.98,
        sourceDocName: 'District Civil Hospital Prescription',
      },
      {
        id: 'med_2',
        name: 'Telmisartan',
        dosage: '40 mg',
        frequency: '1-0-0 (Once daily morning)',
        duration: 'Continuous',
        purpose: 'Blood Pressure Control (HTN)',
        confidence: 0.97,
        sourceDocName: 'District Civil Hospital Prescription',
      },
      {
        id: 'med_3',
        name: 'Atorvastatin',
        dosage: '20 mg',
        frequency: '0-0-1 (Once daily at bedtime)',
        duration: 'Continuous',
        purpose: 'Lipid Lowering / Plaque Stabilization',
        confidence: 0.95,
        sourceDocName: 'District Civil Hospital Prescription',
      },
      {
        id: 'med_4',
        name: 'Aspirin (Enteric Coated)',
        dosage: '75 mg',
        frequency: '0-1-0 (Once daily after lunch)',
        duration: 'Continuous',
        purpose: 'Antiplatelet Cardiovascular Prophylaxis',
        confidence: 0.93,
        sourceDocName: 'District Civil Hospital Prescription',
      },
    ],
    extractedLabValues: [
      {
        id: 'lab_1',
        testName: 'Blood Pressure (Clinic SBP/DBP)',
        value: '154/96',
        unit: 'mmHg',
        referenceRange: '< 120/80',
        status: 'abnormal',
        confidence: 0.96,
        date: '2025-11-14',
      },
      {
        id: 'lab_2',
        testName: 'HbA1c (Historical in note)',
        value: '8.8',
        unit: '%',
        referenceRange: '< 5.7',
        status: 'abnormal',
        confidence: 0.91,
        date: '2025-11-14',
      },
    ],
  },
  {
    id: 'doc_sample_lab_report',
    name: 'National_Lab_Hematology_Feb2026.pdf',
    type: 'lab_report',
    uploadTimestamp: '2026-02-18T14:15:00Z',
    previewUrl: LAB_REPORT_SVG,
    doctorName: 'Dr. A. Sen, MD (Pathologist)',
    facilityName: 'National Clinical Reference Lab',
    documentDate: '2026-02-18',
    isSamplePreset: true,
    ocrRawText: `NATIONAL CLINICAL REFERENCE LAB
Patient: Sunita Devi, 42/F
Date: 18-Feb-2026
Platelet Count (PLT): 58,000 /uL (Reference: 150,000 - 450,000) [CRITICAL LOW]
Dengue NS1 Antigen: POSITIVE (Reactive)
Total Leukocyte Count: 3,200 /uL (Low Leukopenia)
Hemoglobin: 11.4 g/dL (Mild Anemia)
Fasting Blood Glucose: 184 mg/dL (High)
HbA1c: 9.2 % (Uncontrolled Diabetes)
Serum Creatinine: 1.0 mg/dL (Normal)
Critical alert: Platelet count 58,000 /uL. Risk of hemorrhage. Immediate clinical review required.`,
    extractedDiagnoses: [
      {
        id: 'diag_4',
        condition: 'Dengue Viral Fever with Thrombocytopenia',
        date: '2026-02-18',
        icd10Estimate: 'A97.0',
        confidence: 0.98,
        status: 'active',
      },
    ],
    extractedMedications: [],
    extractedLabValues: [
      {
        id: 'lab_3',
        testName: 'Platelet Count',
        value: '58,000',
        unit: '/uL',
        referenceRange: '150,000 - 450,000',
        status: 'critical',
        confidence: 0.99,
        date: '2026-02-18',
      },
      {
        id: 'lab_4',
        testName: 'Dengue NS1 Antigen',
        value: 'POSITIVE',
        unit: 'Qualitative',
        referenceRange: 'Negative / Non-Reactive',
        status: 'critical',
        confidence: 0.99,
        date: '2026-02-18',
      },
      {
        id: 'lab_5',
        testName: 'Total WBC Count (TLC)',
        value: '3,200',
        unit: '/uL',
        referenceRange: '4,000 - 11,000',
        status: 'abnormal',
        confidence: 0.95,
        date: '2026-02-18',
      },
      {
        id: 'lab_6',
        testName: 'Fasting Blood Glucose',
        value: '184',
        unit: 'mg/dL',
        referenceRange: '70 - 100',
        status: 'abnormal',
        confidence: 0.96,
        date: '2026-02-18',
      },
      {
        id: 'lab_7',
        testName: 'HbA1c',
        value: '9.2',
        unit: '%',
        referenceRange: '< 5.7',
        status: 'critical',
        confidence: 0.97,
        date: '2026-02-18',
      },
      {
        id: 'lab_8',
        testName: 'Serum Creatinine',
        value: '1.0',
        unit: 'mg/dL',
        referenceRange: '0.6 - 1.2',
        status: 'normal',
        confidence: 0.94,
        date: '2026-02-18',
      },
    ],
  },
  {
    id: 'doc_sample_discharge',
    name: 'Apex_Cardiology_Discharge_June2025.pdf',
    type: 'discharge_summary',
    uploadTimestamp: '2025-06-10T16:00:00Z',
    previewUrl: DISCHARGE_SUMMARY_SVG,
    doctorName: 'Dr. Vikramaditya Rathore, DM (Cardiology)',
    facilityName: 'Apex Institute of Cardiovascular Sciences',
    documentDate: '2025-06-10',
    isSamplePreset: true,
    ocrRawText: `APEX INSTITUTE OF CARDIOVASCULAR SCIENCES
Discharge Summary
Patient: Mohd. Rafiq, 64/M
Admission: 05-Jun-2025 | Discharge: 10-Jun-2025
Diagnosis:
- Acute Inferior Wall Myocardial Infarction (STEMI)
- S/P Primary PCI to Right Coronary Artery (RCA) with DES (Drug Eluting Stent)
2D Echo: LVEF 45%, regional wall motion abnormality in RCA territory.
Discharge Medications:
1. Tab Ticagrelor 90 mg - 1-0-1 (Twice daily) - Mandatory DAPT
2. Tab Ecosprin 75 mg - 0-1-0 (After lunch)
3. Tab Metoprolol Succinate 25 mg - 1-0-0 (Morning)
4. Tab Rosuvastatin 40 mg - 0-0-1 (Bedtime)
5. Tab Pantoprazole 40 mg - 1-0-0 (Empty stomach)
Warning: Do not discontinue Ticagrelor or Aspirin without consulting cardiologist.`,
    extractedDiagnoses: [
      {
        id: 'diag_5',
        condition: 'Acute Inferior Wall STEMI (Post Primary PCI to RCA)',
        date: '2025-06-10',
        icd10Estimate: 'I21.1',
        confidence: 0.99,
        status: 'active',
      },
      {
        id: 'diag_6',
        condition: 'Coronary Artery Disease with Drug Eluting Stent',
        date: '2025-06-10',
        icd10Estimate: 'Z95.5',
        confidence: 0.97,
        status: 'active',
      },
    ],
    extractedMedications: [
      {
        id: 'med_5',
        name: 'Ticagrelor',
        dosage: '90 mg',
        frequency: '1-0-1 (Twice daily)',
        duration: '12 Months Mandatory',
        purpose: 'Antiplatelet Stent Thrombosis Prevention',
        confidence: 0.99,
        sourceDocName: 'Apex Cardiology Discharge',
      },
      {
        id: 'med_6',
        name: 'Rosuvastatin',
        dosage: '40 mg',
        frequency: '0-0-1 (Bedtime)',
        duration: 'Lifelong',
        purpose: 'High Intensity Statin Therapy',
        confidence: 0.98,
        sourceDocName: 'Apex Cardiology Discharge',
      },
      {
        id: 'med_7',
        name: 'Metoprolol Succinate',
        dosage: '25 mg',
        frequency: '1-0-0 (Morning)',
        duration: 'Lifelong',
        purpose: 'Beta Blocker Post-MI Cardioprotection',
        confidence: 0.96,
        sourceDocName: 'Apex Cardiology Discharge',
      },
    ],
    extractedLabValues: [
      {
        id: 'lab_9',
        testName: 'Echocardiography LVEF',
        value: '45',
        unit: '%',
        referenceRange: '55 - 70',
        status: 'abnormal',
        confidence: 0.95,
        date: '2025-06-08',
      },
    ],
  },
];

// Parser to extract clinical entities from raw text (OCR or LLM output)
export function parseMedicalText(rawText: string, docName: string): {
  diagnoses: ExtractedDiagnosis[];
  medications: ExtractedMedication[];
  labValues: ExtractedLabValue[];
} {
  const diagnoses: ExtractedDiagnosis[] = [];
  const medications: ExtractedMedication[] = [];
  const labValues: ExtractedLabValue[] = [];

  const lines = rawText.split('\n');

  // Regex patterns for Indian clinical prescriptions
  const medRegex = /(?:Tab|Cap|Syp|Inj)?\.?\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(\d+\s*(?:mg|mcg|ml|g|IU))\s*[-–—:]?\s*(\d-\d-\d|\bOD\b|\bBD\b|\bTDS\b|\bQID\b|\bHS\b|\bSOS\b|[A-Za-z\s]+)?/i;
  const labRegex = /([A-Za-z0-9\s/()\-]+)[:=]\s*([\d.,]+|\bPOSITIVE\b|\bNEGATIVE\b|\bREACTIVE\b)\s*([a-zA-Z/%μuL]+)?/i;

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check for medication
    const medMatch = trimmed.match(medRegex);
    if (medMatch && medMatch[1].length > 2) {
      const drugName = medMatch[1].trim();
      const dosage = medMatch[2] ? medMatch[2].trim() : '';
      const freq = medMatch[3] ? medMatch[3].trim() : 'As directed';

      medications.push({
        id: `med_extracted_${Date.now()}_${idx}`,
        name: drugName,
        dosage,
        frequency: freq,
        confidence: 0.88,
        sourceDocName: docName,
      });
    }

    // Check for common chronic diagnoses
    if (/diabetes|t2dm|mellitus/i.test(trimmed)) {
      diagnoses.push({
        id: `diag_extracted_${idx}`,
        condition: 'Type 2 Diabetes Mellitus',
        confidence: 0.92,
        status: 'active',
      });
    }
    if (/hypertension|htn|high bp/i.test(trimmed)) {
      diagnoses.push({
        id: `diag_extracted_htn_${idx}`,
        condition: 'Essential Hypertension',
        confidence: 0.91,
        status: 'active',
      });
    }
    if (/dengue/i.test(trimmed)) {
      diagnoses.push({
        id: `diag_extracted_dengue_${idx}`,
        condition: 'Suspected Dengue Viral Infection',
        confidence: 0.95,
        status: 'active',
      });
    }
    if (/stemi|myocardial infarction|heart attack|angina/i.test(trimmed)) {
      diagnoses.push({
        id: `diag_extracted_cad_${idx}`,
        condition: 'Coronary Artery Disease / Post-MI',
        confidence: 0.96,
        status: 'active',
      });
    }

    // Check for lab values
    const labMatch = trimmed.match(labRegex);
    if (labMatch && labMatch[1].length > 2) {
      const param = labMatch[1].trim();
      const val = labMatch[2].trim();
      const unit = labMatch[3] ? labMatch[3].trim() : '';

      let status: 'normal' | 'abnormal' | 'critical' = 'normal';
      if (/platelet/i.test(param) && parseFloat(val.replace(/,/g, '')) < 100000) {
        status = 'critical';
      } else if (/dengue/i.test(param) && /positive|reactive/i.test(val)) {
        status = 'critical';
      } else if (/glucose|sugar|hba1c/i.test(param)) {
        status = 'abnormal';
      }

      if (/platelet|glucose|sugar|hba1c|creatinine|hemoglobin|wbc|tlc|dengue/i.test(param)) {
        labValues.push({
          id: `lab_extracted_${idx}`,
          testName: param,
          value: val,
          unit,
          referenceRange: 'Standard',
          status,
          confidence: 0.89,
        });
      }
    }
  });

  return { diagnoses, medications, labValues };
}

// Builds a unified, sorted chronological medical timeline from uploaded documents
export function buildChronologicalTimeline(docs: UploadedMedicalDocument[]): MedicalTimelineEvent[] {
  const events: MedicalTimelineEvent[] = [];

  docs.forEach((doc) => {
    const docDate = doc.documentDate || doc.uploadTimestamp.split('T')[0] || 'Prior Record';

    // Document Visit Event
    events.push({
      id: `ev_visit_${doc.id}`,
      date: docDate,
      title: `${doc.type === 'prescription' ? 'OPD Prescription' : doc.type === 'lab_report' ? 'Laboratory Investigations' : 'Hospital Discharge Summary'}`,
      category: 'opd_visit',
      details: `${doc.facilityName || 'Healthcare Facility'} (${doc.doctorName || 'Attending Physician'})`,
      sourceDocName: doc.name,
      confidenceScore: 0.95,
    });

    // Diagnoses events
    doc.extractedDiagnoses.forEach((diag) => {
      events.push({
        id: `ev_diag_${diag.id}`,
        date: diag.date || docDate,
        title: `Diagnosis: ${diag.condition}`,
        category: 'diagnosis',
        details: `Identified with ${Math.round(diag.confidence * 100)}% clinical confidence. Status: ${diag.status.toUpperCase()}`,
        sourceDocName: doc.name,
        confidenceScore: diag.confidence,
      });
    });

    // Lab events
    doc.extractedLabValues.forEach((lab) => {
      events.push({
        id: `ev_lab_${lab.id}`,
        date: lab.date || docDate,
        title: `${lab.testName}: ${lab.value} ${lab.unit}`,
        category: 'lab_result',
        details: `Ref: ${lab.referenceRange} | Evaluated Status: ${lab.status.toUpperCase()}`,
        sourceDocName: doc.name,
        criticalFlag: lab.status === 'critical',
        confidenceScore: lab.confidence,
      });
    });

    // Key medication milestones
    if (doc.extractedMedications.length > 0) {
      const medListSummary = doc.extractedMedications.map((m) => `${m.name} ${m.dosage} (${m.frequency})`).join(', ');
      events.push({
        id: `ev_meds_${doc.id}`,
        date: docDate,
        title: `Medication Regimen (${doc.extractedMedications.length} drugs)`,
        category: 'medication',
        details: medListSummary,
        sourceDocName: doc.name,
        confidenceScore: 0.92,
      });
    }
  });

  // Sort chronologically (newest first for clinical quick-glance)
  return events.sort((a, b) => b.date.localeCompare(a.date));
}
