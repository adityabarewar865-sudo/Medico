/**
 * Central Verified Receipt Service
 *
 * Manages cryptographically secure receipt tokens, PDF persistence,
 * and Firebase Storage sync.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { firebaseServer } from './firebaseServer';
import { db } from './db';
import type { PatientCaseEncounter, PatientRecord } from '../../src/types/clinical';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
const RECEIPTS_DIR = path.join(DATA_DIR, 'receipts');
const RECEIPTS_FILE = path.join(DATA_DIR, 'verified_receipts.json');

export interface VerifiedReceiptRecord {
  receiptToken: string; // 48-char cryptographically secure token
  patientId: string;
  visitId: string;
  patientName: string;
  phone: string;
  doctorName: string;
  verifiedAt: string;
  receiptUrl: string;
  pdfPath?: string;
  firebaseStorageUrl?: string;
  pdfBase64Preview?: string;
}

export class ReceiptService {
  private receipts: Map<string, VerifiedReceiptRecord> = new Map();

  constructor() {
    this.ensureDirs();
    this.loadFromDisk();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(RECEIPTS_DIR)) {
      fs.mkdirSync(RECEIPTS_DIR, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(RECEIPTS_FILE)) {
        const data = fs.readFileSync(RECEIPTS_FILE, 'utf-8');
        const list: VerifiedReceiptRecord[] = JSON.parse(data);
        if (Array.isArray(list)) {
          list.forEach((r) => this.receipts.set(r.receiptToken, r));
        }
      }
    } catch (e) {
      console.warn('[Receipt Service] Error loading receipts from disk:', e);
    }
  }

  private persistToDisk(): void {
    try {
      this.ensureDirs();
      const list = Array.from(this.receipts.values());
      fs.writeFileSync(RECEIPTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Receipt Service] Failed to save verified receipts to disk:', e);
    }
  }

  /**
   * Generate a cryptographically secure random 48-hex character token
   */
  public generateSecureToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  /**
   * Find existing receipt by patientId and visitId
   */
  public findReceiptByVisit(patientId: string, visitId: string): VerifiedReceiptRecord | undefined {
    for (const r of this.receipts.values()) {
      if (
        r.patientId.toUpperCase() === patientId.toUpperCase() &&
        r.visitId.toUpperCase() === visitId.toUpperCase()
      ) {
        return r;
      }
    }
    return undefined;
  }

  /**
   * Create or update verified receipt, store PDF, and upload to Firebase Storage
   */
  public async createOrUpdateReceipt(options: {
    patientId: string;
    visitId: string;
    patientName: string;
    phone: string;
    doctorName: string;
    verifiedAt: string;
    pdfBase64?: string;
    reqHost?: string;
    protocol?: string;
  }): Promise<VerifiedReceiptRecord> {
    const {
      patientId,
      visitId,
      patientName,
      phone,
      doctorName,
      verifiedAt,
      pdfBase64,
      reqHost,
      protocol = 'http',
    } = options;

    // Check if receipt already exists for this visit
    const existing = this.findReceiptByVisit(patientId, visitId);
    const receiptToken = existing ? existing.receiptToken : this.generateSecureToken();

    // Determine public domain/host
    const baseUrl =
      process.env.PUBLIC_URL ||
      process.env.BASE_URL ||
      (reqHost ? `${protocol}://${reqHost.replace(/:5000$/, ':5173')}` : 'http://localhost:5173');

    const receiptUrl = `${baseUrl}/receipt/${receiptToken}`;
    const pdfFilename = `Receipt_${patientId}_${visitId}_${receiptToken.substring(0, 8)}.pdf`;
    const localPdfPath = path.join(RECEIPTS_DIR, pdfFilename);

    let pdfBuffer: Buffer | null = null;
    if (pdfBase64) {
      try {
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
        pdfBuffer = Buffer.from(cleanBase64, 'base64');
        fs.writeFileSync(localPdfPath, pdfBuffer);
        console.log(`[Receipt Service] Persisted PDF receipt to disk: ${localPdfPath}`);
      } catch (e) {
        console.error('[Receipt Service] Failed to write PDF to disk:', e);
      }
    }

    // Attempt Firebase Storage Upload
    let firebaseStorageUrl = existing?.firebaseStorageUrl;
    if (pdfBuffer) {
      const storagePath = `receipts/${patientId}/${visitId}/${pdfFilename}`;
      const uploadedUrl = await firebaseServer.uploadPdfToFirebaseStorage({
        storagePath,
        pdfBuffer,
      });
      if (uploadedUrl) {
        firebaseStorageUrl = uploadedUrl;
      }
    }

    const record: VerifiedReceiptRecord = {
      receiptToken,
      patientId,
      visitId,
      patientName,
      phone,
      doctorName,
      verifiedAt,
      receiptUrl,
      pdfPath: fs.existsSync(localPdfPath) ? localPdfPath : undefined,
      firebaseStorageUrl,
      pdfBase64Preview: pdfBase64 ? pdfBase64.substring(0, 200) + '...' : undefined,
    };

    this.receipts.set(receiptToken, record);
    this.persistToDisk();

    // Persist to Cloud Firestore if connected
    await firebaseServer.saveReceiptToFirestore({
      receiptToken,
      patientId,
      visitId,
      patientName,
      phone,
      doctorName,
      verifiedAt,
      receiptUrl,
      firebaseStorageUrl,
    });

    console.log(
      `[Receipt Service] Receipt generated: Token ${receiptToken.substring(0, 10)}... | URL: ${receiptUrl}`
    );

    return record;
  }

  /**
   * Look up receipt by token with full clinical encounter details for the patient
   */
  public getReceiptDetails(token: string): {
    receipt: VerifiedReceiptRecord;
    patient?: PatientRecord;
    visit?: PatientCaseEncounter;
  } | null {
    const receipt = this.receipts.get(token);
    if (!receipt) return null;

    // Attach full patient and visit clinical details from database
    const patient = db.getHospitalPatientById(receipt.patientId);
    const visit = patient?.visits.find(
      (v) => v.visitId === receipt.visitId || v.id === receipt.visitId
    );

    return {
      receipt,
      patient,
      visit,
    };
  }

  /**
   * Get PDF buffer for streaming/downloading
   */
  public getPdfBuffer(token: string): Buffer | null {
    const receipt = this.receipts.get(token);
    if (!receipt) return null;

    if (receipt.pdfPath && fs.existsSync(receipt.pdfPath)) {
      return fs.readFileSync(receipt.pdfPath);
    }

    // Check for any matching file in receipts directory
    const files = fs.readdirSync(RECEIPTS_DIR);
    const match = files.find((f) => f.includes(token.substring(0, 8)));
    if (match) {
      return fs.readFileSync(path.join(RECEIPTS_DIR, match));
    }

    return null;
  }
}

export const receiptService = new ReceiptService();

