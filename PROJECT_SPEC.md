# PROMPT COMPLETO PER CLAUDE

Sei un senior product engineer specializzato in Angular, TypeScript, Firebase, UX responsive e applicazioni finanziarie personali. Devi progettare e sviluppare una web app completa per la gestione economica personale. Il nome provvisorio del prodotto è **Le mie finanze** e deve essere centralizzato in configurazione, così da poterlo cambiare facilmente.

Lavora direttamente nel progetto corrente. Se il progetto è vuoto, inizializzalo. Non limitarti a proporre codice o pseudocodice: crea realmente file, componenti, servizi, configurazioni, regole Firebase e test. Procedi per fasi nell’ordine indicato, eseguendo build, lint e test al termine di ogni fase. Correggi gli errori prima di proseguire.

## 1. Regole di lavoro

1. Usa nomi di variabili, classi, metodi, file e cartelle in inglese.
2. Tutti i testi visibili nell’interfaccia devono essere in italiano.
3. Usa TypeScript strict senza `any`, salvo casi tecnicamente inevitabili e motivati.
4. Mantieni il codice semplice, leggibile e diviso per funzionalità.
5. Non introdurre NgRx, micro frontend, backend personalizzati o architetture inutilmente complesse.
6. Usa Angular Signals per lo stato dell’interfaccia e RxJS soltanto dove serve realmente per flussi asincroni.
7. Non lasciare funzioni simulate, pulsanti senza comportamento, `TODO` o dati mock nella build di produzione.
8. I dati dimostrativi devono esistere soltanto tramite un seed esplicito per ambiente locale.
9. Non modificare parti già funzionanti senza una ragione legata ai requisiti.
10. Prima di aggiungere una dipendenza, verifica che sia necessaria, mantenuta e compatibile con la versione Angular usata.
11. Dopo ogni fase esegui almeno build, lint e test. Riporta sinteticamente file modificati, funzionalità concluse e problemi rimasti.
12. Crea subito nel repository un file `PROJECT_SPEC.md` contenente questa specifica e trattalo come fonte di verità.

## 2. Obiettivo del prodotto

Realizzare una Progressive Web App responsive per registrare e prevedere la situazione economica personale. Deve essere comoda sia su desktop sia su smartphone, molto semplice da usare, visivamente moderna e con animazioni curate ma mai invadenti.

L’applicazione deve permettere di:

1. Configurare più conti, carte, contanti e fondi di risparmio.
2. Registrare entrate, spese e trasferimenti tra conti.
3. Configurare lo stipendio come entrata ricorrente con importo, giorno di accredito e conto di destinazione.
4. Configurare spese ed entrate ricorrenti con frequenza, giorno, data iniziale e data finale opzionale.
5. Salvare operazioni frequenti come modelli rapidi riutilizzabili.
6. Gestire categorie di entrata e di spesa.
7. Visualizzare saldo attuale, disponibilità TEST e risparmio previsto entro una data.
8. Consultare movimenti passati e operazioni future.
9. Impostare obiettivi di risparmio e un margine minimo di sicurezza.
10. Esportare i propri dati in JSON e CSV senza servizi esterni.
11. Funzionare bene come sito installabile su desktop e mobile.

Non integrare banche reali, open banking, carte, pagamenti, scansione ricevute o consigli finanziari automatici nella prima versione. Tutti i dati sono inseriti manualmente dall’utente.

## 3. Stack tecnico obbligatorio

1. Angular nella versione stabile più recente compatibile con il progetto. Per un nuovo progetto usa Angular 22 standalone, TypeScript strict, routing e SCSS.
2. Componenti standalone e route lazy loaded per ogni area principale.
3. Firebase Authentication per accesso con email e password e, se semplice da configurare, Google Sign In.
4. Cloud Firestore come database.
5. Firebase Hosting classico per il deploy della Single Page Application.
6. Sviluppo online su un progetto Firebase separato di sviluppo (piano Spark), distinto da quello di produzione. Firebase Emulator Suite resta configurata ma facoltativa, perché richiede Java 21 installato in locale.
7. Firebase JavaScript SDK modulare. Incapsula ogni chiamata Firebase in servizi o repository dedicati. Non chiamare Firestore direttamente dai componenti.
8. Angular Signals per stato locale e view model.
9. Reactive Forms tipizzati per tutti i form.
10. SCSS e CSS variables per il design system. Non usare Bootstrap, Tailwind o un tema preconfezionato.
11. Angular CDK soltanto se utile per overlay, dialog, focus trap o accessibilità.
12. Lucide per le icone, con un unico wrapper condiviso.
13. `date-fns` per calcoli affidabili sulle date e sulle ricorrenze.
14. PWA tramite il supporto ufficiale Angular.
15. Test unitari con il runner ufficiale del progetto e test end to end con Playwright.

Non usare Cloud Functions, Cloud Run, App Hosting o servizi che richiedono il piano Blaze nella prima versione. Le ricorrenze e le previsioni devono funzionare lato client. Un eventuale passaggio a servizi a pagamento deve essere una scelta futura esplicita.

## 4. Vincoli di costo

Il progetto deve poter funzionare con Firebase Spark senza carta e senza costi per un uso personale normale.

1. Riduci letture e listener Firestore non necessari.
2. Usa query paginate con cursori, mai offset.
3. Evita listener realtime su collezioni storiche complete.
4. Carica inizialmente soltanto il periodo necessario, per esempio il mese corrente e i movimenti recenti.
5. Non salvare allegati o immagini nella prima versione.
6. Non usare job pianificati lato server.
7. Non usare backup Firestore automatici, PITR o TTL, perché non sono inclusi nella quota gratuita.
8. Implementa export JSON e CSV nel browser come forma di backup manuale.

## 5. Direzione grafica

L’interfaccia deve seguire una direzione moderna, calda e pulita, simile a una buona app bancaria ma meno fredda e più personale.

### Palette iniziale

```scss
:root {
  --color-bg: #f5f7f4;
  --color-surface: #ffffff;
  --color-surface-soft: #edf3f0;
  --color-primary: #176b51;
  --color-primary-hover: #0f5942;
  --color-primary-soft: #e2f1ea;
  --color-text: #14211e;
  --color-text-muted: #687873;
  --color-border: #dce6e2;
  --color-danger: #ad444c;
  --color-danger-soft: #f9e9ea;
  --color-warning: #9b6819;
  --color-warning-soft: #fff1d8;
}
```

### Regole visive

1. Usa il font Inter o un font di sistema molto simile.
2. Usa una scala di spaziatura basata su 4 e 8 pixel.
3. Usa bordi sottili, ombre leggere e raggi tra 12 e 18 pixel.
4. Mantieni molto spazio libero e una gerarchia visiva evidente.
5. Il verde è il colore principale. Rosso e arancione servono soltanto per spese, errori e avvisi.
6. Non riempire la dashboard di grafici. Nella prima versione usa valori chiari, liste, barre di avanzamento e al massimo un piccolo andamento del saldo.
7. Ogni schermata deve avere una sola azione primaria evidente.
8. Importi, date e saldi devono essere leggibili immediatamente.
9. Le entrate devono avere segno positivo e colore verde. Le spese devono avere segno negativo e colore rosso. Il colore non deve essere l’unico indicatore.
10. Usa skeleton loader discreti durante il primo caricamento e stati vuoti utili con una singola azione consigliata.

### Responsive

1. Da desktop usa una sidebar laterale con logo, navigazione e profilo.
2. Da mobile usa una barra inferiore con Home, Movimenti, pulsante rapido centrale, Risparmio e Altro.
3. Il contenuto deve adattarsi realmente, non limitarsi a rimpicciolire il desktop.
4. Le tabelle devono diventare liste a schede su mobile.
5. Tutti i target touch devono essere almeno 44 per 44 pixel.
6. I moduli mobile devono usare bottom sheet o pagine dedicate, evitando finestre minuscole al centro dello schermo.

## 6. Navigazione

### Desktop

1. Riepilogo
2. Movimenti
3. Pianificate
4. Risparmio
5. Conti
6. Amministrazione

### Mobile

1. Home
2. Movimenti
3. Pulsante rapido centrale
4. Risparmio
5. Altro, che apre Conti, Pianificate, Amministrazione e Profilo

## 7. Pagine e funzionalità

### 7.1 Accesso e primo avvio

1. App a uso personale: login semplice e rapido, da fare una sola volta per dispositivo grazie alla sessione persistente.
2. Accesso con Google come azione principale.
3. Login con email e password come alternativa. Nessuna pagina di registrazione: l’utente email si crea una volta dalla console Firebase.
4. Recupero password per l’accesso con email.
5. Dopo il primo accesso avvia un onboarding breve di massimo tre passaggi.
6. Passaggio uno: nome, valuta EUR, lingua italiana e fuso `Europe/Rome` già preselezionati.
7. Passaggio due: creazione del primo conto con nome, tipo e saldo iniziale. Il primo conto creato diventa il conto predefinito, modificabile in seguito dalle impostazioni.
8. Passaggio tre: configurazione facoltativa dello stipendio.
9. L’onboarding deve poter essere saltato e ripreso dalle impostazioni.

### 7.2 Riepilogo

Mostra soltanto informazioni realmente utili:

1. Saldo totale dei conti inclusi nel patrimonio.
2. Disponibile TEST.
3. Risparmio previsto nel mese corrente.
4. Lista degli ultimi cinque movimenti.
5. Lista delle prossime cinque entrate o spese pianificate.
6. Riepilogo dei conti con relativo saldo.
7. Eventuale avviso quando il margine di sicurezza rischia di essere superato.
8. Azione primaria `Aggiungi operazione`.

Ogni valore deve avere una breve spiegazione accessibile tramite icona informativa, in particolare `Disponibile` e `Risparmio previsto`.

### 7.3 Inserimento rapido mobile

Inserisci un pulsante verde `+` fisso al centro della barra inferiore. Deve essere l’elemento più riconoscibile della versione mobile.

Al tocco:

1. Il simbolo `+` ruota leggermente e diventa una `x`.
2. Si apre un bottom sheet con tre grandi scelte: `Spesa`, `Entrata`, `Trasferimento`.
3. Sotto le tre scelte mostra fino a quattro modelli preferiti, per esempio Supermercato, Carburante, Cena e Farmacia.
4. Dopo la scelta apri un form ridotto con importo in primo piano, conto, categoria e descrizione facoltativa.
5. La data predefinita è oggi.
6. Preseleziona il conto predefinito impostato nelle impostazioni, lasciando sempre la possibilità di cambiarlo. Vedi 7.11.
7. Permetti di aprire `Altri dettagli` per note, data diversa, ricorrenza e salvataggio come modello.
8. Dopo il salvataggio mostra conferma e azione `Annulla` per pochi secondi.

Su desktop la stessa funzione è accessibile dal pulsante `Nuova operazione` nella barra superiore.

### 7.4 Movimenti

1. Elenco ordinato per data decrescente.
2. Raggruppamento visivo per giorno o mese.
3. Filtri per intervallo date, conto, categoria e tipo.
4. Ricerca testuale per descrizione e note.
5. Creazione, modifica, eliminazione e ripristino immediato.
6. Possibilità di duplicare un movimento.
7. Indicazione chiara delle operazioni generate da una ricorrenza.
8. Le operazioni pianificate devono essere distinguibili dalle confermate.
9. La paginazione Firestore deve usare cursori.
10. Mostra un totale delle entrate e delle spese del periodo filtrato.

### 7.5 Conti

Tipi iniziali:

1. Conto bancario
2. Carta
3. Contanti
4. Risparmio
5. Altro

Campi:

1. Nome
2. Tipo
3. Saldo iniziale
4. Colore e icona
5. Includi nel saldo totale
6. Includi nel denaro disponibile
7. Ordine di visualizzazione
8. Archiviato

Non memorizzare credenziali bancarie, numeri completi di carta o informazioni non necessarie. Un conto archiviato resta consultabile ma non è selezionabile per nuove operazioni.

### 7.6 Trasferimenti

Un trasferimento è un’unica operazione logica con conto sorgente e conto destinazione.

1. L’importo viene sottratto dal conto sorgente e aggiunto al conto destinazione.
2. Il trasferimento non deve essere contato né come spesa né come entrata nei riepiloghi generali.
3. Sorgente e destinazione devono essere differenti.
4. Permetti una commissione opzionale. La commissione riduce soltanto il conto sorgente e viene conteggiata come spesa bancaria.
5. Modifica, eliminazione e ripristino devono aggiornare entrambi i conti in modo coerente.

### 7.7 Stipendio e pianificate

Lo stipendio non deve avere un modello dati separato. Deve essere una ricorrenza di tipo `income` con etichetta speciale `salary`.

Configurazione stipendio:

1. Importo previsto
2. Giorno del mese
3. Conto di destinazione
4. Data iniziale
5. Data finale opzionale
6. Creazione automatica attiva o conferma manuale
7. Importo modificabile per la singola occorrenza senza alterare la regola

Le altre ricorrenze possono essere entrate o spese e devono supportare:

1. Settimanale
2. Mensile
3. Ogni N mesi
4. Annuale
5. Data iniziale
6. Data finale opzionale
7. Giorno del mese oppure giorno della settimana
8. Operazione automatica oppure richiesta di conferma
9. Attiva, sospesa o conclusa

Se il giorno selezionato non esiste nel mese, usa l’ultimo giorno valido del mese. Esempio: una ricorrenza impostata al giorno 31 deve cadere il 28 o 29 febbraio.

### 7.8 Modelli rapidi

1. Permetti di salvare una spesa, un’entrata o un trasferimento come modello.
2. Il modello può contenere descrizione, importo facoltativo, conto, categoria e note.
3. L’utente può scegliere fino a quattro preferiti da mostrare nel pannello rapido mobile.
4. L’utilizzo di un modello deve compilare il form, non salvarlo senza conferma.
5. Permetti riordinamento e archiviazione.

### 7.9 Risparmio, budget e previsioni

1. Selettore della data futura.
2. Saldo totale previsto a quella data.
3. Risparmio netto previsto tra oggi e quella data.
4. Entrate previste e spese previste separate.
5. Obiettivi di risparmio con nome, importo obiettivo, conto collegato facoltativo e data obiettivo.
6. Barra di avanzamento e stima della data di completamento.
7. Budget mensile generale e budget facoltativi per categoria.
8. Indicazione di importo usato, importo rimanente e percentuale, con avviso discreto all’80 per cento e al superamento.
9. Possibilità di copiare i budget del mese precedente.
10. Nessun consiglio di investimento o promessa economica.

### 7.10 Amministrazione e impostazioni

1. Gestione categorie.
2. Gestione modelli rapidi.
3. Gestione conti.
4. Margine di sicurezza da non spendere.
5. Conto predefinito per l’inserimento delle operazioni. Vedi 7.11.
6. Valuta, locale e primo giorno della settimana.
7. Preferenze grafiche e tema scuro, che può arrivare dopo il primo MVP.
8. Export completo JSON.
9. Export movimenti CSV.
10. Import JSON con validazione, anteprima e conferma prima della scrittura.
11. Strumento `Ricalcola saldi` per verificare e riparare i saldi partendo dal saldo iniziale e dai movimenti confermati.
12. Eliminazione dell’account e di tutti i dati con doppia conferma. Questa funzione può essere completata in una fase successiva se richiede un backend sicuro.

### 7.11 Conto di addebito e conto predefinito

1. Ogni spesa o pagamento deve sempre indicare il conto da cui prelevare il denaro. Una spesa senza `accountId` non può essere salvata.
2. Ogni trasferimento deve sempre indicare conto sorgente e conto destinazione.
3. Ogni pagamento ricorrente deve avere il proprio conto di addebito (`RecurringRule.accountId`, obbligatorio).
4. Nelle impostazioni l’utente sceglie un conto predefinito tra i conti non archiviati.
5. Durante l’inserimento di una spesa, di un’entrata o di un trasferimento il conto predefinito viene selezionato automaticamente come conto, o come conto sorgente per i trasferimenti. L’utente può sempre cambiarlo prima di salvare.
6. Un modello rapido che contiene un conto usa il proprio conto; altrimenti il form usa il conto predefinito.
7. Se il conto predefinito viene archiviato o eliminato, l’app deve chiedere all’utente di scegliere un altro conto predefinito tra quelli attivi. Se non esistono altri conti attivi, invita a crearne uno.
8. La stessa richiesta deve comparire all’avvio se `defaultAccountId` punta a un conto archiviato o inesistente.
9. Senza un conto predefinito valido il form resta utilizzabile, ma il campo conto è vuoto e obbligatorio.
10. Se il conto collegato a una regola ricorrente viene archiviato o eliminato, la regola passa automaticamente a `paused` e l’app chiede di scegliere un nuovo conto attivo per quella regola.
11. Non usare mai automaticamente il conto predefinito come sostituto del conto di una regola ricorrente, per evitare addebiti indesiderati.
12. Finché la regola è sospesa non genera occorrenze reali né virtuali. Dopo la scelta del nuovo conto l’utente può riattivarla.

### 7.12 Periodo di visualizzazione

1. In "Altro" l’utente sceglie un periodo di visualizzazione: Tutto (predefinito), Mese corrente, Mese scorso, Ultimi 3 mesi, Anno corrente o Personalizzato con data iniziale e finale.
2. Il periodo filtra Movimenti, i totali del periodo nel Riepilogo e il Resoconto. Con "Tutto" si vede l’intero storico.
3. Budget e previsioni restano mensili e non dipendono dal periodo.
4. Il periodo è salvato nelle impostazioni utente (`viewPeriod`) e vale su tutti i dispositivi.
5. Con "Tutto" i totali del Riepilogo usano aggregazioni Firestore per non scaricare l’intero storico.

### 7.13 Resoconto

1. Nuova sezione "Resoconto" nella navigazione desktop e in "Altro" su mobile.
2. Entrate e spese confermate raggruppate per giorno, mese, anno o tutto il periodo. I trasferimenti sono esclusi, le commissioni contano come spese.
3. Vista per macrocategoria o di dettaglio per sottocategoria.
4. Grafici semplici e leggibili: colonne entrate/spese per periodo con legenda, dettaglio al passaggio del mouse e tabella dei valori; barre orizzontali per categoria con importo e percentuale.
5. Colori dei grafici verificati per daltonismo: entrate verde `#2e8b6a`, spese arancione `#d9822b`.

### 7.14 Macrocategorie e dati iniziali

1. Le categorie hanno due livelli: macrocategoria (`parentId` nullo) e sottocategoria.
2. Al primo accesso vengono create macrocategorie e sottocategorie modificabili (per esempio Svago, Rate e finanziamenti, Casa e bollette) e modelli rapidi comuni (Supermercato, Carburante, Cena fuori, Farmacia, Bollette, Bar e caffè, Streaming, Abbigliamento), con i primi quattro preferiti.
3. I budget per categoria si impostano sulle macrocategorie e includono le sottocategorie.

## 8. Modelli dati

Tutti gli importi devono essere interi espressi in centesimi. Non usare mai `float` o `number` decimali per i soldi. Un valore di `12345` corrisponde a `123,45 €`.

Usa stringhe locali `YYYY-MM-DD` per le date finanziarie prive di orario. Usa Firestore Timestamp per `createdAt`, `updatedAt` e campi tecnici.

```ts
type AccountType = 'bank' | 'card' | 'cash' | 'savings' | 'other';
type TransactionType = 'expense' | 'income' | 'transfer';
type TransactionStatus = 'confirmed' | 'planned';
type RecurrenceStatus = 'active' | 'paused' | 'completed';
type RecurrenceFrequency = 'weekly' | 'monthly' | 'customMonths' | 'yearly';

interface UserSettings {
  displayName: string;
  locale: 'it-IT';
  currency: 'EUR';
  timeZone: 'Europe/Rome';
  safetyBufferCents: number;
  weekStartsOn: 1;
  onboardingCompleted: boolean;
  defaultAccountId?: string | null;
  viewPeriod: { preset: 'all' | 'currentMonth' | 'previousMonth' | 'last3Months' | 'currentYear' | 'custom'; startDate?: string; endDate?: string };
  schemaVersion: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Account {
  id: string;
  name: string;
  type: AccountType;
  openingBalanceCents: number;
  currentBalanceCents: number;
  includeInNetWorth: boolean;
  includeInAvailable: boolean;
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Category {
  id: string;
  name: string;
  appliesTo: 'expense' | 'income' | 'both';
  parentId: string | null; // null per le macrocategorie
  icon: string;
  color: string;
  sortOrder: number;
  archived: boolean;
  system: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Transaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amountCents: number;
  effectiveDate: string;
  description: string;
  notes?: string;
  categoryId?: string;
  accountId?: string; // obbligatorio per expense e income
  sourceAccountId?: string; // obbligatorio per transfer
  destinationAccountId?: string; // obbligatorio per transfer
  feeCents?: number;
  recurringRuleId?: string;
  occurrenceKey?: string;
  deletedAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface RecurringRule {
  id: string;
  name: string;
  kind?: 'salary' | 'standard';
  transactionType: 'expense' | 'income';
  amountCents: number;
  accountId: string;
  categoryId: string;
  description: string;
  notes?: string;
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  startDate: string;
  endDate?: string;
  nextOccurrenceDate: string;
  autoPost: boolean;
  status: RecurrenceStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface QuickTemplate {
  id: string;
  name: string;
  type: TransactionType;
  amountCents?: number;
  description?: string;
  categoryId?: string;
  accountId?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  favorite: boolean;
  sortOrder: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface SavingsGoal {
  id: string;
  name: string;
  targetAmountCents: number;
  targetDate?: string;
  accountId?: string;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface Budget {
  id: string;
  month: string;
  categoryId?: string;
  limitCents: number;
  archived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Puoi aggiungere campi soltanto quando servono a un requisito concreto. Mantieni una versione dello schema per future migrazioni.

## 9. Struttura Firestore

Ogni dato privato deve vivere sotto l’utente autenticato.

```text
users/{uid}
users/{uid}/accounts/{accountId}
users/{uid}/categories/{categoryId}
users/{uid}/transactions/{transactionId}
users/{uid}/recurringRules/{ruleId}
users/{uid}/quickTemplates/{templateId}
users/{uid}/savingsGoals/{goalId}
users/{uid}/budgets/{budgetId}
```

Il documento `users/{uid}` contiene profilo, preferenze e versione dello schema.

Prepara gli indici realmente necessari in `firestore.indexes.json`, soprattutto per query dei movimenti per data, conto, categoria, tipo e stato. Non aggiungere indici preventivi inutilizzati.

## 10. Logica dei saldi

Implementa una funzione di dominio pura che restituisca gli effetti di una transazione sui conti.

1. Spesa confermata: sottrai `amountCents` da `accountId`.
2. Entrata confermata: aggiungi `amountCents` ad `accountId`.
3. Trasferimento confermato: sottrai `amountCents + feeCents` dal conto sorgente e aggiungi `amountCents` al conto destinazione.
4. Operazione pianificata: non modifica il saldo attuale.
5. Operazione eliminata: non modifica il saldo attuale.
6. Operazioni future: non modificano il saldo attuale finché non diventano confermate ed effettive.

Creazione, modifica, eliminazione e ripristino devono aggiornare documento operazione e saldi dei conti in un’unica operazione atomica Firestore. Per una modifica, calcola gli effetti del vecchio stato, annullali e applica quelli del nuovo stato.

Usa eliminazione logica con `deletedAt` per permettere `Annulla`. Le query normali non devono mostrare documenti eliminati. Aggiungi uno strumento di ricalcolo saldi che ricostruisca ogni saldo da `openingBalanceCents` e dalle transazioni confermate non eliminate.

## 11. Motore delle ricorrenze senza backend

Non essendoci Cloud Functions, implementa un `RecurrenceService` client side.

1. All’avvio autenticato e al ritorno in primo piano, controlla le regole attive.
2. Genera tutte le occorrenze scadute fino a oggi.
3. Usa un identificatore deterministico come `ruleId_YYYYMMDD` come `occurrenceKey` e, se pratico, come ID del documento. In questo modo la stessa occorrenza non può essere creata due volte.
4. Se `autoPost` è vero, crea una transazione confermata.
5. Se `autoPost` è falso, crea o mostra una voce pianificata da confermare.
6. Aggiorna `nextOccurrenceDate` soltanto dopo una sincronizzazione riuscita.
7. Le occorrenze future usate nelle previsioni sono virtuali e non devono essere tutte salvate su Firestore.
8. Se l’app non viene aperta per settimane, alla successiva apertura recupera tutte le occorrenze mancanti in modo idempotente.
9. Gestisci correttamente mesi corti, anni bisestili, cambio d’ora e fuso Europe/Rome.
10. Scrivi test estesi per febbraio, giorno 29, giorno 30, giorno 31, fine anno, sospensione e data finale.

## 12. Formule di previsione

Tutte le formule devono essere funzioni pure e testate.

### Saldo totale attuale

Somma `currentBalanceCents` dei conti con `includeInNetWorth = true`.

### Disponibilità attuale

Somma `currentBalanceCents` dei conti con `includeInAvailable = true`.

### Prossimo stipendio

Trova la prossima occorrenza non ancora registrata della regola con `kind = salary`. Se esistono più stipendi, usa la prima occorrenza cronologica e somma quelli nello stesso giorno.

### Disponibile TEST

```text
disponibile =
  saldo dei conti spendibili
  + entrate pianificate prima del prossimo stipendio
  - spese pianificate prima del prossimo stipendio
  - margine di sicurezza
```

Il risultato visualizzato non deve essere inferiore a zero. Mostra separatamente un eventuale deficit previsto.

### Disponibilità giornaliera

```text
disponibilità giornaliera = disponibile / giorni rimanenti TEST
```

### Saldo previsto a una data

```text
saldo previsto =
  saldo totale attuale
  + entrate future confermate o pianificate
  - spese future confermate o pianificate
  + occorrenze virtuali generate dalle regole attive
```

I trasferimenti tra conti non modificano il saldo totale previsto, ma modificano la previsione del singolo conto. Evita doppi conteggi tra transazioni pianificate già salvate e occorrenze virtuali tramite `occurrenceKey`.

### Risparmio netto previsto

```text
risparmio netto previsto = entrate del periodo - spese del periodo
```

Escludi trasferimenti e saldi iniziali. Specifica sempre nell’interfaccia il periodo considerato.

## 13. Categorie iniziali

Al primo avvio crea categorie di sistema modificabili ma non eliminabili definitivamente se già utilizzate.

Spese:

1. Casa e bollette
2. Alimentari
3. Trasporti
4. Salute
5. Svago
6. Abbonamenti
7. Shopping
8. Commissioni
9. Altro

Entrate:

1. Stipendio
2. Rimborso
3. Regalo
4. Vendita
5. Altro

Le categorie usate da movimenti esistenti si archiviano invece di essere eliminate.

## 14. Sicurezza e privacy

1. Tutte le route applicative richiedono autenticazione.
2. Le Firestore Security Rules devono permettere accesso soltanto quando `request.auth.uid == uid` del percorso.
3. Aggiungi validazione di tipi, campi obbligatori, importi positivi e limiti ragionevoli nelle regole dove possibile.
4. Scrivi test automatici delle Security Rules con Emulator Suite per verificare isolamento tra due utenti diversi. Sono eseguibili solo con Java installato; finché non è disponibile, verifica le regole con il Rules Playground della console Firebase sul progetto di sviluppo.
5. Non considerare la configurazione pubblica Firebase un segreto, ma non affidarti mai a essa per la sicurezza.
6. Nessuna chiave privata, service account o segreto deve finire nel frontend o nel repository.
7. Usa `serverTimestamp` per i campi tecnici.
8. Abilita App Check dopo che sviluppo ed emulatori funzionano, senza bloccare l’ambiente locale.
9. Non inserire analytics, advertising o tracker nella prima versione.
10. Non registrare nei log descrizioni, importi o dettagli finanziari in produzione.
11. Mostra una nota chiara: l’app è uno strumento personale e non sostituisce estratti conto o consulenza finanziaria.

## 15. Animazioni

Le animazioni devono rendere l’app piacevole, non rallentarla.

1. Usa principalmente CSS transitions e le API Angular `animate.enter` e `animate.leave`.
2. Durata normale tra 160 e 240 millisecondi.
3. Usa easing morbidi e coerenti.
4. Cambio pagina: lieve dissolvenza e movimento verticale massimo di 8 pixel.
5. Apertura del pannello rapido: bottom sheet che sale dal basso e sfondo che si oscura leggermente.
6. Pulsante rapido: piccola rotazione e variazione di scala.
7. Nuovo movimento: ingresso nella lista e breve evidenziazione verde tenue.
8. Eliminazione: scorrimento o dissolvenza, seguito da snackbar con `Annulla`.
9. Valori della dashboard: transizione numerica sobria quando cambiano, senza rimbalzi continui.
10. Obiettivo completato: piccola animazione celebrativa una sola volta, mai invasiva.
11. Hover desktop: sollevamento massimo di 2 pixel sulle schede cliccabili.
12. Nessuna animazione infinita, parallasse, sfondo in movimento o ritardo artificiale.
13. Rispetta sempre `prefers-reduced-motion` e disattiva le animazioni non essenziali.
14. Non aggiungere GSAP o altre librerie pesanti senza una necessità dimostrabile.

## 16. Accessibilità

1. Supporto completo da tastiera.
2. Focus visibile e focus trap nei dialog.
3. Etichette associate a ogni controllo.
4. Messaggi di validazione comprensibili.
5. Contrasto conforme almeno a WCAG AA.
6. Il significato non deve dipendere solo dal colore.
7. Icone decorative escluse dagli screen reader.
8. Importi e aggiornamenti importanti annunciati con moderazione tramite aree live.
9. Dialog e bottom sheet devono ripristinare il focus al controllo che li ha aperti.

## 17. Errori e stati limite

1. Mostra errori Firebase in italiano senza esporre codici tecnici grezzi.
2. Distingui errore di rete, sessione scaduta, permesso negato e quota superata.
3. Impedisci salvataggi doppi durante una richiesta.
4. Chiedi conferma per eliminazioni importanti.
5. Mantieni i valori del form se il salvataggio fallisce.
6. Un saldo negativo è consentito, ma deve essere chiaramente evidenziato.
7. Impedisci trasferimenti verso lo stesso conto.
8. Impedisci importi uguali o inferiori a zero.
9. Gestisci conti o categorie archiviati già presenti in movimenti storici.
10. Gestisci il caso in cui non sia stato configurato alcuno stipendio. In quel caso non mostrare un calcolo inventato e invita a configurarlo.

## 18. Struttura suggerita del progetto

```text
src/app/
  core/
    auth/
    firebase/
    guards/
    layout/
    error-handling/
  shared/
    ui/
    pipes/
    directives/
    utils/
  domain/
    models/
    money/
    recurrence/
    forecast/
    balance-effects/
  features/
    onboarding/
    dashboard/
    transactions/
    quick-entry/
    accounts/
    recurring/
    savings/
    administration/
    settings/
  data-access/
    repositories/
    converters/
    queries/
```

Mantieni i servizi di dominio indipendenti da Angular e Firebase quando possibile, così da testarli facilmente.

## 19. Test minimi obbligatori

### Unit test

1. Formattazione e conversione degli importi in centesimi.
2. Effetti di spesa, entrata e trasferimento sui saldi.
3. Modifica e annullamento di una transazione.
4. Calcolo del prossimo stipendio.
5. Disponibilità fino allo stipendio.
6. Saldo e risparmio previsti.
7. Consumo e residuo dei budget mensili.
8. Ricorrenze mensili nei mesi corti.
9. Ricorrenze annuali e anni bisestili.
10. Esclusione dei trasferimenti dai totali di entrata e spesa.
11. Nessun doppio conteggio delle occorrenze.
12. Preselezione del conto predefinito e gestione del conto predefinito archiviato o inesistente.
13. Sospensione automatica delle regole ricorrenti collegate a un conto archiviato.

### Security Rules test

1. Utente autenticato può leggere e scrivere solo nel proprio percorso.
2. Utente A non può leggere o modificare dati di utente B.
3. Utente non autenticato non può accedere ai dati.
4. Documenti con importi non validi vengono rifiutati dove le regole lo consentono.
5. Spese senza `accountId` e regole ricorrenti senza `accountId` vengono rifiutate.

### End to end

1. Primo accesso e onboarding.
2. Creazione conto.
3. Inserimento rapido di una spesa da mobile.
4. Inserimento di un’entrata.
4a. Cambio del conto predefinito dalle impostazioni e richiesta di un nuovo conto predefinito dopo l’archiviazione.
5. Trasferimento tra conti.
6. Configurazione stipendio.
7. Configurazione spesa ricorrente.
8. Visualizzazione corretta della dashboard.
9. Modifica ed eliminazione con ripristino.
10. Export JSON e CSV.

Esegui test responsive almeno a 360, 390, 768, 1024 e 1440 pixel.

## 20. Fasi di sviluppo

### Fase 0: fondazione

1. Inizializza Angular, routing, SCSS, PWA e configurazione ambienti.
2. Configura Firebase SDK, ambiente di sviluppo online ed Emulator Suite facoltativa.
3. Configura lint, test e build.
4. Crea `PROJECT_SPEC.md`, `README.md` e `.env.example` se necessario.
5. Crea Firestore Rules e test iniziali di isolamento utenti.

### Fase 1: design system, autenticazione e shell

1. Token grafici globali.
2. Componenti base accessibili: button, input, select, dialog, bottom sheet, snackbar, empty state e skeleton.
3. Login (Google ed email) e recupero password.
4. Layout desktop con sidebar.
5. Layout mobile con barra inferiore e pulsante rapido.
6. Route guard.

### Fase 2: onboarding, conti e categorie

1. Onboarding iniziale.
2. CRUD conti.
3. CRUD e seed categorie.
4. Impostazioni personali.

### Fase 3: movimenti e trasferimenti

1. Repository e modelli transazioni.
2. Creazione rapida di spesa ed entrata.
3. Trasferimenti.
4. Lista, filtri, modifica, eliminazione logica e ripristino.
5. Aggiornamento atomico dei saldi.

### Fase 4: modelli rapidi e ricorrenze

1. Modelli salvati e preferiti.
2. Configurazione stipendio.
3. Regole ricorrenti.
4. Motore client side idempotente.
5. Pagina Pianificate.

### Fase 5: dashboard e previsioni

1. Riepilogo.
2. Disponibilità fino allo stipendio.
3. Disponibilità giornaliera.
4. Previsione a una data.
5. Obiettivi di risparmio.
6. Budget mensili generali e per categoria.

### Fase 6: rifinitura

1. Animazioni.
2. Accessibilità.
3. Offline read cache se stabile e utile.
4. Export e import.
5. Test end to end.
6. Ottimizzazione letture Firestore.
7. Deploy Firebase Hosting.

## 21. Criteri di completamento

Una funzionalità è completa soltanto se:

1. Ha interfaccia desktop e mobile.
2. Ha stato di caricamento, vuoto, errore e successo.
3. Ha validazione.
4. È accessibile da tastiera.
5. Usa dati Firebase reali o emulatori, non mock permanenti.
6. Ha test della logica critica.
7. Non introduce errori di build, lint o test.
8. Non aumenta inutilmente le letture Firestore.
9. Non richiede servizi a pagamento.

## 22. Prima attività da eseguire ora

1. Analizza la cartella corrente e dimmi in massimo dieci righe cosa contiene.
2. Se è vuota, inizializza il progetto secondo questa specifica.
3. Crea `PROJECT_SPEC.md` con il testo completo della specifica.
4. Completa Fase 0 e Fase 1.
5. Configura gli emulatori, ma non inventare credenziali o identificativi Firebase reali. Usa valori placeholder documentati.
6. Crea una dashboard iniziale collegata a un servizio dati con stato vuoto reale.
7. Implementa e mostra il pulsante rapido mobile con le tre azioni, anche se il salvataggio delle operazioni verrà completato nella Fase 3.
8. Esegui build, lint e test.
9. Correggi tutti gli errori.
10. Concludi con riepilogo, file principali creati, comandi da eseguire e informazioni Firebase che devo fornirti per collegare il progetto reale.

Non cambiare stack e non aggiungere funzioni fuori perimetro senza chiedere. In caso di scelta non specificata, preferisci la soluzione più semplice, gratuita e facilmente manutenibile.
