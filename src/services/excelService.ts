/**
 * Hospital Patient Records Excel Export Service
 *
 * Maintains and exports the official hospital patient record ledger:
 * File: Hospital_Patient_Records.xlsx
 *
 * Columns:
 * - Patient ID
 * - Patient Name
 * - Age
 * - Gender
 * - Mobile Number
 * - Problem / Wellness
 * - Date
 * - Time
 * - Visit ID
 *
 * Every new visit is added as a NEW ROW without overwriting previous visits.
 * Existing patients returning will have a new row with the same Patient ID and new Visit ID.
 */

import * as XLSX from 'xlsx';
import type { PatientRecord } from '../types/clinical';

export interface ExcelVisitRow {
  'Patient ID': string;
  'Patient Name': string;
  'Age': number;
  'Gender': string;
  'Mobile Number': string;
  'Problem / Wellness': string;
  'Date': string;
  'Time': string;
  'Visit ID': string;
}

/**
 * Builds array of spreadsheet rows from all hospital patient records.
 * Generates one row per visit, preserving chronological history.
 */
export function buildExcelRows(patients: PatientRecord[]): ExcelVisitRow[] {
  const rows: ExcelVisitRow[] = [];

  for (const patient of patients) {
    if (!patient.visits || patient.visits.length === 0) {
      const regDate = new Date(patient.registeredAt || Date.now());
      rows.push({
        'Patient ID': patient.patientId,
        'Patient Name': patient.fullName,
        'Age': patient.age,
        'Gender': patient.gender ? patient.gender.toUpperCase() : 'OTHER',
        'Mobile Number': patient.phone,
        'Problem / Wellness': 'General Registration / Wellness Checkup',
        'Date': regDate.toISOString().split('T')[0],
        'Time': regDate.toTimeString().substring(0, 5),
        'Visit ID': 'V001',
      });
      continue;
    }

    // Sort visits chronologically (oldest visit first so timeline reads downward)
    const sortedVisits = [...patient.visits].sort((a, b) => {
      const timeA = new Date(a.createdAt || a.visitDate || 0).getTime();
      const timeB = new Date(b.createdAt || b.visitDate || 0).getTime();
      return timeA - timeB;
    });

    for (const visit of sortedVisits) {
      const createdDate = visit.createdAt ? new Date(visit.createdAt) : new Date();
      const dateStr = visit.visitDate || createdDate.toISOString().split('T')[0];
      const timeStr = visit.createdAt
        ? createdDate.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
        : '10:00';

      const problem =
        visit.chiefComplaint?.title ||
        visit.chiefComplaint?.description ||
        visit.clinicalSummary?.chiefComplaintFormatted ||
        'Outpatient Consultation';

      rows.push({
        'Patient ID': patient.patientId,
        'Patient Name': patient.fullName,
        'Age': patient.age,
        'Gender': patient.gender ? patient.gender.toUpperCase() : 'OTHER',
        'Mobile Number': patient.phone,
        'Problem / Wellness': problem,
        'Date': dateStr,
        'Time': timeStr,
        'Visit ID': visit.visitId || 'V001',
      });
    }
  }

  return rows;
}

/**
 * Generates an in-memory binary XLSX workbook
 */
export function generateExcelWorkbook(patients: PatientRecord[]): XLSX.WorkBook {
  const rows = buildExcelRows(patients);
  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: [
      'Patient ID',
      'Patient Name',
      'Age',
      'Gender',
      'Mobile Number',
      'Problem / Wellness',
      'Date',
      'Time',
      'Visit ID',
    ],
  });

  // Set professional column widths
  worksheet['!cols'] = [
    { wch: 14 }, // Patient ID
    { wch: 24 }, // Patient Name
    { wch: 8 },  // Age
    { wch: 12 }, // Gender
    { wch: 18 }, // Mobile Number
    { wch: 34 }, // Problem / Wellness
    { wch: 14 }, // Date
    { wch: 10 }, // Time
    { wch: 12 }, // Visit ID
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hospital Patient Records');
  return workbook;
}

/**
 * Downloads Hospital_Patient_Records.xlsx directly in the browser
 */
export function downloadHospitalExcel(
  patients: PatientRecord[],
  fileName = 'Hospital_Patient_Records.xlsx'
): void {
  const workbook = generateExcelWorkbook(patients);
  XLSX.writeFile(workbook, fileName);
}
