# NFC Administratie

Nederlandstalige CRM- en administratietool met Supabase-login en gescheiden opslag per gebruiker.

## Lokaal starten

1. Installeer Node.js 22 of nieuwer.
2. Kopieer `.env.example` naar `.env.local`.
3. Vul de URL en publishable key van je Supabase-project in.
4. Voer `supabase/schema.sql` eenmalig uit via de SQL Editor van Supabase.
5. Start de app met `npm install` en `npm run dev`.

Een Supabase publishable key mag in browsercode staan. Gebruik hier nooit een `service_role`-sleutel.

## Vercel instellen

Voeg in **Project Settings → Environment Variables** deze twee waarden toe voor Production, Preview en Development:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `OPENAI_API_KEY` (alleen server-side, nooit met `NEXT_PUBLIC_`)
- `OPENAI_INVOICE_MODEL` (optioneel; standaard `gpt-5.6-luna`)

Start daarna een nieuwe deployment. `npm run build` maakt de vereiste Next.js-uitvoer voor Vercel.

## Beveiliging

- Supabase Row Level Security zorgt dat iedere gebruiker alleen de eigen administratie kan benaderen.
- CRM-gegevens worden niet in `localStorage` bewaard.
- De login-sessie staat alleen in het huidige browsertabblad en verloopt na 30 minuten zonder activiteit.
- `.env*`, build-uitvoer en lokale werkbestanden worden niet naar Git gestuurd.
- Productiepagina's sturen CSP- en andere beveiligingsheaders mee.
- Face ID, Touch ID en andere passkeys kunnen via Supabase WebAuthn worden gebruikt.
- Inkoopfacturen staan in een privé Supabase Storage-bucket en zijn alleen via een tijdelijk downloadadres te openen.

### Face ID / passkeys activeren

Open in Supabase **Authentication → Passkeys**, schakel passkeys in en stel een vast RP ID en de toegestane productie-URL in. Gebruikers kunnen daarna onder **Instellingen** een passkey koppelen. Passkey-ondersteuning in Supabase is momenteel experimenteel.

Voer na dependency-updates `npm audit --omit=dev` en `npm run build` uit.

## Commando's

- `npm run dev`: lokale Next.js-omgeving starten
- `npm run build`: productiebuild voor Vercel controleren
- `npm run build:sites`: afzonderlijke build voor OpenAI Sites
