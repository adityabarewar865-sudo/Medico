import fs from 'node:fs';
import { Router, type Request, type Response } from 'express';
import { db } from '../services/db';
import { receiptService } from '../services/receiptService';
import { firebaseServer } from '../services/firebaseServer';
import type { Gender, DoctorVerification, PatientCaseEncounter } from '../../src/types/clinical';

const router = Router();

// GET /api/hospital/firebase/status - Real Firebase Firestore & Storage connection and read/write test
router.get('/firebase/status', async (_req: Request, res: Response): Promise<void> => {
  try {
    const testResult = await firebaseServer.testRealFirebaseConnection();
    res.json({
      success: true,
      data: testResult,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Error testing Firebase connection',
    });
  }
});

// GET /api/hospital/patients - List/search all hospital patient records with visits
router.get('/patients', (req: Request, res: Response): void => {
  try {
    const search = req.query.search as string | undefined;
    const patients = search ? db.searchHospitalPatients(search) : db.getHospitalPatients();

    res.json({
      success: true,
      count: patients.length,
      data: patients,
    });
  } catch (err) {
    console.error('[Hospital API] Error fetching patients:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/hospital/patients/:patientId - Single patient record with full visit history
router.get('/patients/:patientId', (req: Request, res: Response): void => {
  try {
    const patient = db.getHospitalPatientById(req.params.patientId);
    if (!patient) {
      res.status(404).json({ success: false, error: `Patient ${req.params.patientId} not found` });
      return;
    }
    res.json({ success: true, data: patient });
  } catch (err) {
    console.error('[Hospital API] Error fetching patient:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/hospital/patients/:patientId/medicines - Cumulative medicine history across all visits
router.get('/patients/:patientId/medicines', (req: Request, res: Response): void => {
  try {
    const medicines = db.getPatientMedicineHistory(req.params.patientId);
    res.json({
      success: true,
      count: medicines.length,
      data: medicines,
    });
  } catch (err) {
    console.error('[Hospital API] Error fetching medicines:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/hospital/patients - Register a brand new patient (generates Patient ID e.g. P10028)
router.post('/patients', (req: Request, res: Response): void => {
  try {
    const { fullName, age, gender, phone, address, emergencyContact, abhaNumber, abhaAddress } = req.body as {
      fullName: string;
      age: number;
      gender: Gender;
      phone: string;
      address?: string;
      emergencyContact?: string;
      abhaNumber?: string;
      abhaAddress?: string;
    };

    if (!fullName || !phone) {
      res.status(400).json({ success: false, error: 'Full name and phone number are required.' });
      return;
    }

    const created = db.registerHospitalPatient({
      fullName,
      age: Number(age) || 30,
      gender: gender || 'male',
      phone,
      address,
      emergencyContact,
      abhaNumber,
      abhaAddress,
    });

    res.status(201).json({
      success: true,
      data: created,
      message: `Patient registered with hospital ID ${created.patientId}`,
    });
  } catch (err) {
    console.error('[Hospital API] Error registering patient:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/hospital/patients/:patientId/visits - Create a new visit under existing Patient ID
router.post('/patients/:patientId/visits', async (req: Request, res: Response): Promise<void> => {
  try {
    const patientId = req.params.patientId;
    const visitData: Partial<PatientCaseEncounter> = req.body;

    const patient = db.getHospitalPatientById(patientId);
    if (!patient) {
      res.status(404).json({ success: false, error: `Patient with ID ${patientId} not found` });
      return;
    }

    const excelStoredAt = new Date().toISOString();
    visitData.excelStoredAt = excelStoredAt;

    // Real Firebase write attempt
    let firebaseStored = false;
    let firebaseStoredAt: string | null = null;
    let firebaseMsg = 'Firebase credentials not configured in .env';

    const fbStatus = firebaseServer.getStatus();
    if (fbStatus.configured) {
      // First sync/upsert patient to Firestore
      await firebaseServer.savePatientToFirestore(patient);
      const fbVisitRes = await firebaseServer.saveVisitToFirestore(patientId, {
        ...visitData,
        visitId: visitData.visitId || 'V001',
      } as PatientCaseEncounter);

      if (fbVisitRes.success) {
        firebaseStored = true;
        firebaseStoredAt = new Date().toISOString();
        visitData.firebaseStoredAt = firebaseStoredAt;
        firebaseMsg = 'Successfully saved to Cloud Firestore';
      } else {
        firebaseMsg = fbVisitRes.error || 'Failed to save to Cloud Firestore';
      }
    }

    const newVisit = db.createHospitalVisit(patientId, visitData);

    res.status(201).json({
      success: true,
      data: newVisit,
      storage: {
        firebaseStored,
        excelStored: true,
        firebaseStoredAt,
        excelStoredAt,
        firebaseStatusMessage: firebaseMsg,
      },
      message: `Visit ${newVisit.visitId} created for patient ${patientId}. Assigned Token: ${newVisit.opdToken}`,
    });
  } catch (err) {
    console.error('[Hospital API] Error creating visit:', err);
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : 'Internal Server Error',
    });
  }
});

// POST /api/hospital/patients/:patientId/visits/:visitId/review - Doctor review, verification, notes & Rx
router.post('/patients/:patientId/visits/:visitId/review', (req: Request, res: Response): void => {
  try {
    const { patientId, visitId } = req.params;
    const { doctorReview, saveToHis } = req.body as {
      doctorReview: DoctorVerification;
      saveToHis?: boolean;
    };

    if (!doctorReview) {
      res.status(400).json({ success: false, error: 'doctorReview object is required.' });
      return;
    }

    const updated = db.updateHospitalDoctorReview(patientId, visitId, doctorReview, saveToHis);
    if (!updated) {
      res.status(404).json({ success: false, error: `Visit ${visitId} for patient ${patientId} not found` });
      return;
    }

    res.json({
      success: true,
      data: updated,
      message: saveToHis
        ? 'Doctor review signed and synced with Hospital Information System (HIS).'
        : 'Doctor review saved.',
    });
  } catch (err) {
    console.error('[Hospital API] Error updating doctor review:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/hospital/patients/:patientId/visits/:visitId/verify-and-generate-receipt
// Doctor verification, PDF receipt creation, & Firebase Storage upload
router.post(
  '/patients/:patientId/visits/:visitId/verify-and-generate-receipt',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { patientId, visitId } = req.params;
      const {
        doctorReview,
        saveToHis,
        pdfBase64,
        hpi,
        chiefComplaint,
        vitals,
      } = req.body as {
        doctorReview: DoctorVerification;
        saveToHis?: boolean;
        pdfBase64?: string;
        hpi?: string;
        chiefComplaint?: string;
        vitals?: {
          bp: string;
          pulse: string;
          spo2: string;
          temp: string;
          rr: string;
        };
      };

      const patient = db.getHospitalPatientById(patientId);
      if (!patient) {
        res.status(404).json({ success: false, error: `Patient ${patientId} not found` });
        return;
      }

      // 1. Mark visit as verified and attach doctor's review
      const updatedReview: DoctorVerification = {
        ...doctorReview,
        verified: true,
        status: 'verified',
        verifiedAt: doctorReview.verifiedAt || new Date().toISOString(),
        verifiedBy: doctorReview.verifiedBy || 'Dr. S. K. Verma, MD',
      };

      const updatedVisit = db.updateHospitalDoctorReview(
        patientId,
        visitId,
        updatedReview,
        saveToHis
      );

      if (!updatedVisit) {
        res.status(404).json({ success: false, error: `Visit ${visitId} for patient ${patientId} not found` });
        return;
      }

      // Sync clinical summary edits if provided
      if (hpi) updatedVisit.clinicalSummary.historyOfPresentIllness = hpi;
      if (chiefComplaint) updatedVisit.chiefComplaint.title = chiefComplaint;
      if (vitals) updatedVisit.clinicalSummary.vitals = vitals;

      // 2. Generate cryptographically secure token, store PDF, and upload to Firebase Storage
      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'http';

      const receiptRecord = await receiptService.createOrUpdateReceipt({
        patientId: patient.patientId,
        visitId: updatedVisit.visitId || visitId,
        patientName: patient.fullName,
        phone: patient.phone,
        doctorName: updatedReview.verifiedBy,
        verifiedAt: updatedReview.verifiedAt,
        pdfBase64,
        reqHost: host,
        protocol,
      });

      // Attach token and status to visit object
      updatedVisit.receiptToken = receiptRecord.receiptToken;
      updatedVisit.receiptUrl = receiptRecord.receiptUrl;
      updatedVisit.excelStoredAt = new Date().toISOString();

      // Sync verified visit and medicine info to Cloud Firestore if configured
      const fbStatus = firebaseServer.getStatus();
      if (fbStatus.configured) {
        const fbRes = await firebaseServer.saveVisitToFirestore(patientId, updatedVisit);
        if (fbRes.success) {
          updatedVisit.firebaseStoredAt = new Date().toISOString();
        }
      }

      db.persist();

      res.json({
        success: true,
        data: {
          visit: updatedVisit,
          receiptToken: receiptRecord.receiptToken,
          receiptUrl: receiptRecord.receiptUrl,
          firebaseStorageUrl: receiptRecord.firebaseStorageUrl,
        },
        message: 'Consultation verified and receipt generated.',
      });
    } catch (err) {
      console.error('[Hospital API] Error verifying visit & generating receipt:', err);
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : 'Internal Server Error',
      });
    }
  }
);

// GET /api/hospital/export-excel - Download Hospital_Patient_Records.xlsx
router.get('/export-excel', (_req: Request, res: Response): void => {
  try {
    const filePath = db.getExcelFilePath();
    if (!fs.existsSync(filePath)) {
      // Trigger generation
      const rows = db.generateExcelRows();
      console.log(`[Hospital API] Generated ${rows.length} rows for Excel export.`);
    }
    res.download(filePath, 'Hospital_Patient_Records.xlsx');
  } catch (err) {
    console.error('[Hospital API] Error exporting Excel file:', err);
    res.status(500).json({ success: false, error: 'Failed to export Excel file' });
  }
});

// POST /api/hospital/reset - Reset hospital database to initial demonstration records
router.post('/reset', (_req: Request, res: Response): void => {
  try {
    const reset = db.resetHospitalDb();
    res.json({
      success: true,
      message: 'Hospital database reset to initial multi-visit patient records.',
      data: reset,
    });
  } catch (err) {
    console.error('[Hospital API] Error resetting database:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
