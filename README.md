# Torneiamo

Web app responsive e installabile per gestire tornei fino a 16 partecipanti senza fogli di calcolo.

## Funzionalità

- Campionato a sola andata o andata e ritorno.
- Classifica automatica con scontri diretti, differenza reti e gol fatti.
- Eliminazione diretta con sorteggio, bye e gare singole o A/R.
- Gironi configurabili con playoff generati automaticamente.
- Salvataggio locale dietro l'interfaccia `TournamentRepository`, pronta per un futuro adapter Supabase.
- PWA installabile con cache offline e avviso esplicito quando è disponibile una nuova versione.

## Sviluppo locale

```bash
npm install
npm run dev
```

Controllo completo prima di una release:

```bash
npm run check
```

## Versioni PWA

Su Vercel la versione dell'app coincide con i primi sette caratteri di `VERCEL_GIT_COMMIT_SHA`. Ogni nuovo commit produce quindi un service worker differente. Il nuovo worker resta in attesa e l'app mostra il pulsante **Aggiorna e ricarica**; solo dopo il click viene attivato e le cache della versione precedente vengono eliminate.

In locale viene usata la versione di `package.json`.

## Deploy automatico su Vercel

Collega questo repository a un progetto Vercel tramite la Git Integration. Da quel momento:

- ogni push su un branch crea una Preview Deployment;
- ogni push sul branch di produzione crea una nuova Production Deployment;
- il commit SHA aggiorna automaticamente la versione PWA.

Non servono workflow GitHub Actions o token salvati nel repository.
