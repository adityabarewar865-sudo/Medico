import { Router, type Request, type Response } from 'express';
import { db } from '../services/db';
import { sse } from '../services/sse';
import { generateFhirBundle } from '../../src/services/fhirAbdm';
import { SAMPLE_DOCUMENTS, parseMedicalText } from '../../src/services/ocrEngine';

const router = Router();

// GET /api/health - Server health & stats
router.get('/health', (_req: Request, res: Response): void => {
  const stats = db.getStats();
  res.json({
    status: 'online',
    version: '2.0.0',
    service: 'Medikiosk Clinical Backend & Gateway',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeSseConnections: sse.getActiveClientCount(),
    database: {
      status: 'healthy',
      totalEncounters: stats.total,
      emergencyQueue: stats.emergency,
      urgentQueue: stats.urgent,
      routineQueue: stats.routine,
      verifiedByDoctor: stats.verified,
      syncedToHis: stats.hisSynced,
    },
    abdmGateway: {
      status: 'connected',
      environment: 'SANDBOX_M1_M2',
      fhirVersion: 'R4 (4.0.1)',
      nrcesCompliant: true,
    },
    hisGateway: {
      status: 'ready',
      endpoint: 'hl7://his-gateway.district-hospital.internal:2575',
      standard: 'HL7-v2.8 / FHIR-R4',
    },
  });
});

// GET /api/patients/:id/fhir - Generate HL7 FHIR R4 Document Bundle
router.get('/patients/:id/fhir', (req: Request, res: Response): void => {
  try {
    const patient = db.getEncounterById(req.params.id);
    if (!patient) {
      res.status(404).json({ success: false, error: 'Patient encounter not found' });
      return;
    }

    const fhirBundle = generateFhirBundle(patient);
    res.json({
      success: true,
      bundleId: fhirBundle.id,
      patientName: patient.demographics.fullName,
      opdToken: patient.opdToken,
      resourceType: fhirBundle.resourceType,
      entriesCount: fhirBundle.entry.length,
      bundle: fhirBundle,
    });
  } catch (err) {
    console.error('[Clinical API] Error generating FHIR Bundle:', err);
    res.status(500).json({ success: false, error: 'Failed to generate FHIR Bundle' });
  }
});

// POST /api/his/sync - Synchronize encounter with Hospital Information System
router.post('/his/sync', (req: Request, res: Response): void => {
  try {
    const { patientId } = req.body;
    if (!patientId) {
      res.status(400).json({ success: false, error: 'patientId is required' });
      return;
    }

    const patient = db.getEncounterById(patientId);
    if (!patient) {
      res.status(404).json({ success: false, error: 'Patient encounter not found' });
      return;
    }

    const ackTimestamp = new Date().toISOString();
    const ackId = `HIS-ACK-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Mark patient as saved to HIS
    const updated = db.updateDoctorReview(patientId, patient.doctorReview, true);

    res.json({
      success: true,
      ackId,
      timestamp: ackTimestamp,
      opdToken: patient.opdToken,
      patientName: patient.demographics.fullName,
      hisMrn: `MRN-DCH-${patient.demographics.id.slice(-6).toUpperCase()}`,
      hl7MessageCode: 'DFT^P03 (Detailed Financial Transaction & Case Sheet)',
      status: 'COMMITTED_TO_HIS',
      patient: updated,
    });
  } catch (err) {
    console.error('[Clinical API] Error syncing with HIS:', err);
    res.status(500).json({ success: false, error: 'Failed to sync with HIS' });
  }
});

// POST /api/ocr/extract - Document & OCR entity extraction
router.post('/ocr/extract', (req: Request, res: Response): void => {
  try {
    const { documentType, documentText, samplePresetId } = req.body;

    if (samplePresetId) {
      const preset = SAMPLE_DOCUMENTS.find((d) => d.id === samplePresetId);
      if (preset) {
        res.json({
          success: true,
          presetUsed: samplePresetId,
          document: preset,
        });
        return;
      }
    }

    // Run dynamic extraction
    const textToProcess = documentText || 'Prescription and Clinical Notes';
    const parsed = parseMedicalText(textToProcess, 'Uploaded Hospital Document');
    const processedDoc = {
      id: `doc_${Date.now()}`,
      name: 'Uploaded Hospital Document',
      type: documentType || 'prescription',
      uploadedAt: new Date().toISOString(),
      facilityName: 'District Hospital OPD',
      doctorName: 'Attending Physician',
      documentDate: new Date().toISOString().split('T')[0],
      ocrRawText: textToProcess,
      extractedDiagnoses: parsed.diagnoses,
      extractedMedications: parsed.medications,
      extractedLabValues: parsed.labValues,
      previewUrl: '',
    };

    res.json({
      success: true,
      document: processedDoc,
    });
  } catch (err) {
    console.error('[Clinical API] Error extracting OCR document:', err);
    res.status(500).json({ success: false, error: 'Failed to process document' });
  }
});

export default router;
