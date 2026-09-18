import { getFirebaseErrorMessage } from './firebase-error-message';

describe('getFirebaseErrorMessage', () => {
  it('maps authentication errors to Italian messages', () => {
    expect(getFirebaseErrorMessage({ code: 'auth/invalid-credential' })).toBe(
      'Email o password non corretti.',
    );
  });

  it('distinguishes network, session, permission and quota errors', () => {
    expect(getFirebaseErrorMessage({ code: 'auth/network-request-failed' })).toContain(
      'Connessione',
    );
    expect(getFirebaseErrorMessage({ code: 'unavailable' })).toContain('Connessione');
    expect(getFirebaseErrorMessage({ code: 'unauthenticated' })).toContain('sessione è scaduta');
    expect(getFirebaseErrorMessage({ code: 'permission-denied' })).toContain('permessi');
    expect(getFirebaseErrorMessage({ code: 'resource-exhausted' })).toContain('Limite');
  });

  it('never exposes raw technical codes', () => {
    const message = getFirebaseErrorMessage({ code: 'auth/some-new-code' });
    expect(message).not.toContain('auth/');
    expect(message).toBe('Si è verificato un errore imprevisto. Riprova.');
  });

  it('handles non Firebase errors', () => {
    expect(getFirebaseErrorMessage(new Error('boom'))).toBe(
      'Si è verificato un errore imprevisto. Riprova.',
    );
    expect(getFirebaseErrorMessage(null)).toBe('Si è verificato un errore imprevisto. Riprova.');
  });
});
