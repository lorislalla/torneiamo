# Torneiamo

Web app responsive e installabile per gestire tornei fino a 16 partecipanti, sincronizzarli e modificarli insieme.

## Funzionalità

- Campionato a sola andata o andata e ritorno.
- Campionato aperto per due partecipanti, senza un numero fisso di sfide.
- Classifica automatica con scontri diretti, differenza punti e punti fatti.
- Eliminazione diretta con sorteggio, bye e gare singole o A/R.
- Gironi configurabili con playoff generati automaticamente.
- Classifica libera con punteggi personalizzabili, inclusi valori negativi.
- Classifica a squadre o coppie con punteggi individuali e totale condiviso.
- Regole configurabili per punti, spareggi e ordinamento alto/basso.
- Accesso passwordless tramite magic link Supabase.
- Sincronizzazione Realtime con cache offline in `localStorage`.
- Collaborazione tramite inviti monouso con ruoli proprietario, editor e sola lettura.
- PWA installabile con cache offline e avviso esplicito per ogni nuova versione.

## Sviluppo locale

```bash
npm install
cp .env.example .env.local
npm run dev
```

Variabili richieste:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_VERSION=local
```

La publishable key è progettata per essere esposta al browser; la sicurezza dei dati è applicata nel database tramite RLS. Non usare mai una secret key o `service_role` in una variabile `NEXT_PUBLIC_*`.

Controllo completo prima di una release:

```bash
npm run check
```

La suite matematica dell'engine viene eseguita anche da `npm run check` e blocca
il controllo se scende sotto le soglie di copertura configurate. Per lanciarla
separatamente:

```bash
npm test
npm run test:coverage
npm run test:watch
```

## Database Supabase

Lo schema versionato si trova in `supabase/migrations`. Include tabelle, indici, trigger, permessi espliciti e policy RLS per tornei, membri e inviti.

Per i magic link, in **Authentication → URL Configuration** configura:

- Site URL: `https://torneiamo.vercel.app`
- Redirect URL: `https://torneiamo.vercel.app/auth/callback`
- Redirect locale: `http://localhost:3000/auth/callback`

## Versioni PWA

Su Vercel la versione dell’app coincide con `VERCEL_GIT_COMMIT_SHA`. Ogni nuovo commit produce quindi un service worker differente. Il nuovo worker resta in attesa e l’app mostra il pulsante **Aggiorna e ricarica**; dopo il click viene attivato e le cache precedenti vengono eliminate.

## Deploy automatico su Vercel

Il repository è collegato a Vercel tramite Git Integration:

- ogni push su un branch crea una Preview Deployment;
- ogni push su `main` crea una Production Deployment;
- il commit SHA aggiorna automaticamente la versione PWA.
