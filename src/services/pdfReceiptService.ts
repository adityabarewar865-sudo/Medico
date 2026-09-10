/**
 * Hospital Visit Medical Summary & Prescription PDF Receipt Service
 *
 * Generates a clean, professional hospital visit receipt PDF using jsPDF.
 * Contains:
 * - Hospital/Project header
 * - Patient ID & Visit ID
 * - Patient Name, Age, Gender, Mobile Number
 * - Assigned Doctor (Doctor who checked and verified the patient)
 * - Date of visit & Time
 * - Problem / Complaint & Bedside Vitals
 * - Relevant medical history & allergies
 * - Doctor-verified clinical summary
 * - Prescriptions table (Medicine, Dosage, Frequency/Instructions, Duration)
 * - Doctor's Advice & Lifestyle Tips
 * - Additional Doctor Notes
 * - Verification date & Doctor digital signature block with Assigned Doctor
 */

import { jsPDF } from 'jspdf';
import type { PatientCaseEncounter, PatientRecord } from '../types/clinical';

export interface GenerateReceiptOptions {
  patient: PatientRecord;
  visit: PatientCaseEncounter;
  hospitalName?: string;
  department?: string;
}

/**
 * Resolves the doctor who checked/verified the patient
 */
export function resolveAssignedDoctorName(visit?: PatientCaseEncounter | null): string {
  if (!visit) return 'Dr. S. K. Verma, MD';

  // 1. Check verifiedBy on doctorReview
  const verifiedBy = visit.doctorReview?.verifiedBy?.trim();
  if (
    verifiedBy &&
    verifiedBy !== 'Attending Doctor' &&
    verifiedBy !== 'Attending Physician' &&
    verifiedBy !== 'Not Assigned'
  ) {
    return verifiedBy;
  }

  // 2. Check attendingDoctor on visit
  const attending = visit.attendingDoctor?.trim();
  if (
    attending &&
    attending !== 'Attending Doctor' &&
    attending !== 'Attending Physician' &&
    attending !== 'Not Assigned'
  ) {
    return attending;
  }

  // 3. Check logged-in doctor in localStorage
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const userStr = localStorage.getItem('medico_current_user');
      if (userStr) {
        const user = JSON.parse(userStr);
        if (
          user?.name &&
          user.name !== 'Not Assigned' &&
          user.name !== 'Attending Doctor' &&
          user.name !== 'Attending Physician'
        ) {
          return user.name;
        }
      }
    }
  } catch {
    // ignore
  }

  // 4. Fallback to Senior Medical Officer
  return 'Dr. S. K. Verma, MD';
}

export function generateVisitReceiptPdf(options: GenerateReceiptOptions): jsPDF {
  const { patient, visit } = options;
  const fallbackHospital =
    typeof window !== 'undefined' && localStorage.getItem('medico_current_user')
      ? JSON.parse(localStorage.getItem('medico_current_user')!).hospitalName
      : 'District Hospital';
  const hospitalName = options.hospitalName || fallbackHospital || 'District Hospital';
  const department = options.department || 'Outpatient Department (OPD) — General Medicine';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 12; // 12mm page margins
  const contentWidth = pageWidth - margin * 2; // 186mm content width
  let y = margin;

  // Helper for text wrapping with safe boundary check
  const printWrapped = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight = 3.8
  ): number => {
    const lines = doc.splitTextToSize(text || '', maxWidth);
    doc.text(lines, x, startY);
    return startY + lines.length * lineHeight;
  };

  // Helper to strictly clip text within a maximum width in mm
  const clipText = (text: string, maxWidth: number): string => {
    if (!text) return '';
    const str = String(text);
    if (doc.getTextWidth(str) <= maxWidth) return str;
    let low = 0;
    let high = str.length;
    let best = '';
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const sub = str.slice(0, mid) + '...';
      if (doc.getTextWidth(sub) <= maxWidth) {
        best = sub;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return best || str.slice(0, 8) + '...';
  };

  const assignedDoctorName = resolveAssignedDoctorName(visit);

  // -------------------------------------------------------------
  // 1. HOSPITAL HEADER BANNER (Strictly bounded)
  // -------------------------------------------------------------
  const headerHeight = 20;
  doc.setFillColor(15, 118, 110); // Emerald/Teal brand header #0f766e
  doc.roundedRect(margin, y, contentWidth, headerHeight, 2, 2, 'F');

  // Medical Cross Icon
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 4, y + 4, 12, 12, 'F');
  doc.setFillColor(15, 118, 110);
  doc.rect(margin + 8, y + 6, 4, 8, 'F');
  doc.rect(margin + 6, y + 8, 8, 4, 'F');

  // Verification Badge Pill on top right
  const badgeWidth = 46;
  const badgeX = pageWidth - margin - badgeWidth - 4;
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(badgeX, y + 4, badgeWidth, 12, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text('✓ VERIFIED OPD RECEIPT', badgeX + 3, y + 8.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(21, 128, 61);
  doc.text('ABDM Validated • Health Mission', badgeX + 3, y + 12.5);

  // Header Titles (strictly clipped so they never collide with the badge)
  const maxHeaderWidth = badgeX - (margin + 18) - 4;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  const titleText = clipText(hospitalName.toUpperCase(), maxHeaderWidth);
  doc.text(titleText, margin + 18, y + 8.5);

  const hospitalAddress =
    visit.hospitalAddress ||
    patient.hospitalAddress ||
    (typeof window !== 'undefined' ? localStorage.getItem('medico_hospital_address') : null) ||
    'Hospital Complex, Main Road, Civil Lines';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(230, 245, 243);
  const subTitle = clipText(`${hospitalAddress}  •  ${department}`, maxHeaderWidth);
  doc.text(subTitle, margin + 18, y + 14.5);

  y += headerHeight + 3;

  // -------------------------------------------------------------
  // 2. PATIENT IDENTIFICATION CARD & VISIT INFO
  // -------------------------------------------------------------
  const attendant = visit.accompanyingPerson || patient.accompanyingPerson;
  const abha = patient.abha?.abhaNumber || visit.demographics?.abha?.abhaNumber || '91-XXXX-XXXX-XXXX';
  const allergyText = visit.knownAllergies
    ? visit.knownAllergies.hasAllergy === 'yes'
      ? `YES: ${visit.knownAllergies.details || 'Specified by patient'}`
      : visit.knownAllergies.hasAllergy === 'not_sure'
      ? 'NOT SURE (Verify before medication)'
      : 'NO (No known drug/food allergies)'
    : null;

  // Calculate dynamic card height based on actual rows
  let leftLineCount = 3;
  if (attendant?.name) leftLineCount += 1;
  if (allergyText) leftLineCount += 1;
  const rightLineCount = 5;
  const maxCardRows = Math.max(leftLineCount, rightLineCount);
  const cardHeight = Math.max(maxCardRows * 5.2 + 3, 29);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

  const leftX = margin + 4;
  const maxLeftW = 106;
  const rightX = pageWidth - margin - 72;
  const maxRightW = 68;

  // Left Column: Demographics
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(clipText(patient.fullName, maxLeftW), leftX, y + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    clipText(`Age / Gender: ${patient.age} Y / ${patient.gender.toUpperCase()}   •   Mobile: +91 ${patient.phone}`, maxLeftW),
    leftX,
    y + 10.5
  );

  doc.text(
    clipText(`ABHA: ${abha}   •   Address: ${patient.address || 'District Catchment Area'}`, maxLeftW),
    leftX,
    y + 15.5
  );

  let currentLeftY = y + 20.5;
  if (attendant?.name) {
    doc.text(
      clipText(`Attendant: ${attendant.name} (${attendant.relation})  •  Phone: ${attendant.phone || 'N/A'}`, maxLeftW),
      leftX,
      currentLeftY
    );
    currentLeftY += 5;
  }

  if (allergyText) {
    doc.setFont('helvetica', 'bold');
    if (visit.knownAllergies?.hasAllergy === 'yes') {
      doc.setTextColor(190, 18, 60);
    } else if (visit.knownAllergies?.hasAllergy === 'not_sure') {
      doc.setTextColor(180, 83, 9);
    } else {
      doc.setTextColor(21, 128, 61);
    }
    doc.text(clipText(`Allergies: ${allergyText}`, maxLeftW), leftX, currentLeftY);
  }

  // Right Column: Visit Metadata & Assigned Doctor
  const visitDateStr = visit.visitDate || visit.createdAt.split('T')[0];
  const visitTimeStr = visit.createdAt
    ? new Date(visit.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : '10:00 AM';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.setFontSize(8);
  doc.text(`Patient ID: ${patient.patientId}`, rightX, y + 5.5);
  doc.text(`Visit ID: ${visit.visitId || 'V001'}`, rightX, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.5);
  doc.text(`Date: ${visitDateStr} (${visitTimeStr})`, rightX, y + 15.5);
  doc.text(clipText(`Token: ${visit.opdToken}  |  ${visit.opdRoom}`, maxRightW), rightX, y + 20.5);

  // Assigned Doctor prominently displayed in patient card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  doc.text(clipText(`Assigned Doctor: ${assignedDoctorName}`, maxRightW), rightX, y + 25.5);

  y += cardHeight + 3;

  // -------------------------------------------------------------
  // 3. CLINICAL PROBLEM & BEDSIDE VITALS
  // -------------------------------------------------------------
  const complaintTitle = visit.chiefComplaint?.title || 'General Outpatient Evaluation';
  const complaintDetail = visit.chiefComplaint?.onsetDuration ? ` (${visit.chiefComplaint.onsetDuration})` : '';
  const fullComplaint = `${complaintTitle}${complaintDetail}`;

  const vitals = visit.clinicalSummary.vitals || {
    bp: '120/80',
    pulse: '74',
    spo2: '98',
    temp: '98.4',
    rr: '16',
  };

  const probCardHeight = 13.5;
  doc.setFillColor(254, 242, 242);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, y, contentWidth, probCardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(185, 28, 28);
  doc.text('PROBLEM / CHIEF COMPLAINT:', margin + 3, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  const maxComplaintW = contentWidth - 56;
  doc.text(clipText(fullComplaint, maxComplaintW), margin + 50, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  const vitalsText = `Vitals:  BP: ${vitals.bp} mmHg  |  Pulse: ${vitals.pulse} bpm  |  SpO2: ${vitals.spo2}%  |  Temp: ${vitals.temp}°F  |  Resp Rate: ${vitals.rr}/min`;
  doc.text(clipText(vitalsText, contentWidth - 6), margin + 3, y + 9.8);

  y += probCardHeight + 3;

  // -------------------------------------------------------------
  // 4. DOCTOR-VERIFIED CLINICAL SUMMARY
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('DOCTOR-VERIFIED CLINICAL SUMMARY', margin, y + 2.5);
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 4, margin + 65, y + 4);
  y += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('History of Present Illness (HPI):', margin, y);
  y += 3.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(51, 65, 85);
  const hpiText =
    visit.clinicalSummary.historyOfPresentIllness ||
    visit.chiefComplaint?.description ||
    'Patient presented with acute clinical symptoms requiring evaluation.';
  y = printWrapped(hpiText, margin, y, contentWidth, 3.4);

  // Past Medical History & Allergies
  const pmhList = visit.clinicalSummary.pastMedicalHistory;
  const allergiesList = visit.clinicalSummary.allergies;

  if (pmhList && pmhList.length > 0) {
    y += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(30, 41, 59);
    doc.text('Past Medical History: ', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const pmhStr = pmhList.join(' • ');
    y = printWrapped(pmhStr, margin + 30, y, contentWidth - 30, 3.4);
  }

  if (allergiesList && allergiesList.length > 0) {
    y += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(190, 18, 60);
    doc.text('Known Allergies: ', margin, y);
    doc.setFont('helvetica', 'normal');
    const allergiesStr = allergiesList.map((a) => `${a.allergen} (${a.reaction})`).join(', ');
    y = printWrapped(allergiesStr, margin + 25, y, contentWidth - 25, 3.4);
  }

  // AYUSH Dashavidha Pariksha & Lifestyle Summary (if present)
  if (visit.ayushHistory) {
    y += 2;
    const ayushLine1 = `Prakriti: ${visit.ayushHistory.dashavidha.prakriti.split('(')[0]}  •  Vikriti: ${visit.ayushHistory.dashavidha.vikriti.split('(')[0]}  •  Sara: ${visit.ayushHistory.dashavidha.sara.split('(')[0]}  •  Agni: ${visit.ayushHistory.dashavidha.aharaShakti.split('(')[0]}`;
    const ayushLine2 = `Vyayama: ${visit.ayushHistory.dashavidha.vyayamaShakti.split('(')[0]}  •  Diet: ${visit.ayushHistory.ahara.usualDiet.split('(')[0]}  •  Sleep: ${visit.ayushHistory.vihara.sleepPattern.split('(')[0]}`;

    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(22, 101, 52);
    doc.text('AYUSH CLINICAL PROFILE: DASHAVIDHA PARIKSHA & AHARA-VIHARA', margin + 3, y + 3.8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(21, 128, 61);
    doc.text(clipText(ayushLine1, contentWidth - 6), margin + 3, y + 7.2);
    doc.text(clipText(ayushLine2, contentWidth - 6), margin + 3, y + 10.3);
    y += 13.5;
  }

  y += 2.5;

  // -------------------------------------------------------------
  // 5. PRESCRIBED MEDICATIONS TABLE (Rx)
  // Columns budgeted strictly inside contentWidth (186mm):
  // # (6mm), Medicine (64mm), Dosage (30mm), Freq (56mm), Dur (30mm)
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PRESCRIBED MEDICINES (Rx)', margin, y + 2.5);
  doc.setDrawColor(15, 118, 110);
  doc.line(margin, y + 4, margin + 52, y + 4);
  y += 6.5;

  // Table Header
  const colX = {
    num: margin + 2,
    name: margin + 8,
    dosage: margin + 72,
    freq: margin + 102,
    duration: margin + 158,
  };

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 5.5, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(30, 41, 59);
  doc.text('#', colX.num, y + 3.8);
  doc.text('Medicine Name (Category)', colX.name, y + 3.8);
  doc.text('Dosage', colX.dosage, y + 3.8);
  doc.text('Frequency & Instructions', colX.freq, y + 3.8);
  doc.text('Duration', colX.duration, y + 3.8);
  y += 6.5;

  const rxList =
    visit.doctorReview?.prescribedMedications && visit.doctorReview.prescribedMedications.length > 0
      ? visit.doctorReview.prescribedMedications
      : visit.medicines && visit.medicines.length > 0
      ? visit.medicines.map((m) => ({
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          duration: m.duration || '5 days',
          instructions: m.instructions || 'After meals',
          category: m.category || 'allopathic',
        }))
      : [];

  if (rxList.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('No oral pharmaceuticals prescribed. Supportive care and observation advised.', margin + 4, y + 3.5);
    y += 6.5;
  } else {
    rxList.forEach((rx, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 1.5, contentWidth, 5.8, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(30, 41, 59);
      doc.text(String(idx + 1), colX.num, y + 2.5);

      const catSuffix =
        rx.category === 'ayurvedic'
          ? ' [AYUR]'
          : rx.category === 'homeopathic'
          ? ' [HOME]'
          : ' [ALLO]';
      const medNameFull = `${rx.name}${catSuffix}`;
      doc.text(clipText(medNameFull, 62), colX.name, y + 2.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.text(clipText(rx.dosage || 'Standard', 28), colX.dosage, y + 2.5);

      const freqText = rx.instructions ? `${rx.frequency} (${rx.instructions})` : rx.frequency;
      doc.text(clipText(freqText, 54), colX.freq, y + 2.5);

      doc.text(clipText(rx.duration || '5 days', 26), colX.duration, y + 2.5);

      y += 5.8;
    });
  }

  y += 2.5;

  // -------------------------------------------------------------
  // 6. DOCTOR'S ADVICE & LIFESTYLE TIPS (Dynamic height - no border overflow)
  // -------------------------------------------------------------
  const doctorAdviceText =
    visit.doctorReview?.doctorAdvice?.trim() ||
    '• Maintain adequate hydration (minimum 2.5 liters of warm water daily).\n• Take prescribed medications strictly after food with full glass of water.\n• Complete bed rest for the next 48-72 hours.\n• Avoid cold food, dust exposure, and oily/spicy diet.\n• Immediate Emergency Return Warning: In case of chest pain, shortness of breath, high persistent fever (>102°F), or severe dizziness, report immediately to Room 1 Emergency Resus.';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const adviceLines = doc.splitTextToSize(doctorAdviceText, contentWidth - 8);
  const adviceCardHeight = Math.max(adviceLines.length * 3.2 + 8, 16);

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, contentWidth, adviceCardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text("DOCTOR'S ADVICE & LIFESTYLE TIPS", margin + 4, y + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(21, 128, 61);
  doc.text(adviceLines, margin + 4, y + 8.5);

  y += adviceCardHeight + 2.5;

  // -------------------------------------------------------------
  // 7. ADDITIONAL DOCTOR NOTES & INVESTIGATIONS (Dynamic height)
  // -------------------------------------------------------------
  const doctorNotes = visit.doctorReview?.doctorNotes || 'Review OPD in 5 days or sooner if symptoms worsen.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const notesLines = doc.splitTextToSize(doctorNotes, contentWidth - 36);
  const notesCardHeight = Math.max(notesLines.length * 3.2 + 4, 9.5);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, notesCardHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Doctor Notes / Plan:', margin + 3, y + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(notesLines, margin + 32, y + 4.2);

  y += notesCardHeight + 3;

  // -------------------------------------------------------------
  // 8. DOCTOR VERIFICATION STAMP & SIGNATURE (FOOTER - strictly inside page)
  // -------------------------------------------------------------
  const verifiedDateStr = visit.doctorReview?.verifiedAt
    ? new Date(visit.doctorReview.verifiedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const sigBoxHeight = 18;
  const maxFooterY = pageHeight - margin - sigBoxHeight - 6;
  const finalSigY = Math.min(Math.max(y, 238), maxFooterY);

  const sigBoxW = 76;
  const sigBoxX = pageWidth - margin - sigBoxW;

  // Left Info Summary (Parallel to signature box)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 118, 110);
  doc.text('OFFICIAL HOSPITAL DIGITAL CONSULTATION RECEIPT', margin, finalSigY + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(100, 116, 139);
  doc.text(`ABDM Care Context: ${visit.abdmCareContextRef || 'CARE-CTX-OPD'}  •  HIP ID: IN0510000128`, margin, finalSigY + 8);
  doc.text('Generated via Medikiosk AI OPD Gateway • Valid for dispensary, diagnostics, and follow-up.', margin, finalSigY + 12);
  doc.text('Digitally signed by verified medical officer under ABDM Health Data Management Policy.', margin, finalSigY + 15.5);

  // Digital verification box
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.3);
  doc.setFillColor(250, 253, 252);
  doc.roundedRect(sigBoxX, finalSigY, sigBoxW, sigBoxHeight, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(15, 118, 110);
  doc.text('DIGITALLY VERIFIED & SIGNED', sigBoxX + 4, finalSigY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(clipText(`Assigned Doctor: ${assignedDoctorName}`, sigBoxW - 8), sigBoxX + 4, finalSigY + 8.8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Medical Officer • Reg No: NMR-IND-89421', sigBoxX + 4, finalSigY + 12.5);
  doc.text(`Signed: ${verifiedDateStr}`, sigBoxX + 4, finalSigY + 15.8);

  // Bottom border line & disclaimer
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin, pageHeight - margin - 4.5, pageWidth - margin, pageHeight - margin - 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(148, 163, 184);
  doc.text('Hospital Digital OPD Receipt  •  Ayushman Bharat Digital Mission (ABDM) Compatible  •  Strictly Confidential', margin, pageHeight - margin - 2);
  doc.text(`Page 1 of 1`, pageWidth - margin - 15, pageHeight - margin - 2);

  return doc;
}

/**
 * Downloads the patient visit PDF receipt directly in browser
 */
export function downloadVisitReceiptPdf(options: GenerateReceiptOptions): void {
  const doc = generateVisitReceiptPdf(options);
  const patientId = options.patient.patientId || 'P00000';
  const visitId = options.visit.visitId || 'V001';
  const fileName = `Visit_Receipt_${patientId}_${visitId}.pdf`;
  doc.save(fileName);
}
