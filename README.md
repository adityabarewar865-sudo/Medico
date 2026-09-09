# 🏥 Medikiosk
### Central Hospital AI Patient Case-Taking, Multi-Visit EMR & Triage Workstation

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.2-purple.svg)](https://vitejs.dev/)
[![Express](https://img.shields.io/badge/Express-5.2-green.svg)](https://expressjs.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-teal.svg)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange.svg)](https://firebase.google.com/)
[![ABDM](https://img.shields.io/badge/ABDM-M1%20%26%20M2%20Compliant-orange.svg)](https://abdm.gov.in/)
[![FHIR](https://img.shields.io/badge/HL7-FHIR%20R4%20(NRCeS)-red.svg)](https://nrces.in/)

**Medikiosk** is an AI-powered hospital patient-record and clinical case-taking web platform built for high-volume public and private hospital Outpatient Departments (OPDs). It unites **3 distinct user roles**:
1. **Patient**: Direct walk-in touchscreen & voice-guided kiosk (zero login, zero registration).
2. **Reception**: Authorized portal for registering new patients, searching records, and creating new visits under the same Patient ID.
3. **Doctor**: Authorized clinical workstation with multi-visit history review, complete medicine history, AI clinical summary review, inline editing, verification, rejection, and prescription authoring.

---

## 🌟 Core System Highlights

### 1. 3 Dedicated User Roles & Access Control
- **👤 Patient Flow (No Login, Zero Friction)**:
  - Directly opens the case-taking screen. No password, username, or account creation required.
  - Automatically identifies returning patients by phone or Patient ID (e.g. `Rahul Sharma - P10025`), attaching their intake as a new visit instead of creating duplicate records.
  - Multilingual voice-guided interface (Hindi, English, Bengali, Tamil, Telugu, Marathi).
  - Touchscreen-friendly, adaptive inquiries, OCR document extraction, and OPD token generation.
- **🏢 Reception Dashboard (Authorized Login)**:
  - Secure login with 1-click demo access (`reception` / `hospital123`).
  - **Register New Patient**: Enters basic details and generates unique **Patient ID** (e.g., `P10028`).
  - **Search Existing Patient**: Instant search by Patient ID, Name, or Phone number.
  - **Existing Patient Found**: Displays demographics, total visits count, and chronological past visits.
  - **Start New Visit**: Creates a new visit (`V002`, `V003`...) under the same Patient ID with room and doctor assignment.
- **🩺 Doctor Workstation (Authorized Login)**:
  - Secure login with 1-click demo access (`doctor` / `doctor123`).
  - Search patient by Patient ID, Name, or Phone.
  - Real-time OPD triage queue (Emergency Red Flag, Urgent, Routine).
  - **Multi-Visit Selector**: Toggle between the current visit and any previous visits.
  - **AI Clinical Case Summary**: Review, edit narrative inline, verify & sign, or reject incorrect AI output with audit reasons.
  - **Complete Medicine History**: Full chronological record of all medicines ever prescribed across all visits with Medicine Name, Dosage, Frequency, Date Prescribed, Doctor, and Associated Visit ID.
  - Bedside Vitals capture, Prescription Builder, Medical Timeline, Original Scans & OCR view, ABDM FHIR bundle generator, and printable official OPD slips.

### 2. Conceptual Hierarchy & Central Database
```
Hospital → Patients → Visits → Medical Information → Medicines → Reports
```
- **Unique Patient ID**: Formatted as `P10025`, `P10026`, etc.
- **Multi-Visit Architecture**: Visits are numbered `V001`, `V002`, etc., preserving previous clinical notes and prescriptions without overwriting history.
- **Persistent Central Storage**:
  - **Firebase Firestore**: Ready for cloud sync with configurable `VITE_FIREBASE_*` environment variables.
  - **Express REST Backend**: `/api/patients` with atomic disk persistence (`server/data/encounters.json` / `server/data/patients.json`).
  - **LocalStorage Cache**: Ensures 100% data persistence across browser reloads even in offline conditions.

---

## 🚀 Quick Start

### 1. Install & Build
```bash
npm install
npm run build
```

### 2. Run Development Server
```bash
# Terminal 1: Run Vite Frontend (:5173)
npm run dev

# Terminal 2: Run Express Backend (:5000)
npm run server
```

### 3. Demo Credentials
- **Patient**: Direct access (no credentials needed)
- **Reception**: Username `reception` | Password `hospital123` (or click **⚡ 1-Click Instant Demo Login**)
- **Doctor**: Username `doctor` | Password `doctor123` (or click **⚡ 1-Click Instant Demo Login**)
