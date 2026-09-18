import { CollectionReference, DocumentReference, Firestore, collection, doc } from 'firebase/firestore';
import { withIdConverter } from './converters/with-id.converter';

export type UserCollectionName =
  | 'accounts'
  | 'categories'
  | 'transactions'
  | 'recurringRules'
  | 'quickTemplates'
  | 'savingsGoals'
  | 'budgets';

export function userDocument(firestore: Firestore, uid: string): DocumentReference {
  return doc(firestore, 'users', uid);
}

export function userCollection<T extends { id: string }>(
  firestore: Firestore,
  uid: string,
  name: UserCollectionName,
): CollectionReference<T> {
  return collection(firestore, 'users', uid, name).withConverter(withIdConverter<T>());
}

export function userItemDocument(
  firestore: Firestore,
  uid: string,
  name: UserCollectionName,
  id: string,
): DocumentReference {
  return doc(firestore, 'users', uid, name, id);
}
