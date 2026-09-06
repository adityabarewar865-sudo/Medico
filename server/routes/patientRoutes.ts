import { Router, type Request, type Response } from 'express';
import { db } from '../services/db';
import type { PatientCaseEncounter, DoctorVerification } from '../../src/types/clinical';

const router = Router();

// GET /api/patients - List encounters with search & filters
router.get('/', (req: Request, res: Response): void => {
  try {
    const search = req.query.search as string | undefined;
    const priority = req.query.priority as 'emergency' | 'urgent' | 'routine' | undefined;
    const status = req.query.status as 'verified' | 'pending' | undefined;

    const patients = db.getEncounters({ search, priority, status });
    const stats = db.getStats();

    res.json({
      success: true,
      count: patients.length,
      data: patients,
      stats,
    });
  } catch (err) {
    console.error('[Patient API] Error fetching patients:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/patients/stats - Quick stats summary
router.get('/stats', (_req: Request, res: Response): void => {
  try {
    const stats = db.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// GET /api/patients/:id - Single encounter
router.get('/:id', (req: Request, res: Response): void => {
  try {
    const patient = db.getEncounterById(req.params.id);
    if (!patient) {
      res.status(404).json({ success: false, error: 'Patient encounter not found' });
      return;
    }
    res.json({ success: true, data: patient });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/patients - Register new intake from Kiosk
router.post('/', (req: Request, res: Response): void => {
  try {
    const encounterData: PatientCaseEncounter = req.body;

    if (!encounterData || !encounterData.demographics || !encounterData.chiefComplaint) {
      res.status(400).json({
        success: false,
        error: 'Invalid payload: demographics and chiefComplaint are required.',
      });
      return;
    }

    const created = db.createEncounter(encounterData);
    res.status(201).json({
      success: true,
      data: created,
      message: `Encounter successfully registered. Assigned Token: ${created.opdToken}`,
    });
  } catch (err) {
    console.error('[Patient API] Error creating encounter:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// PUT /api/patients/:id - Update encounter
router.put('/:id', (req: Request, res: Response): void => {
  try {
    const updated = db.updateEncounter(req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Patient encounter not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/patients/:id/doctor-review - Save doctor review, notes, Rx & HIS sync
router.post('/:id/doctor-review', (req: Request, res: Response): void => {
  try {
    const { doctorReview, saveToHis } = req.body as {
      doctorReview: DoctorVerification;
      saveToHis?: boolean;
    };

    if (!doctorReview) {
      res.status(400).json({ success: false, error: 'doctorReview object is required' });
      return;
    }

    const updated = db.updateDoctorReview(req.params.id, doctorReview, saveToHis);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Patient encounter not found' });
      return;
    }

    res.json({
      success: true,
      data: updated,
      message: saveToHis
        ? 'Doctor review signed and successfully synced with Hospital Information System (HIS).'
        : 'Doctor review draft saved.',
    });
  } catch (err) {
    console.error('[Patient API] Error saving doctor review:', err);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/patients/:id/vitals - Quick bedside vitals update
router.post('/:id/vitals', (req: Request, res: Response): void => {
  try {
    const { bp, pulse, spo2, temp, rr } = req.body;
    const patient = db.getEncounterById(req.params.id);
    if (!patient) {
      res.status(404).json({ success: false, error: 'Patient encounter not found' });
      return;
    }

    // Update bedside vitals in clinical summary
    patient.clinicalSummary.vitals = {
      bp: bp ?? patient.clinicalSummary.vitals?.bp ?? '120/80',
      pulse: pulse ?? patient.clinicalSummary.vitals?.pulse ?? '72',
      spo2: spo2 ?? patient.clinicalSummary.vitals?.spo2 ?? '98',
      temp: temp ?? patient.clinicalSummary.vitals?.temp ?? '98.4',
      rr: rr ?? patient.clinicalSummary.vitals?.rr ?? '16',
    };

    const updated = db.updateEncounter(req.params.id, {
      clinicalSummary: patient.clinicalSummary,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

// POST /api/patients/reset - Reset demonstration queue
router.post('/reset', (_req: Request, res: Response): void => {
  try {
    const resetList = db.resetToDefaults();
    const stats = db.getStats();
    res.json({
      success: true,
      count: resetList.length,
      data: resetList,
      stats,
      message: 'Queue reset to pre-seeded demonstration patients.',
    });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

export default router;
