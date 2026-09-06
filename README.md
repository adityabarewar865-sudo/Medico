# 🏥 Medico
### Hospital AI Patient Case-Taking, Triage & ABDM Clinical Workstation

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-purple.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.2-green.svg)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-teal.svg)](https://tailwindcss.com/)
[![ABDM](https://img.shields.io/badge/ABDM-M1%20%26%20M2%20Compliant-orange.svg)](https://abdm.gov.in/)
[![FHIR](https://img.shields.io/badge/HL7-FHIR%20R4%20(NRCeS)-red.svg)](https://nrces.in/)

**Medico** is an AI-powered multilingual patient case-taking and triage web platform built for high-volume public hospital Outpatient Departments (OPDs). It addresses long wait lines, language barriers, and low literacy by providing an accessible, voice-guided touchscreen kiosk for patients, paired with a real-time clinical workstation for doctors linked with the **Ayushman Bharat Digital Mission (ABDM)** and **Hospital Information System (HIS)**.

---

## 🌟 Key Features

### 1. OPD Mitra Patient Kiosk Mode
- **🗣️ Multilingual Support**: 6 Indian languages with real-time switching:
  - **हिंदी (Hindi)**, **English**, **বাংলা (Bengali)**, **मराठी (Marathi)**, **తెలుగు (Telugu)**, and **தமிழ் (Tamil)**.
- **🎙️ Voice-First Accessibility**:
  - Web Speech Synthesis (TTS) reads aloud every prompt, question, and consent clause.
  - Vernacular Speech-to-Text (STT) dictation allows patients to speak their symptoms in their native tongue.
- **🆔 ABHA ID Linking (ABDM M1)**:
  - Simulates Ayushman Bharat Health Account OTP verification.
  - Generates authentic ABHA Digital Health Card with QR code.
- **🛡️ Informed Vernacular Consent**:
  - Audio-visual explanation of AI case summarization and health data linking.
- **🩺 Adaptive Clinical Inquiry (OPQRST Framework)**:
  - Dynamically asks intelligent follow-up questions tailored to chief complaint (Onset, Severity, Character, Radiation, Triggers, Relieving factors).
- **📄 Document Scanner & OCR Timeline**:
  - Uploads past hospital prescriptions, lab reports, and discharge summaries.
  - AI & OCR automatically extract diagnoses, medications with frequencies (e.g. `1-0-1`), and panic lab values into a chronological Medical Timeline.
- **🎟️ OPD Token Generation**:
  - Assigns priority-coded OPD token (e.g. `OPD-MED-042`), room assignment, QR code, and voice announcement.

### 2. e-Dhanvantari Doctor Clinical Workstation
- **🚨 Real-Time Triage Queue**:
  - Sorts patient arrivals instantly into **Emergency (Red Flag)**, **Urgent (Amber)**, and **Routine (Green)**.
  - Emergency cases trigger visual and audible warnings.
- **📋 AI Clinical Case Sheet**:
  - Synthesized History of Present Illness (HPI) with inline editing.
  - Reconciled past medical history and current medications from previous prescriptions.
- **🩺 Bedside Vitals Recorder**:
  - Nursing station vitals capture (BP, Pulse, SpO2, Temperature, Respiratory Rate).
- **℞ Prescription Builder**:
  - Search and author medications with drug name, dosage, frequency, duration, and patient instructions.
  - Input differential diagnoses and clinical impression notes.
- **📑 Scanned Records & OCR Viewer**:
  - Side-by-side inspection of original prescription scans and raw OCR extracted clinical entities.
- **🏛️ Hospital Information System (HIS) Synchronization**:
  - One-click digital sign-off and synchronization to the hospital database with transaction ACK and hospital MRN.
- **🌐 ABDM HL7 FHIR (R4) Document Bundle (ABDM M2)**:
  - Generates NRCeS-compliant HL7 FHIR R4 Document Bundle (`Bundle`, `Composition`, `Patient`, `Encounter`, `Condition`, `MedicationRequest`, `Observation`).
- **🖨️ Printable Official OPD Slip**:
  - Standard government hospital consultation slip with barcode, ABHA QR code, doctor signature, and Rx list.

### 3. UI Appearance & Themes
- **☀️ Light Mode (Hospital Day)**: Crisp white cards, soft slate canvas (`#f8fafc`), high contrast dark slate typography.
- **🌙 Dark Mode (Night Shift)**: Deep obsidian canvas (`#030712`), dark slate cards, luminous triage chips.
- **👁️ WCAG High-Contrast Mode**: Enhanced border contrast for visually impaired or elderly patients.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────┐
│               FRONTEND (React + Vite) :5173                │
│  - Multilingual Patient Kiosk (Voice STT/TTS, Touch, ABHA) │
│  - Doctor Clinical Workstation (Triage Queue, Case Sheet)  │
│  - Real-Time API Client & SSE EventSource Listener         │
└──────────────────────────────┬─────────────────────────────┘
                               │ Vite Proxy: /api/*
                               ▼
┌────────────────────────────────────────────────────────────┐
│                BACKEND (Express.js) :5000                  │
│  - REST API Endpoints (/api/patients, /api/health, etc.)   │
│  - SSE Broadcasting Hub (/api/events)                      │
│  - ABDM HL7 FHIR (R4) Document Bundle Generator            │
│  - Hospital Information System (HIS) Sync Gateway          │
│  - OCR Clinical Entity Extraction Engine                   │
└──────────────────────────────┬─────────────────────────────┘
                               │ Atomic Persistence
                               ▼
┌────────────────────────────────────────────────────────────┐
│      PERSISTENT DATABASE (server/data/encounters.json)     │
│  - Multi-encounter clinical data repository                │
│  - Auto-seeded with realistic Emergency/Urgent cases       │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v18+ or v24+)
- npm or yarn

### 1. Installation
```bash
git clone <repository-url>
cd "prototype 2"
npm install
```

### 2. Run Backend Server (Port 5000)
```bash
npm run server
```

### 3. Run Frontend Development Server (Port 5173)
```bash
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) in your web browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :---: | :--- | :--- |
| `GET` | `/api/health` | System health, uptime, and ABDM/HIS gateway status |
| `GET` | `/api/patients` | Fetch patient encounters with search, priority, and status filters |
| `POST` | `/api/patients` | Register new patient intake from Kiosk (assigns token & triggers SSE) |
| `GET` | `/api/patients/:id` | Fetch specific clinical encounter details |
| `POST` | `/api/patients/:id/doctor-review` | Save doctor clinical notes, impression, and prescriptions |
| `POST` | `/api/patients/:id/vitals` | Update bedside vitals (BP, Pulse, SpO2, Temp, RR) |
| `GET` | `/api/patients/:id/fhir` | Generate ABDM M1/M2 NRCeS HL7 FHIR (R4) Document Bundle |
| `POST` | `/api/his/sync` | Commit encounter to simulated Hospital Information System |
| `POST` | `/api/ocr/extract` | Extract clinical entities from prescription/lab reports |
| `GET` | `/api/events` | Server-Sent Events (SSE) stream for real-time queue synchronization |
| `POST` | `/api/patients/reset` | Re-seed demonstration queue |

---

## 📜 Standards & Compliance
- **Ayushman Bharat Digital Mission (ABDM)**: M1 (ABHA verification) & M2 (Care Context linking).
- **HL7 FHIR R4**: NRCeS Indian Core Health Data Profiles.
- **SNOMED CT & ICD-10**: Clinical terminology and diagnosis codification.
- **WCAG 2.1 AA**: Accessible touch targets, high contrast, and voice-guided assistance.

---

## 👨‍💻 Authors & License
Developed for Hackathon 2026. MIT License.
