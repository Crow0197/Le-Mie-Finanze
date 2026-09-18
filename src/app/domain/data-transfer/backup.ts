import { SCHEMA_VERSION } from '../models/user-settings';

export const BACKUP_COLLECTIONS = [
  'accounts',
  'categories',
  'transactions',
  'recurringRules',
  'quickTemplates',
  'savingsGoals',
  'budgets',
] as const;

export type BackupCollection = (typeof BACKUP_COLLECTIONS)[number];

export type BackupDocument = Record<string, unknown> & { id: string };

export interface BackupFile {
  app: 'le-mie-finanze';
  schemaVersion: number;
  exportedAt: string;
  settings: Record<string, unknown>;
  collections: Record<BackupCollection, BackupDocument[]>;
}

export interface BackupValidationResult {
  backup: BackupFile | null;
  errors: string[];
}

const AMOUNT_FIELDS = ['amountCents', 'targetAmountCents', 'limitCents'];

/** Validates an imported JSON backup before anything is written. */
export function validateBackup(value: unknown): BackupValidationResult {
  const errors: string[] = [];
  if (!isRecord(value) || value['app'] !== 'le-mie-finanze') {
    return { backup: null, errors: ['Il file non è un backup di Le mie finanze.'] };
  }
  if (typeof value['schemaVersion'] !== 'number' || value['schemaVersion'] > SCHEMA_VERSION) {
    errors.push('La versione del backup non è supportata.');
  }
  if (!isRecord(value['settings'])) {
    errors.push('Le impostazioni del backup non sono valide.');
  }
  const collections = value['collections'];
  if (!isRecord(collections)) {
    return { backup: null, errors: [...errors, 'Il backup non contiene dati.'] };
  }

  for (const name of BACKUP_COLLECTIONS) {
    const documents = collections[name];
    if (!Array.isArray(documents)) {
      errors.push(`La sezione "${name}" manca o non è valida.`);
      continue;
    }
    documents.forEach((document, index) => {
      if (!isRecord(document) || typeof document['id'] !== 'string' || !document['id']) {
        errors.push(`Elemento ${index + 1} di "${name}" senza identificativo.`);
        return;
      }
      for (const field of AMOUNT_FIELDS) {
        const amount = document[field];
        if (amount !== undefined && (!Number.isInteger(amount) || (amount as number) <= 0)) {
          errors.push(`Importo non valido in "${name}", elemento ${index + 1}.`);
        }
      }
    });
  }

  return errors.length > 0 ? { backup: null, errors } : { backup: value as unknown as BackupFile, errors };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
