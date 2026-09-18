const GENERIC_MESSAGE = 'Si è verificato un errore imprevisto. Riprova.';

const MESSAGES: Record<string, string> = {
  'auth/invalid-credential': 'Email o password non corretti.',
  'auth/invalid-login-credentials': 'Email o password non corretti.',
  'auth/wrong-password': 'Email o password non corretti.',
  'auth/user-not-found': 'Email o password non corretti.',
  'auth/email-already-in-use': 'Esiste già un account con questa email.',
  'auth/invalid-email': "L'indirizzo email non è valido.",
  'auth/weak-password': 'La password deve contenere almeno 6 caratteri.',
  'auth/missing-password': 'Inserisci la password.',
  'auth/too-many-requests': 'Troppi tentativi. Riprova tra qualche minuto.',
  'auth/user-disabled': 'Questo account è stato disabilitato.',
  'auth/operation-not-allowed': 'Questo metodo di accesso non è abilitato.',
  'auth/admin-restricted-operation': "La modalità prova non è attiva: va abilitato l'accesso anonimo in Firebase.",
  'auth/popup-closed-by-user': 'Accesso con Google annullato.',
  'auth/cancelled-popup-request': 'Accesso con Google annullato.',
  'auth/popup-blocked':
    'Il browser ha bloccato la finestra di accesso. Consenti i popup e riprova.',
  'auth/invalid-api-key': 'Configurazione Firebase non valida. Controlla le impostazioni.',
  'auth/api-key-not-valid.-please-pass-a-valid-api-key.':
    'Configurazione Firebase non valida. Controlla le impostazioni.',
  'auth/network-request-failed': 'Connessione non disponibile. Controlla la rete e riprova.',
  unavailable: 'Connessione non disponibile. Controlla la rete e riprova.',
  'deadline-exceeded': 'La connessione è lenta o assente: i dati non sono arrivati. Controlla la rete e riprova.',
  'auth/user-token-expired': 'La sessione è scaduta. Accedi di nuovo.',
  'auth/requires-recent-login': 'La sessione è scaduta. Accedi di nuovo.',
  unauthenticated: 'La sessione è scaduta. Accedi di nuovo.',
  'permission-denied': 'Non hai i permessi per eseguire questa operazione.',
  'auth/quota-exceeded': 'Limite di utilizzo gratuito raggiunto. Riprova più tardi.',
  'resource-exhausted': 'Limite di utilizzo gratuito raggiunto. Riprova più tardi.',
};

export function getFirebaseErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (typeof code === 'string') {
      return MESSAGES[code] ?? GENERIC_MESSAGE;
    }
  }
  return GENERIC_MESSAGE;
}
