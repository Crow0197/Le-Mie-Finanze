# Recap — percorso Docker/Kubernetes su "Le mie finanze"

Incolla questo file all'inizio della nuova sessione dedicata, così si riparte esattamente da qui senza rifare la parte già fatta.

## Obiettivo

Imparare Docker e poi Kubernetes in modo guidato, passo-passo, usando come "palestra" pratica l'app reale **"Le mie finanze"** (PWA Angular 22 + Firebase, repo GitHub dell'utente Crow0197, cartella locale `C:\Users\User\Desktop\App Risparmio`). Stile: guidato, con spiegazioni del "perché" oltre al "come", tono da collega senior. L'utente esegue sempre lui i comandi sul proprio PC Windows (io spiego e mostro, non eseguo). Risposte in italiano.

## Vincoli concordati

- Si lavora su un **branch separato `docker`**, mai su `main`.
- Nessun comando PowerShell da parte mia; do comandi CMD quando serve.
- L'utente non aveva nulla installato all'inizio (niente Docker Desktop, niente WSL2, niente Kubernetes locale).

## Realtà tecnica dell'app (importante, non inventare altro)

- SPA Angular statica, backend Firebase (Auth, Firestore) gestito da Google — non è un backend classico da containerizzare.
- Progetto Angular: nome `le-mie-finanze`, builder `@angular/build:application`, nessun `outputPath` custom → la build finisce in **`dist/le-mie-finanze/browser`**.
- Script build: `npm run build` (= `ng build`). Package manager: npm.
- "Containerizzare" l'app significa soprattutto: (a) servire la build compilata con **nginx** dentro un'immagine multi-stage, (b) più avanti, far girare gli **emulatori Firebase** (Auth/Firestore) in un container per non installare Java in locale.
- Per Kubernetes: essendo un frontend statico, l'esercizio è soprattutto didattico (le meccaniche si applicano identiche a un backend più complesso in futuro). Firebase Hosting già offre load balancing/affidabilità gratis, quindi K8s qui non è un bisogno reale ma un allenamento.

## Roadmap concordata (6 tappe)

- **Tappa 0** — Docker Desktop + WSL2 su Windows, verifica con `docker version` / `docker run hello-world`. ✅ **COMPLETATA**
- **Tappa 1** — Dockerfile multi-stage (build Angular + nginx). 🔶 **IN CORSO** (vedi stato sotto)
- **Tappa 2** — `docker compose` con emulatori Firebase.
- **Tappa 3** — immagine su un registry (Docker Hub o GitHub Container Registry), build automatica da CI (il repo ha già GitHub Actions).
- **Tappa 4** — Kubernetes locale: Deployment/Service/Ingress, repliche, rollout, rollback.
- **Tappa 5** (opzionale) — Helm.

## Stato attuale — dettaglio

**Tappa 0 completata:**
- Errore iniziale "Virtualization support not detected" risolto: virtualizzazione era disattivata nel BIOS, l'utente l'ha attivata (voce Intel VT-x o SVM Mode a seconda della CPU).
- `wsl.exe --install --no-distribution` lanciato per abilitare il componente "Virtual Machine Platform".
- `docker run hello-world` ha funzionato, output "Hello from Docker!" confermato.

**Tappa 1 in corso:**
- Branch `docker` creato da `main` (`git checkout -b docker`).
- Creati questi 3 file nella root del progetto:

`Dockerfile`:
```dockerfile
# --- Stage 1: build dell'app Angular ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Stage 2: server statico ---
FROM nginx:alpine
COPY --from=build /app/dist/le-mie-finanze/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

`nginx.conf` (necessario perché Angular è una SPA con routing lato client — senza questo, aprire direttamente `/movimenti` darebbe 404):
```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`.dockerignore`:
```
node_modules
dist
.git
.angular
*.md
```

- **Problema incontrato e risolto**: il primo `docker build` falliva con "the Dockerfile cannot be empty" (solo 31 byte trasferiti) — causato da un file salvato quasi vuoto (probabile `Dockerfile.txt` invece di `Dockerfile`, tipico di Notepad che nasconde l'estensione). Risolto controllando con `dir /a` e `type Dockerfile`, poi ricreando il file correttamente (consigliato VS Code invece di Notepad per evitare il problema).
- **Prossimo comando da testare** (punto esatto da cui ripartire):
  ```
  docker build -t le-mie-finanze .
  docker run -p 8080:80 le-mie-finanze
  ```
  poi verificare `http://localhost:8080` nel browser. L'esito di questo comando NON è ancora stato confermato dall'utente — è il primo passo da chiedere nella nuova sessione.

## Concetti già spiegati (per non ripeterli da zero)

- Differenza container vs macchina virtuale (container condivide il kernel host via WSL2, è più leggero/veloce di una VM).
- Immagine (pacchetto statico, di sola lettura) vs container (istanza in esecuzione di un'immagine).
- Registry (Docker Hub) = magazzino di immagini, come npm per i pacchetti.
- Dockerfile = ricetta per costruire un'immagine; immagine = "torta cotta".
- Docker Engine/daemon (motore in background) vs Docker client (comando `docker` da terminale).
- Comandi base: `docker run`, `docker ps` / `docker ps -a`, `docker images`, `docker build -t nome .`, `docker stop`, `docker exec -it <id> bash`.
- **Cache a livelli (layer caching)**: ogni istruzione del Dockerfile è un livello cacheato; se l'input di un livello non cambia, Docker lo riusa e salta tutto ciò che dipende solo da esso. Per questo `COPY package.json package-lock.json ./` + `RUN npm ci` vengono **prima** di `COPY . .`: se cambi solo codice sorgente (non le dipendenze), il build salta la reinstallazione delle dipendenze e rifà solo la build del codice.
- **Perché serve un orchestratore (Kubernetes)**: self-healing (riavvio automatico di container morti), scaling (mantenere N repliche attive), rolling update/rollback (rilasci senza downtime, possibilità di tornare indietro), load balancing tra repliche, gestione di più container/macchine insieme. Nel nostro percorso userà l'immagine `le-mie-finanze` già costruita, su un Kubernetes locale (integrato in Docker Desktop, o `kind`/`minikube`).

## Prossimo passo immediato nella nuova sessione

Chiedere all'utente l'esito di `docker build -t le-mie-finanze .` seguito da `docker run -p 8080:80 le-mie-finanze` e la verifica su `http://localhost:8080`. Se va tutto bene, chiudere la Tappa 1 e passare alla Tappa 2 (`docker compose` con emulatori Firebase). Se ci sono errori nel build (tipicamente in `RUN npm ci` o `RUN npm run build`), diagnosticare differenze tra l'ambiente Windows locale e quello Linux del container.
