import { Injectable, inject } from '@angular/core';
import { getDoc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { FIRESTORE } from '../../core/firebase/firebase.providers';
import { SCHEMA_VERSION, UserSettings } from '../../domain/models/user-settings';
import { buildDefaultCategories, buildDefaultTemplates } from '../../domain/seed/default-data';
import { userDocument, userItemDocument } from '../firestore-paths';

export type UserSettingsChanges = Partial<Omit<UserSettings, 'createdAt' | 'updatedAt'>>;

@Injectable({ providedIn: 'root' })
export class UserSettingsRepository {
  private readonly firestore = inject(FIRESTORE);

  async get(uid: string): Promise<UserSettings | null> {
    const snapshot = await getDoc(userDocument(this.firestore, uid));
    return snapshot.exists() ? (snapshot.data() as UserSettings) : null;
  }

  /** Creates the settings document with the default categories and quick templates in a single batch. */
  async initialize(uid: string, displayName: string): Promise<void> {
    const batch = writeBatch(this.firestore);
    const timestamps = { createdAt: serverTimestamp(), updatedAt: serverTimestamp() };

    batch.set(userDocument(this.firestore, uid), {
      displayName,
      locale: 'it-IT',
      currency: 'EUR',
      timeZone: 'Europe/Rome',
      safetyBufferCents: 0,
      weekStartsOn: 1,
      onboardingCompleted: false,
      defaultAccountId: null,
      viewPeriod: { preset: 'salaryCycle' },
      schemaVersion: SCHEMA_VERSION,
      ...timestamps,
    });
    for (const { id, ...category } of buildDefaultCategories()) {
      batch.set(userItemDocument(this.firestore, uid, 'categories', id), { ...category, ...timestamps });
    }
    for (const { id, ...template } of buildDefaultTemplates()) {
      batch.set(userItemDocument(this.firestore, uid, 'quickTemplates', id), { ...template, ...timestamps });
    }
    await batch.commit();
  }

  async update(uid: string, changes: UserSettingsChanges): Promise<void> {
    await updateDoc(userDocument(this.firestore, uid), { ...changes, updatedAt: serverTimestamp() });
  }
}
