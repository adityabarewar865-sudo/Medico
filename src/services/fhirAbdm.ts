import type { PatientCaseEncounter } from '../types/clinical';

// Generates a valid HL7 FHIR R4 Bundle for ABDM (Ayushman Bharat Digital Mission) compliance
export function generateFhirBundle(encounter: PatientCaseEncounter) {
  const timestamp = new Date().toISOString();
  const bundleId = `abdm-bundle-${encounter.id}`;

  return {
    resourceType: 'Bundle',
    id: bundleId,
    meta: {
      versionId: '1',
      lastUpdated: timestamp,
      profile: [
        'https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle',
      ],
      security: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v3-Confidentiality',
          code: 'N',
          display: 'Normal',
        },
      ],
    },
    identifier: {
      system: 'https://abdm.gov.in/hip/care-context',
      value: encounter.abdmCareContextRef || `CARE-CTX-${encounter.opdToken}`,
    },
    type: 'document',
    timestamp,
    entry: [
      // 1. Composition Resource (OPD Case Sheet)
      {
        fullUrl: `urn:uuid:composition-${encounter.id}`,
        resource: {
          resourceType: 'Composition',
          id: `comp-${encounter.id}`,
          status: encounter.doctorReview.verified ? 'final' : 'preliminary',
          type: {
            coding: [
              {
                system: 'http://snomed.info/sct',
                code: '371530004',
                display: 'Clinical consultation report',
              },
            ],
            text: 'OPD Clinical Consultation Summary',
          },
          subject: {
            reference: `urn:uuid:patient-${encounter.demographics.id}`,
            display: encounter.demographics.fullName,
          },
          encounter: {
            reference: `urn:uuid:encounter-${encounter.id}`,
          },
          date: timestamp,
          author: [
            {
              display: encounter.doctorReview.verifiedBy || 'AI Assisted Clinical Triage & Attending MO',
            },
          ],
          title: 'OPD Encounter Case Record & AI Clinical Triage',
          section: [
            {
              title: 'Chief Complaint & History of Present Illness',
              code: {
                coding: [{ system: 'http://loinc.org', code: '10154-3', display: 'Chief complaint' }],
              },
              text: {
                status: 'generated',
                div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${encounter.clinicalSummary.historyOfPresentIllness}</p></div>`,
              },
            },
            {
              title: 'Triage Classification & Red Flags',
              text: {
                status: 'generated',
                div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Triage Category: ${encounter.triagePriority.toUpperCase()}</p><p>Rationale: ${encounter.triageRationale}</p></div>`,
              },
            },
          ],
        },
      },

      // 2. Patient Resource (with ABHA Identifier)
      {
        fullUrl: `urn:uuid:patient-${encounter.demographics.id}`,
        resource: {
          resourceType: 'Patient',
          id: encounter.demographics.id,
          identifier: [
            {
              type: {
                coding: [
                  {
                    system: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/IdentifierTypeCodes',
                    code: 'ABHA',
                    display: 'Ayushman Bharat Health Account',
                  },
                ],
              },
              system: 'https://healthid.ndhm.gov.in',
              value: encounter.demographics.abha.abhaNumber || '91-4521-8890-1234',
            },
            {
              type: {
                coding: [
                  {
                    system: 'https://nrces.in/ndhm/fhir/r4/StructureDefinition/IdentifierTypeCodes',
                    code: 'ABHA_ADDRESS',
                    display: 'ABHA Address',
                  },
                ],
              },
              system: 'https://healthid.ndhm.gov.in',
              value: encounter.demographics.abha.abhaAddress || 'patient@abdm',
            },
          ],
          name: [
            {
              text: encounter.demographics.fullName,
            },
          ],
          telecom: [
            {
              system: 'phone',
              value: encounter.demographics.phone,
            },
          ],
          gender: encounter.demographics.gender,
        },
      },

      // 3. Encounter Resource
      {
        fullUrl: `urn:uuid:encounter-${encounter.id}`,
        resource: {
          resourceType: 'Encounter',
          id: encounter.id,
          status: encounter.doctorReview.verified ? 'finished' : 'in-progress',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'Ambulatory Outpatient Clinic',
          },
          subject: {
            reference: `urn:uuid:patient-${encounter.demographics.id}`,
          },
          serviceProvider: {
            display: 'District Civil Hospital / OPD Clinic',
          },
          priority: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/v3-ActPriority',
                code: encounter.triagePriority === 'emergency' ? 'EM' : encounter.triagePriority === 'urgent' ? 'UR' : 'R',
                display: encounter.triagePriority.toUpperCase(),
              },
            ],
          },
        },
      },

      // 4. Conditions (Diagnoses)
      ...encounter.clinicalSummary.pastMedicalHistory.map((cond, idx) => ({
        fullUrl: `urn:uuid:condition-${encounter.id}-${idx}`,
        resource: {
          resourceType: 'Condition',
          id: `cond-${encounter.id}-${idx}`,
          clinicalStatus: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
                code: 'active',
              },
            ],
          },
          code: {
            text: cond,
          },
          subject: {
            reference: `urn:uuid:patient-${encounter.demographics.id}`,
          },
        },
      })),

      // 5. Doctor's Prescribed Medications
      ...(encounter.doctorReview.prescribedMedications || []).map((rx, idx) => ({
        fullUrl: `urn:uuid:med-request-${encounter.id}-${idx}`,
        resource: {
          resourceType: 'MedicationRequest',
          id: `medrx-${encounter.id}-${idx}`,
          status: 'active',
          intent: 'order',
          medicationCodeableConcept: {
            text: `${rx.name} ${rx.dosage}`,
          },
          dosageInstruction: [
            {
              text: `${rx.frequency} for ${rx.duration}. ${rx.instructions}`,
            },
          ],
        },
      })),
    ],
  };
}
