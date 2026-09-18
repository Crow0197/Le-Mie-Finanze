import {
  DocumentData,
  FirestoreDataConverter,
  QueryDocumentSnapshot,
  WithFieldValue,
} from 'firebase/firestore';

/** Maps the document id to the `id` property and removes it when writing. */
export function withIdConverter<T extends { id: string }>(): FirestoreDataConverter<T> {
  return {
    toFirestore(model: WithFieldValue<T>): DocumentData {
      const data: DocumentData = { ...(model as DocumentData) };
      delete data['id'];
      return data;
    },
    fromFirestore(snapshot: QueryDocumentSnapshot): T {
      return { id: snapshot.id, ...snapshot.data() } as T;
    },
  };
}
