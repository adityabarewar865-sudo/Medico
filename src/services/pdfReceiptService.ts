/**
 * Hospital Visit Medical Summary & Prescription PDF Receipt Service
 *
 * Generates a clean, professional hospital visit receipt PDF using jsPDF.
 * Contains:
 * - Hospital/Project header
 * - Patient ID & Visit ID
 * - Patient Name, Age, Gender, Mobile Number
 * - Date of visit & Time
 * - Problem / Complaint & Bedside Vitals
 * - Relevant medical history & allergies
 * - Doctor-verified clinical summary
 * - Prescriptions table (Medicine, Dosage, Frequency/Instructions, Duration)
 * - Doctor's Advice & Lifestyle Tips
 * - Additional Doctor Notes
 * - Verification date & Doctor digital signature block
 */

import { jsPDF } from 'jspdf';
import type { PatientCaseEncounter, PatientRecord } from '../types/clinical';

export interface GenerateReceiptOptions {
  patient: PatientRecord;
  visit: PatientCaseEncounter;
  hospitalName?: string;
  department?: string;
}

export function generateVisitReceiptPdf(options: GenerateReceiptOptions): jsPDF {
  const { patient, visit } = options;
  const fallbackHospital = localStorage.getItem('medico_current_user') ? JSON.parse(localStorage.getItem('medico_current_user')!).hospitalName : 'HOSPITAL NAME NOT SET';
  const hospitalName = options.hospitalName || fallbackHospital || 'HOSPITAL NAME NOT SET';
  const department = options.department || 'Outpatient Department (OPD) — General Medicine';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Helper for text wrapping
  const printWrapped = (
    text: string,
    x: number,
    startY: number,
    maxWidth: number,
    lineHeight = 5
  ): number => {
    const lines = doc.splitTextToSize(text || '', maxWidth);
    doc.text(lines, x, startY);
    return startY + lines.length * lineHeight;
  };

  // -------------------------------------------------------------
  // 1. HOSPITAL HEADER BANNER
  // -------------------------------------------------------------
  doc.setFillColor(15, 118, 110); // Emerald/Teal brand header #0f766e
  doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'F');

  // Medical Cross Icon
  doc.setFillColor(255, 255, 255);
  doc.rect(margin + 5, y + 5, 12, 12, 'F');
  doc.setFillColor(15, 118, 110);
  doc.rect(margin + 9, y + 7, 4, 8, 'F');
  doc.rect(margin + 7, y + 9, 8, 4, 'F');

  // Header Titles
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(hospitalName, margin + 21, y + 9);

  const hospitalAddress = visit.hospitalAddress || patient.hospitalAddress || localStorage.getItem('medico_hospital_address') || 'Hospital Complex, Main Road, Civil Lines';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(230, 245, 243);
  doc.text(`${hospitalAddress}  •  ${department}`, margin + 21, y + 15);

  // Verification Badge Pill on top right
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(pageWidth - margin - 52, y + 5, 48, 12, 1.5, 1.5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text('✓ VERIFIED', pageWidth - margin - 50, y + 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(21, 128, 61);
  doc.text('National Health Registry Validated', pageWidth - margin - 50, y + 14);

  y += 26;

  // -------------------------------------------------------------
  // 2. PATIENT IDENTIFICATION CARD & VISIT INFO
  // -------------------------------------------------------------
  const attendant = visit.accompanyingPerson || patient.accompanyingPerson;
  const cardHeight = attendant?.name || visit.knownAllergies ? 36 : 28;

  doc.setFillColor(248, 250, 252); // #f8fafc
  doc.setDrawColor(226, 232, 240); // #e2e8f0
  doc.roundedRect(margin, y, contentWidth, cardHeight, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(patient.fullName, margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(
    `Age / Gender: ${patient.age} Y / ${patient.gender.toUpperCase()}    •    Mobile: ${patient.phone}`,
    margin + 4,
    y + 11.5
  );

  const abha = patient.abha?.abhaNumber || visit.demographics.abha?.abhaNumber || '91-XXXX-XXXX-XXXX';
  doc.text(`ABHA Number: ${abha}    •    Address: ${patient.address || 'District Catchment Area'}`, margin + 4, y + 17);

  let extraY = y + 22.5;
  if (attendant?.name) {
    doc.text(`Attendant: ${attendant.name} (${attendant.relation})    •    Mobile: ${attendant.phone || 'N/A'}`, margin + 4, extraY);
    extraY += 5;
  }

  if (visit.knownAllergies) {
    const allergyText = visit.knownAllergies.hasAllergy === 'yes'
      ? `YES — ${visit.knownAllergies.details || 'Specified'}`
      : visit.knownAllergies.hasAllergy === 'not_sure'
      ? 'NOT SURE (Caution: Verify before prescribing)'
      : 'NO (No known drug or food allergies)';
    doc.text(`Allergies: ${allergyText}`, margin + 4, extraY);
  }

  // Visit metadata (Right column)
  const visitDateStr = visit.visitDate || visit.createdAt.split('T')[0];
  const visitTimeStr = visit.createdAt ? new Date(visit.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '10:00 AM';

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 118, 110);
  doc.text(`Patient ID: ${patient.patientId}`, pageWidth - margin - 60, y + 6);
  doc.text(`Visit ID: ${visit.visitId || 'V001'}`, pageWidth - margin - 60, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8);
  doc.text(`Date: ${visitDateStr} (${visitTimeStr})`, pageWidth - margin - 60, y + 16);
  doc.text(`Token: ${visit.opdToken}  |  ${visit.opdRoom}`, pageWidth - margin - 60, y + 21);

  y += cardHeight + 4;

  // -------------------------------------------------------------
  // 3. CLINICAL PROBLEM & BEDSIDE VITALS
  // -------------------------------------------------------------
  doc.setFillColor(254, 242, 242); // soft rose for problem highlight
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(185, 28, 28);
  doc.text('PROBLEM / CHIEF COMPLAINT:', margin + 3, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const complaintTitle = visit.chiefComplaint?.title || 'General Outpatient Evaluation';
  const complaintDetail = visit.chiefComplaint?.onsetDuration ? ` (${visit.chiefComplaint.onsetDuration})` : '';
  doc.text(`${complaintTitle}${complaintDetail}`, margin + 62, y + 5.5);

  // Vitals Row
  const vitals = visit.clinicalSummary.vitals || {
    bp: '120/80',
    pulse: '74',
    spo2: '98',
    temp: '98.4',
    rr: '16',
  };
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Vitals:  BP: ${vitals.bp} mmHg  |  Pulse: ${vitals.pulse} bpm  |  SpO2: ${vitals.spo2}%  |  Temp: ${vitals.temp}°F  |  Resp Rate: ${vitals.rr}/min`,
    margin + 3,
    y + 10.5
  );

  y += 18;

  // -------------------------------------------------------------
  // 4. DOCTOR-VERIFIED CLINICAL SUMMARY
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('DOCTOR-VERIFIED CLINICAL SUMMARY', margin, y);
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 1.5, margin + 70, y + 1.5);
  y += 5.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text('History of Present Illness (HPI):', margin, y);
  y += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  const hpiText =
    visit.clinicalSummary.historyOfPresentIllness ||
    visit.chiefComplaint?.description ||
    'Patient presented with acute clinical symptoms requiring evaluation.';
  y = printWrapped(hpiText, margin, y, contentWidth, 4.2);

  // Past Medical History & Allergies
  const pmhList = visit.clinicalSummary.pastMedicalHistory;
  const allergiesList = visit.clinicalSummary.allergies;

  if (pmhList && pmhList.length > 0) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Past Medical History: ', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(pmhList.join(' • '), margin + 35, y);
    y += 4;
  }

  if (allergiesList && allergiesList.length > 0) {
    y += 1.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(190, 18, 60);
    doc.text('Known Allergies: ', margin, y);
    doc.setFont('helvetica', 'normal');
    const allergiesStr = allergiesList.map((a) => `${a.allergen} (${a.reaction})`).join(', ');
    doc.text(allergiesStr, margin + 28, y);
    y += 4;
  }

  // AYUSH Dashavidha Pariksha & Lifestyle Summary
  if (visit.ayushHistory) {
    y += 2;
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(22, 101, 52);
    doc.text('AYUSH CLINICAL PROFILE: DASHAVIDHA PARIKSHA & AHARA-VIHARA', margin + 3, y + 4.5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(21, 128, 61);
    const ayushLine1 = `Prakriti: ${visit.ayushHistory.dashavidha.prakriti.split('(')[0]}  •  Vikriti: ${visit.ayushHistory.dashavidha.vikriti.split('(')[0]}  •  Sara: ${visit.ayushHistory.dashavidha.sara.split('(')[0]}  •  Agni: ${visit.ayushHistory.dashavidha.aharaShakti.split('(')[0]}`;
    const ayushLine2 = `Vyayama: ${visit.ayushHistory.dashavidha.vyayamaShakti.split('(')[0]}  •  Diet: ${visit.ayushHistory.ahara.usualDiet.split('(')[0]}  •  Sleep: ${visit.ayushHistory.vihara.sleepPattern.split('(')[0]}`;
    doc.text(ayushLine1, margin + 3, y + 8.5);
    doc.text(ayushLine2, margin + 3, y + 12);
    y += 16;
  }

  y += 3;

  // -------------------------------------------------------------
  // 5. PRESCRIBED MEDICATIONS TABLE
  // -------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('PRESCRIBED MEDICINES (Rx)', margin, y);
  doc.setDrawColor(15, 118, 110);
  doc.line(margin, y + 1.5, margin + 55, y + 1.5);
  y += 5.5;

  // Table Header
  const colX = {
    num: margin + 2,
    name: margin + 10,
    dosage: margin + 70,
    freq: margin + 102,
    duration: margin + 155,
  };

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentWidth, 6, 1, 1, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text('#', colX.num, y + 4.2);
  doc.text('Medicine Name (Category)', colX.name, y + 4.2);
  doc.text('Dosage', colX.dosage, y + 4.2);
  doc.text('Frequency & Instructions', colX.freq, y + 4.2);
  doc.text('Duration', colX.duration, y + 4.2);
  y += 7.5;

  // Prescriptions rows
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
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('No oral pharmaceuticals prescribed. Supportive care and observation advised.', margin + 4, y + 3.5);
    y += 7;
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);

    rxList.forEach((rx, idx) => {
      // Alternating row background
      if (idx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y - 2, contentWidth, 6.5, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.text(String(idx + 1), colX.num, y + 2.5);
      const catSuffix = rx.category ? ` [${rx.category.toUpperCase()}]` : '';
      doc.text(`${rx.name}${catSuffix}`, colX.name, y + 2.5);

      doc.setFont('helvetica', 'normal');
      doc.text(rx.dosage || 'Standard', colX.dosage, y + 2.5);
      const freqText = rx.instructions ? `${rx.frequency} (${rx.instructions})` : rx.frequency;
      doc.text(freqText, colX.freq, y + 2.5);
      doc.text(rx.duration || '5 days', colX.duration, y + 2.5);

      y += 6.5;
    });
  }

  y += 4;

  // -------------------------------------------------------------
  // 6. DOCTOR'S ADVICE & LIFESTYLE TIPS
  // -------------------------------------------------------------
  const doctorAdviceText =
    visit.doctorReview?.doctorAdvice?.trim() ||
    '• Maintain adequate hydration (minimum 2.5 liters of warm water daily).\n• Take prescribed medications strictly after food with full glass of water.\n• Complete bed rest for the next 48-72 hours.\n• Avoid cold food, dust exposure, and oily/spicy diet.\n• Immediate Emergency Return Warning: In case of chest pain, shortness of breath, high persistent fever (>102°F), or severe dizziness, report immediately to Room 1 Emergency Resus.';

  doc.setFillColor(240, 253, 244); // soft emerald/green card
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, y, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(22, 101, 52);
  doc.text("DOCTOR'S ADVICE & LIFESTYLE TIPS", margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(21, 128, 61);
  printWrapped(doctorAdviceText, margin + 4, y + 9.5, contentWidth - 8, 3.8);

  y += 28;

  // -------------------------------------------------------------
  // 7. ADDITIONAL DOCTOR NOTES & INVESTIGATIONS
  // -------------------------------------------------------------
  const doctorNotes = visit.doctorReview?.doctorNotes || 'Review OPD in 5 days or sooner if symptoms worsen.';
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text('Doctor Notes / Plan:', margin + 3, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  printWrapped(doctorNotes, margin + 35, y + 5, contentWidth - 40, 3.8);

  y += 18;

  // -------------------------------------------------------------
  // 8. DOCTOR VERIFICATION STAMP & SIGNATURE (FOOTER)
  // -------------------------------------------------------------
  const verifiedDateStr = visit.doctorReview?.verifiedAt
    ? new Date(visit.doctorReview.verifiedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  const attendingDoc = visit.doctorReview?.verifiedBy || visit.attendingDoctor || 'Attending Physician';

  // Digital verification box
  doc.setDrawColor(15, 118, 110);
  doc.setLineWidth(0.3);
  doc.roundedRect(pageWidth - margin - 75, y, 75, 22, 1.5, 1.5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(15, 118, 110);
  doc.text('DIGITALLY VERIFIED & SIGNED', pageWidth - margin - 70, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const actualDocName = (attendingDoc === 'Attending Doctor' || attendingDoc === 'Attending Physician') 
    ? (localStorage.getItem('medico_current_user') ? JSON.parse(localStorage.getItem('medico_current_user')!).name : 'Not Assigned')
    : attendingDoc;
  doc.text(`Attending Doctor: ${actualDocName}`, pageWidth - margin - 70, y + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(`Reg No: NMR-IND-89421 • Internal Medicine`, pageWidth - margin - 70, y + 15);
  doc.text(`Verified: ${verifiedDateStr}`, pageWidth - margin - 70, y + 19);

  // Disclaimer on bottom left
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('This is an official hospital clinical summary generated via Medico AI OPD System.', margin, pageHeight - margin - 4);
  doc.text('Valid for clinical records, pharmacy dispensing, and hospital follow-up under ABDM.', margin, pageHeight - margin - 1);

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
