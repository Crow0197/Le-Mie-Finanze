# Le mie finanze

Progressive Web App personale per registrare e prevedere la propria situazione economica.
La specifica completa, fonte di verità del progetto, è in [PROJECT_SPEC.md](PROJECT_SPEC.md).

## Stack

- Angular 22 standalone, TypeScript strict, Signals, Reactive Forms tipizzati, SCSS
- Firebase Authentication (Google ed email/password) e Cloud Firestore, piano gratuito Spark
- Firebase Hosting per la pubblicazione
- Angular CDK per dialog e bottom sheet, `@lucide/angular` per le icone, `date-fns` per le date
- Vitest per gli unit test, ESLint con angular-eslint

## Comandi

Da eseguire nel prompt dei comandi (cmd) nella cartella del progetto.

| Comando | Descrizione |
| --- | --- |
| `npm start` | Avvia l'app in sviluppo su http://localhost:4200 |
| `npm run build` | Build di produzione in `dist/le-mie-finanze/browser` |
| `npm run lint` | Controllo del codice |
| `npm test` | Unit test |
| `npx firebase deploy --only hosting` | Pubblica su Firebase Hosting (dopo la build) |
| `npx firebase deploy --only firestore:rules,firestore:indexes` | Pubblica regole e indici Firestore |

## Collegare Firebase

Lo sviluppo avviene online su un progetto Firebase dedicato allo sviluppo, separato da quello di produzione.

1. Crea il progetto nella [console Firebase](https://console.firebase.google.com) (piano Spark, senza carta).
2. Aggiungi un'app Web e copia `apiKey`, `authDomain`, `projectId` e `appId`.
3. Inserisci i valori in:
   - `src/environments/environment.development.ts` per lo sviluppo;
   - `src/environments/environment.ts` per la produzione.
4. Sostituisci l'identificativo del progetto in `.firebaserc`.
5. In **Authentication > Metodo di accesso** abilita **Google** ed **Email/password**.
   Per l'accesso con email crea il tuo utente da **Authentication > Utenti**: l'app non ha una pagina di registrazione.
6. In **Firestore Database** crea il database e pubblica le regole con il comando indicato sopra.

La configurazione web di Firebase non è un segreto: la protezione dei dati è garantita dalle regole in `firestore.rules`,
che consentono a ogni utente di leggere e scrivere solo i propri dati.

## Emulatori (facoltativi)

Gli emulatori di Authentication e Firestore sono configurati in `firebase.json` ma richiedono Java 21 o superiore.
Per usarli: `npx firebase emulators:start` e `useEmulators: true` in `environment.development.ts`.

## Funzionalità

- Accesso con Google o email, onboarding in tre passaggi.
- Riepilogo: saldo totale, disponibile fino allo stipendio, risparmio previsto nel mese, totali del periodo, ultimi movimenti e prossime operazioni.
- Movimenti con filtri, ricerca, paginazione, modifica, duplicazione ed eliminazione con annullamento.
- Inserimento rapido con pulsante + su mobile, modelli preferiti, trasferimenti con commissione.
- Conti con conto predefinito, riordino e archiviazione (le ricorrenze collegate vengono sospese).
- Pianificate: stipendio, ricorrenze, operazioni da confermare e prossimi 60 giorni.
- Risparmio: previsione a una data, obiettivi e budget mensili.
- Resoconto per giorno, mese, anno o tutto, per macrocategoria o dettaglio, con grafici.
- Amministrazione: impostazioni, categorie a due livelli, modelli rapidi, export JSON/CSV, import JSON e ricalcolo saldi.
- Periodo di visualizzazione impostabile da "Altro".

## Struttura

```text
src/app/
  core/          auth, firebase, guard, layout, gestione errori
  shared/        componenti UI, pipe
  domain/        modelli e logica pura (importi, date, saldi, ricorrenze, previsioni, budget, resoconto)
  data-access/   repository e converter Firestore
  features/      pagine e dialog di ogni area
src/styles/      token grafici e stili globali
```

## Nota

L'app è uno strumento personale e non sostituisce estratti conto o consulenza finanziaria.
