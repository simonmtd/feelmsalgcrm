# Feelm Leads

Selger-app for daglig lead-fordeling. Selgere logger inn, velger hvilken
niche de jobber med, og får leads tildelt automatisk hver morgen. All info
(status, deal size, hva som er sagt, filming-status) er samlet per lead.
Admin-panelet administrerer selgere, nicher, og HubSpot-sync.

## Arkitektur

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS
- **Supabase** (Postgres + Auth + Row Level Security) — egen database, synket
  fra HubSpot (ikke live API-kall per side-visning)
- **Vercel Cron** kjører to jobber:
  - `/api/cron/sync-hubspot` — henter kontakter fra HubSpot inn i `leads`
  - `/api/cron/assign-daily-leads` — fordeler nye leads til aktive selgere
    basert på deres valgte niche

Se `supabase/migrations/0001_init.sql` for full skjema (niches, profiles,
leads, lead_activities, sync_runs, app_settings) og RLS-policyer.

## Oppsett

1. **Supabase-prosjekt**
   - Opprett et prosjekt på [supabase.com](https://supabase.com)
   - Kjør `supabase/migrations/0001_init.sql` i SQL-editoren (eller via
     `supabase db push` med Supabase CLI)
   - Hent `Project URL`, `anon public key` og `service_role key` fra
     Project Settings → API

2. **HubSpot**
   - Opprett en privat app i HubSpot med scope `crm.objects.contacts.read`
   - Kopier access-tokenet

3. **Miljøvariabler**
   - Kopier `.env.example` til `.env.local` og fyll inn verdiene
   - `CRON_SECRET` kan genereres med `openssl rand -base64 32`

4. **Installer og kjør lokalt**

   ```bash
   npm install
   npm run dev
   ```

   Åpne [http://localhost:3000](http://localhost:3000).

5. **Opprett første admin-bruker**

   Kjør før du har et admin-panel å logge inn i: opprett en bruker i
   Supabase Auth (dashboard → Authentication → Users → Add user), sett
   `user_metadata.role` til `"admin"` (eller oppdater `role` direkte i
   `profiles`-tabellen etterpå). Deretter kan denne brukeren opprette
   flere selgere/admins via `/admin/sellers`.

## Deploy (Vercel)

1. Koble repoet til Vercel
2. Legg inn de samme miljøvariablene som i `.env.local` i Vercel sine
   Project Settings → Environment Variables
3. `vercel.json` inneholder cron-oppsettet:
   - HubSpot-sync hvert 20. minutt
   - Daglig lead-fordeling kl. 06:00 UTC (~07–08 norsk tid, avhengig av
     sommer-/vintertid — juster `schedule` i `vercel.json` om nødvendig)
   - Vercel setter automatisk `Authorization: Bearer $CRON_SECRET` på
     cron-kall når `CRON_SECRET` er satt som miljøvariabel

## Mappestruktur

- `src/app/(app)/dashboard` — selgerens forside (niche-bytte, dagens leads)
- `src/app/(app)/leads` — selgerens leads (liste + detalj med aktivitetslogg)
- `src/app/(app)/admin/*` — admin-panel (selgere, nicher, alle leads, sync,
  innstillinger)
- `src/app/api/cron/*` — cron-endepunkter (sync og daglig fordeling)
- `src/lib/jobs/*` — delt logikk for cron-jobbene, gjenbrukt av admins
  "kjør nå"-knapper
- `src/lib/actions/*` — server actions for mutasjoner
- `supabase/migrations/0001_init.sql` — databaseskjema + RLS
