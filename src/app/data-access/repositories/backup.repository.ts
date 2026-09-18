import { Injectable, inject } from '@angular/core';
import { DocumentData, DocumentReference, Timestamp, getDoc, getDocs, query, writeBatch } from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { BACKUP_COLLECTIONS, BackupDocument, BackupFile } from '../../domain/data-transfer/backup';
import { SCHEMA_VERSION } from '../../domain/models/user-settings';
import { userCollection, userDocument, userItemDocument } from '../firestore-paths';

const BATCH_SIZE = 400;

@Injectable({ providedIn: 'root' })
export class BackupRepository {
  private readonly firestore = inject(FIRESTORE);

  async export(uid: string): Promise<BackupFile> {
    const settingsSnapshot = await getDoc(userDocument(this.firestore, uid));
    const entries = await Promise.all(
      BACKUP_COLLECTIONS.map(async (name) => {
        const snapshot = await getDocs(query(userCollection<BackupDocument>(this.firestore, uid, name)));
        return [name, snapshot.docs.map((document) => serialize(document.data()) as BackupDocument)] as const;
      }),
    );
    return {
      app: 'le-mie-finanze',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      settings: serialize(settingsSnapshot.data() ?? {}) as Record<string, unknown>,
      collections: Object.fromEntries(entries) as BackupFile['collections'],
    };
  }

  /** Writes the backup documents, overwriting documents with the same id. */
  async import(uid: string, backup: BackupFile): Promise<void> {
    const writes: [reference: ReturnType<typeof userItemDocument>, data: DocumentData][] = [];
    for (const name of BACKUP_COLLECTIONS) {
      for (const { id, ...data } of backup.collections[name]) {
        writes.push([userItemDocument(this.firestore, uid, name, id), deserialize(data) as DocumentData]);
      }
    }
    for (let start = 0; start < writes.length; start += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);
      for (const [reference, data] of writes.slice(start, start + BATCH_SIZE)) {
        batch.set(reference, data);
      }
      await batch.commit();
    }
    const batch = writeBatch(this.firestore);
    batch.set(userDocument(this.firestore, uid), deserialize(backup.settings) as DocumentData, { merge: true });
    await batch.commit();
  }

  /** Removes every document of the user, settings included. Used to clean up the temporary test account. */
  async deleteAll(uid: string): Promise<void> {
    const references: DocumentReference[] = [];
    for (const name of BACKUP_COLLECTIONS) {
      const snapshot = await getDocs(query(userCollection<BackupDocument>(this.firestore, uid, name)));
      references.push(...snapshot.docs.map((document) => document.ref));
    }
    references.push(userDocument(this.firestore, uid));
    for (let start = 0; start < references.length; start += BATCH_SIZE) {
      const batch = writeBatch(this.firestore);
      for (const reference of references.slice(start, start + BATCH_SIZE)) {
        batch.delete(reference);
      }
      await batch.commit();
    }
  }
}

function serialize(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { __timestamp: value.toMillis() };
  }
  if (Array.isArray(value)) {
    return value.map(serialize);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  }
  return value;
}

function deserialize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(deserialize);
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record['__timestamp'] === 'number') {
      return Timestamp.fromMillis(record['__timestamp']);
    }
    return Object.fromEntries(Object.entries(record).map(([key, item]) => [key, deserialize(item)]));
  }
  return value;
}
