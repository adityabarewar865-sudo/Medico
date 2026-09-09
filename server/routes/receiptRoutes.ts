import { Router, type Request, type Response } from 'express';
import { receiptService } from '../services/receiptService';
import { firebaseServer } from '../services/firebaseServer';

const router = Router();

/**
 * GET /api/receipts/config/status
 * Check live Firebase configuration status
 */
router.get('/config/status', (_req: Request, res: Response): void => {
  res.json({
    success: true,
    firebase: firebaseServer.getStatus(),
  });
});

/**
 * GET /api/receipts/:token
 * Public secure receipt endpoint - validated against cryptographically random token
 */
router.get('/:token', (req: Request, res: Response): void => {
  const token = req.params.token;
  if (!token || token.length < 16) {
    res.status(404).json({
      success: false,
      error: 'Sorry, this receipt link is no longer valid.',
    });
    return;
  }

  const details = receiptService.getReceiptDetails(token);
  if (!details) {
    res.status(404).json({
      success: false,
      error: 'Sorry, this receipt link is no longer valid.',
    });
    return;
  }

  res.json({
    success: true,
    data: {
      receipt: details.receipt,
      patient: details.patient,
      visit: details.visit,
    },
  });
});

/**
 * GET /api/receipts/:token/download
 * Direct download of the verified PDF receipt document
 */
router.get('/:token/download', (req: Request, res: Response): void => {
  const token = req.params.token;
  const details = receiptService.getReceiptDetails(token);

  if (!details) {
    res.status(404).send('Sorry, this receipt link is no longer valid.');
    return;
  }

  const pdfBuffer = receiptService.getPdfBuffer(token);
  if (!pdfBuffer) {
    res.status(404).send('Receipt PDF file not found on server.');
    return;
  }

  const filename = `Receipt_${details.receipt.patientId}_${details.receipt.visitId}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.send(pdfBuffer);
});

export default router;
